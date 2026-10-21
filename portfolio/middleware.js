// Vercel Routing Middleware: runs on Vercel's servers before a page is served.
//
// Which design a request gets:
//   - everyone gets the design the owner last picked with the on-site switch (stored in Redis)
//   - if nothing was picked yet, or storage is unreachable: LIVE_UI from site-ui.config.js / env
//   - the signed-in owner can also open /v2 directly to preview Paper while Neon is live
//
// The Paper design is built under /v2/*. Public URLs never change: /, /abhimate, ... are
// rewritten to /v2, /v2/abhimate, ... when Paper should be shown. /v2/* is closed to the public
// until Paper goes live.
//
// Owner sign-in (the lock button in the footer):
//   - the password lives only in Upstash Redis (connected through Vercel), hashed with PBKDF2.
//     Nothing about it is in the public GitHub repo.
//   - first-time setup and "forgot password" need the recovery key (only its SHA-256 is here)
//   - attempts are counted atomically before the check: 5 per IP = 15 minute block; 100 password
//     attempts site-wide in an hour = password sign-in paused (the recovery key still works, and
//     using it clears the pause, so nobody can lock the owner out)
//   - a signed session cookie (HttpOnly, Secure) remembers the device for a year; changing the
//     password signs every other device out
//   - any failure falls back to the normal public page: a bug here can never take the site down
import { next, rewrite } from '@vercel/functions/middleware';
import { LIVE_UI, OWNER_KEY_SHA256 } from './site-ui.config.js';

export const config = {
  matcher: ['/', '/abhimate', '/aurago', '/discova', '/abhinova', '/v2', '/v2/:path*', '/owner', '/owner/:path*'],
};

const PAGES = new Set(['/', '/abhimate', '/aurago', '/discova', '/abhinova']);
const YEAR = 60 * 60 * 24 * 365;
const ITERATIONS = 100_000;
const IP_LIMIT = 5;
const IP_WINDOW = 15 * 60;
const GLOBAL_LIMIT = 100;
const GLOBAL_WINDOW = 60 * 60;
const MIN_PASSWORD = 8;

// Friendly names: "neon" = the current dark design (classic), "paper" = the editorial redesign (new).
const ALIAS = { neon: 'classic', paper: 'new', classic: 'classic', new: 'new' };
const normalize = (v) => ALIAS[String(v ?? '').trim().toLowerCase()];

const env = (name) => (typeof process !== 'undefined' ? process.env?.[name] : undefined);
const liveUI = () => normalize(env('LIVE_UI')) ?? normalize(LIVE_UI) ?? 'classic';
const recoveryHash = () =>
  /^[0-9a-f]{64}$/.test(env('OWNER_KEY_SHA256') || '') ? env('OWNER_KEY_SHA256') : OWNER_KEY_SHA256;

// ---- small crypto helpers (Web Crypto, available on Vercel's runtime) -------------------------
const enc = (s) => new TextEncoder().encode(s);
const toHex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const fromHex = (hex) => new Uint8Array(hex.match(/../g).map((h) => parseInt(h, 16)));
const randomHex = (bytes) => toHex(crypto.getRandomValues(new Uint8Array(bytes)));
const sha256Hex = async (s) => toHex(await crypto.subtle.digest('SHA-256', enc(s)));

function sameHex(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function pbkdf2(password, saltHex, iterations) {
  const key = await crypto.subtle.importKey('raw', enc(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: fromHex(saltHex), iterations }, key, 256);
  return toHex(bits);
}

async function hmac(secretHex, message) {
  const key = await crypto.subtle.importKey('raw', fromHex(secretHex), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return toHex(await crypto.subtle.sign('HMAC', key, enc(message)));
}

// ---- storage: Upstash Redis REST API (env vars are added when the store is connected in Vercel)
function store() {
  const url = env('KV_REST_API_URL') || env('UPSTASH_REDIS_REST_URL');
  const token = env('KV_REST_API_TOKEN') || env('UPSTASH_REDIS_REST_TOKEN');
  return url && token ? { url: url.replace(/\/+$/, ''), token } : null;
}

async function redis(commands) {
  const s = store();
  if (!s) throw Object.assign(new Error('storage-missing'), { code: 'storage-missing' });
  const res = await fetch(`${s.url}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${s.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(commands),
  });
  if (!res.ok) throw Object.assign(new Error('storage-error'), { code: 'storage-error' });
  const out = await res.json();
  return out.map((r) => (r && 'result' in r ? r.result : null));
}

const K = {
  live: 'site:ui', // the design everyone sees, set by the owner's switch
  cred: 'owner:cred',
  secret: 'owner:secret',
  all: 'owner:fail:all',
  ip: (scope, ip) => `owner:fail:${scope}:${ip}`,
};

// The live design comes from storage (the owner's switch). It is cached in memory for a few
// seconds per server instance, so visitors almost never wait on storage, and if storage is
// unreachable the last known value (or LIVE_UI from the config) is used.
let liveCache = { value: null, at: 0 };
const cacheMs = () => (env('UI_CACHE_MS') !== undefined ? Number(env('UI_CACHE_MS')) : 15_000);

async function currentUI() {
  if (!store()) return liveUI();
  if (liveCache.value && Date.now() - liveCache.at < cacheMs()) return liveCache.value;
  try {
    const [stored] = await redis([['GET', K.live]]);
    const value = normalize(stored) ?? liveUI();
    liveCache = { value, at: Date.now() };
    return value;
  } catch {
    return liveCache.value ?? liveUI();
  }
}

async function loadAuth() {
  const [cred, secret] = await redis([['GET', K.cred], ['GET', K.secret]]);
  let parsed = null;
  try { parsed = cred ? JSON.parse(cred) : null; } catch {}
  return { cred: parsed, secret };
}

// ---- cookies ------------------------------------------------------------------------------------
function readCookie(request, name) {
  const header = request.headers.get('cookie') || '';
  for (const part of header.split(/;\s*/)) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i) === name) {
      try { return decodeURIComponent(part.slice(i + 1)); } catch { return null; }
    }
  }
  return null;
}
const cookie = (name, value, { httpOnly = false, maxAge = YEAR } = {}) =>
  `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; Secure; SameSite=Lax${httpOnly ? '; HttpOnly' : ''}`;

async function makeSession(secret, ver) {
  const exp = Math.floor(Date.now() / 1000) + YEAR;
  const sig = await hmac(secret, `owner.${ver}.${exp}`);
  return [cookie('owner_session', `${ver}.${exp}.${sig}`, { httpOnly: true }), cookie('owner_ui', '1')];
}
const clearOwner = () => [
  cookie('owner_session', '', { httpOnly: true, maxAge: 0 }),
  cookie('owner_ui', '', { maxAge: 0 }),
  cookie('ui', '', { maxAge: 0 }),
  cookie('owner_key', '', { httpOnly: true, maxAge: 0 }), // cookie from the first version of the switch
];

async function isOwner(request) {
  const raw = readCookie(request, 'owner_session');
  const m = raw && /^(\d{1,9})\.(\d{10})\.([0-9a-f]{64})$/.exec(raw);
  if (!m) return false;
  const [, ver, exp, sig] = m;
  if (Number(exp) < Date.now() / 1000) return false;
  const { cred, secret } = await loadAuth();
  if (!cred || !secret || String(cred.ver) !== ver) return false;
  return sameHex(await hmac(secret, `owner.${ver}.${exp}`), sig);
}

// ---- responses ----------------------------------------------------------------------------------
const NO_STORE = { 'Cache-Control': 'private, no-store' };

function json(status, body, setCookies = []) {
  const headers = new Headers({ 'Content-Type': 'application/json', ...NO_STORE });
  for (const c of setCookies) headers.append('Set-Cookie', c);
  return new Response(JSON.stringify(body), { status, headers });
}
function redirect(url, location, setCookies = []) {
  const headers = new Headers({ Location: new URL(location, url).toString(), ...NO_STORE });
  for (const c of setCookies) headers.append('Set-Cookie', c);
  return new Response(null, { status: 303, headers });
}
const safeBack = (value) => (PAGES.has(value) ? value : '/');

// ---- rate limiting -----------------------------------------------------------------------------
const clientIp = (request) =>
  (request.headers.get('x-real-ip') || request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown').trim().slice(0, 64);

// Every attempt is counted BEFORE the password is checked, in one atomic pipeline, so firing many
// requests at once can't slip extra guesses past the limit. A correct answer gives the slot back.
//
// scope 'login'    : per-IP limit + the site-wide limit (stops guessing from many IPs)
// scope 'recovery' : per-IP limit only. The recovery key is 256-bit random, so it can't be guessed,
//                    and keeping it out of the site-wide limit means an attacker can never lock the
//                    owner out: the recovery key always works.
// scope 'change'   : counted per signed-in SESSION, not per IP, so a stolen session can't
//                    rotate IPs to keep guessing the current password
//
// The site-wide counter only grows when the caller is still inside their own limit, so a single
// IP (or session) can add at most IP_LIMIT to it and can't trigger the pause on its own.
async function reserveAttempt(scope, who) {
  const [, mine, ttl] = await redis([
    ['SET', K.ip(scope, who), 0, 'EX', IP_WINDOW, 'NX'], ['INCR', K.ip(scope, who)], ['TTL', K.ip(scope, who)],
  ]);
  if (Number(mine) > IP_LIMIT) return { blocked: { error: 'too-many', minutes: Math.max(1, Math.ceil(Number(ttl) / 60)) } };
  if (scope === 'login') {
    const [, all] = await redis([['SET', K.all, 0, 'EX', GLOBAL_WINDOW, 'NX'], ['INCR', K.all]]);
    if (Number(all) > GLOBAL_LIMIT) return { blocked: { error: 'paused', minutes: 60 } };
  }
  return { left: Math.max(0, IP_LIMIT - Number(mine)) };
}
async function releaseAttempt(scope, who) {
  // Success: clear this caller's count and give the site-wide slot back
  const cmds = [['DEL', K.ip(scope, who)]];
  if (scope === 'login') cmds.push(['DECR', K.all]);
  await redis(cmds);
}

async function readJson(request) {
  try {
    if (!(request.headers.get('content-type') || '').includes('application/json')) return null;
    const body = await request.json();
    return body && typeof body === 'object' ? body : null;
  } catch { return null; }
}
const validPassword = (p) => typeof p === 'string' && p.length >= MIN_PASSWORD && p.length <= 128;

async function newCredential(password, previous) {
  const salt = randomHex(16);
  const hash = await pbkdf2(password, salt, ITERATIONS);
  return { v: 1, salt, hash, iter: ITERATIONS, ver: (previous?.ver ?? 0) + 1 };
}

// ---- owner API ------------------------------------------------------------------------------------
async function ownerApi(request, url, path) {
  // Only our own pages may call these (blocks cross-site form posts)
  const origin = request.headers.get('origin');
  if (origin && origin !== url.origin) return json(403, { error: 'forbidden' });
  if (!store()) return json(503, { error: 'storage-missing' });

  const ip = clientIp(request);
  const body = await readJson(request);
  if (!body) return json(400, { error: 'bad-request' });

  if (path === '/owner/login') {
    const { cred, secret } = await loadAuth();
    if (!cred || !secret) return json(409, { error: 'not-set-up' });
    const attempt = await reserveAttempt('login', ip);
    if (attempt.blocked) return json(429, attempt.blocked);
    const ok = typeof body.password === 'string' && body.password.length <= 128 &&
      sameHex(await pbkdf2(body.password, cred.salt, cred.iter), cred.hash);
    if (!ok) return json(401, { error: 'wrong', left: attempt.left });
    await releaseAttempt('login', ip);
    return json(200, { ok: true }, await makeSession(secret, cred.ver));
  }

  if (path === '/owner/setup') {
    // First-time setup and "forgot password": proven with the recovery key
    const attempt = await reserveAttempt('recovery', ip);
    if (attempt.blocked) return json(429, attempt.blocked);
    const key = typeof body.recoveryKey === 'string' ? body.recoveryKey.trim() : '';
    if (key.length < 20 || key.length > 200 || !sameHex(await sha256Hex(key), recoveryHash())) {
      return json(401, { error: 'wrong-key', left: attempt.left });
    }
    if (!validPassword(body.password)) return json(400, { error: 'weak', min: MIN_PASSWORD });
    const { cred: previous, secret: existing } = await loadAuth();
    const secret = existing || randomHex(32);
    const cred = await newCredential(body.password, previous);
    // A fresh password also clears an active site-wide pause, so the owner is never stuck
    await redis([['SET', K.cred, JSON.stringify(cred)], ['SET', K.secret, secret], ['DEL', K.ip('recovery', ip)], ['DEL', K.all]]);
    return json(200, { ok: true }, await makeSession(secret, cred.ver));
  }

  if (path === '/owner/password') {
    if (!(await isOwner(request))) return json(401, { error: 'signed-out' });
    // isOwner() verified this cookie; its signature identifies the session (independent of IP)
    const sessionId = readCookie(request, 'owner_session').slice(-32);
    const attempt = await reserveAttempt('change', `s:${sessionId}`);
    if (attempt.blocked) return json(429, attempt.blocked);
    const { cred, secret } = await loadAuth();
    const ok = typeof body.current === 'string' && body.current.length <= 128 &&
      sameHex(await pbkdf2(body.current, cred.salt, cred.iter), cred.hash);
    if (!ok) return json(401, { error: 'wrong', left: attempt.left });
    if (!validPassword(body.next)) return json(400, { error: 'weak', min: MIN_PASSWORD });
    const fresh = await newCredential(body.next, cred); // version bump signs out every other device
    await redis([['SET', K.cred, JSON.stringify(fresh)], ['DEL', K.ip('change', `s:${sessionId}`)]]);
    return json(200, { ok: true }, await makeSession(secret, fresh.ver));
  }

  return json(404, { error: 'not-found' });
}

// ---- main -------------------------------------------------------------------------------------------
export default async function middleware(request) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\.html$/, '').replace(/\/+$/, '') || '/';

  if (request.method === 'POST' && ['/owner/login', '/owner/setup', '/owner/password'].includes(path)) {
    try {
      return await ownerApi(request, url, path);
    } catch (e) {
      return json(503, { error: e?.code === 'storage-missing' ? 'storage-missing' : 'unavailable' });
    }
  }

  try {
    if (path === '/owner/lock') return redirect(url, '/', clearOwner());

    // Session check only when an owner session cookie is present
    const owner = readCookie(request, 'owner_session') ? await isOwner(request).catch(() => false) : false;

    if (path === '/owner/switch') {
      if (!owner) return redirect(url, '/');
      const to = normalize(url.searchParams.get('to'));
      if (to) {
        // Sets the design for EVERYONE until the owner switches again
        try {
          await redis([['SET', K.live, to]]);
          liveCache = { value: to, at: Date.now() };
        } catch {
          return redirect(url, `${safeBack(url.searchParams.get('back'))}?switch=failed`);
        }
      }
      // also drop the per-browser preference cookie from the earlier version of the switch
      return redirect(url, safeBack(url.searchParams.get('back')), [cookie('ui', '', { maxAge: 0 })]);
    }

    const ui = await currentUI();
    const noStore = { headers: NO_STORE };

    if (path === '/v2' || path.startsWith('/v2/')) {
      // The owner can always preview Paper here, even while Neon is live
      if (owner || ui === 'new') return next(noStore);
      return redirect(url, '/');
    }

    if (ui === 'new' && PAGES.has(path)) {
      const target = new URL(path === '/' ? '/v2' : `/v2${path}`, url);
      target.search = url.search;
      return rewrite(target, owner ? noStore : undefined);
    }

    return owner ? next(noStore) : next();
  } catch {
    // Never let a middleware bug take the site down: fall through to the normal page.
    return next();
  }
}
