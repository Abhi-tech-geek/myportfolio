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
const SESSION_TTL = 10 * 60; // Dev Mode stays open 10 minutes after sign-in...
const AFTER_CHANGE_TTL = 10; // ...and closes 10 seconds after any change
const PREVIEW_TTL = 60 * 60; // an "only me" preview lasts an hour, even after Dev Mode closes
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
  closed: (sig) => `owner:closed:${sig.slice(0, 32)}`,
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
const cookie = (name, value, { httpOnly = false, maxAge = SESSION_TTL } = {}) =>
  `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; Secure; SameSite=Lax${httpOnly ? '; HttpOnly' : ''}`;
const now = () => Math.floor(Date.now() / 1000);

// The session's expiry is inside the signed value, so a shortened session really ends on the
// server too, even if the browser kept the cookie. `owner_ui` carries the same expiry so the
// page can show the countdown; it grants nothing by itself.
async function makeSession(secret, ver, ttl = SESSION_TTL) {
  const exp = now() + ttl;
  const nonce = randomHex(8); // every session token is unique, even two issued in the same second
  const sig = await hmac(secret, `owner.${ver}.${exp}.${nonce}`);
  return [
    cookie('owner_session', `${ver}.${exp}.${nonce}.${sig}`, { httpOnly: true, maxAge: ttl }),
    cookie('owner_ui', String(exp), { maxAge: ttl }),
  ];
}
const clearOwner = () => [
  cookie('owner_session', '', { httpOnly: true, maxAge: 0 }),
  cookie('owner_ui', '', { maxAge: 0 }),
  cookie('ui', '', { maxAge: 0 }),
  cookie('owner_key', '', { httpOnly: true, maxAge: 0 }), // cookie from the first version of the switch
];

// "Only me" preview: a signed cookie that shows one browser a design other than the live one.
// Readable by the page (to show the "Preview" badge and let you exit) but not forgeable.
async function makePreview(secret, ui) {
  const exp = now() + PREVIEW_TTL;
  const sig = await hmac(secret, `preview.${ui}.${exp}`);
  return cookie('pv', `${ui}.${exp}.${sig}`, { maxAge: PREVIEW_TTL });
}
const clearPreview = () => cookie('pv', '', { maxAge: 0 });

async function readPreview(request) {
  const raw = readCookie(request, 'pv');
  const m = raw && /^(classic|new)\.(\d{10})\.([0-9a-f]{64})$/.exec(raw);
  if (!m || Number(m[2]) < now()) return null;
  const { secret } = await loadAuth();
  if (!secret) return null;
  return sameHex(await hmac(secret, `preview.${m[1]}.${m[2]}`), m[3]) ? m[1] : null;
}

async function isOwner(request) {
  const raw = readCookie(request, 'owner_session');
  const m = raw && /^(\d{1,9})\.(\d{10})\.([0-9a-f]{16})\.([0-9a-f]{64})$/.exec(raw);
  if (!m) return false;
  const [, ver, exp, nonce, sig] = m;
  if (Number(exp) < now()) return false;
  const [credRaw, secret, closed] = await redis([['GET', K.cred], ['GET', K.secret], ['GET', K.closed(sig)]]);
  let cred = null;
  try { cred = credRaw ? JSON.parse(credRaw) : null; } catch {}
  if (!cred || !secret || closed || String(cred.ver) !== ver) return false;
  return sameHex(await hmac(secret, `owner.${ver}.${exp}.${nonce}`), sig);
}

// After a change the old (longer) session is closed on the server, so only the new 10-second
// session works, even if someone kept a copy of the old cookie.
async function closeSession(request) {
  const sig = (readCookie(request, 'owner_session') || '').split('.')[3];
  if (sig && /^[0-9a-f]{64}$/.test(sig)) await redis([['SET', K.closed(sig), 1, 'EX', SESSION_TTL]]);
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

// Every owner request body is a few short strings; anything bigger is refused before parsing
const MAX_BODY = 2048;
async function readJson(request) {
  try {
    if (!(request.headers.get('content-type') || '').includes('application/json')) return null;
    if (Number(request.headers.get('content-length') || 0) > MAX_BODY) return null;
    const text = await request.text();
    if (text.length > MAX_BODY) return null;
    const body = JSON.parse(text);
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
  // Browsers always send Origin on POSTs from fetch; a missing one is treated as cross-site too
  if (!origin && request.headers.get('sec-fetch-site') !== 'same-origin') return json(403, { error: 'forbidden' });

  // Lock only clears this browser's cookies: no storage or body needed
  if (path === '/owner/lock') {
    // Also close the session on the server when storage is available
    if (store()) await closeSession(request).catch(() => {});
    return json(200, { ok: true }, clearOwner());
  }

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

  if (path === '/owner/switch') {
    // POST + same-origin + JSON only, so another site can't flip the design through the owner's browser
    if (!(await isOwner(request))) return json(401, { error: 'signed-out' });
    const to = normalize(body.to);
    const scope = body.scope === 'me' ? 'me' : body.scope === 'everyone' ? 'everyone' : null;
    if (!to || !scope) return json(400, { error: 'bad-request' });
    const { cred, secret } = await loadAuth();
    const cookies = [cookie('ui', '', { maxAge: 0 })];

    if (scope === 'everyone') {
      await redis([['SET', K.live, to]]); // the design for EVERYONE until the owner switches again
      liveCache = { value: to, at: Date.now() };
      cookies.push(clearPreview());
    } else {
      // Only this browser; picking the design that's already live just ends the preview
      cookies.push(to === (await currentUI()) ? clearPreview() : await makePreview(secret, to));
    }
    // Any change closes Dev Mode 10 seconds later
    await closeSession(request);
    cookies.push(...(await makeSession(secret, cred.ver, AFTER_CHANGE_TTL)));
    return json(200, { ok: true, design: to === 'new' ? 'paper' : 'neon', scope, locksIn: AFTER_CHANGE_TTL }, cookies);
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
    return json(200, { ok: true, locksIn: AFTER_CHANGE_TTL }, await makeSession(secret, fresh.ver, AFTER_CHANGE_TTL));
  }

  return json(404, { error: 'not-found' });
}

// ---- main -------------------------------------------------------------------------------------------
export default async function middleware(request) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\.html$/, '').replace(/\/+$/, '') || '/';

  if (request.method === 'POST' && ['/owner/login', '/owner/setup', '/owner/password', '/owner/switch', '/owner/lock'].includes(path)) {
    try {
      return await ownerApi(request, url, path);
    } catch (e) {
      return json(503, { error: e?.code === 'storage-missing' ? 'storage-missing' : 'unavailable' });
    }
  }

  try {
    // State changes are POST-only (handled above). A GET to these URLs does nothing.
    if (path === '/owner/switch' || path === '/owner/lock') return redirect(url, '/');

    // Session check only when an owner session cookie is present
    const owner = readCookie(request, 'owner_session') ? await isOwner(request).catch(() => false) : false;

    // A valid "only me" preview overrides the live design for this browser
    const preview = readCookie(request, 'pv') ? await readPreview(request).catch(() => null) : null;
    const ui = preview ?? (await currentUI());
    const personal = owner || preview !== null;
    const noStore = { headers: NO_STORE };

    if (path === '/v2' || path.startsWith('/v2/')) {
      // The owner (or a Paper preview) can always open Paper here, even while Neon is live
      if (owner || ui === 'new') return next(noStore);
      return redirect(url, '/');
    }

    if (ui === 'new' && PAGES.has(path)) {
      const target = new URL(path === '/' ? '/v2' : `/v2${path}`, url);
      target.search = url.search;
      return rewrite(target, personal ? noStore : undefined);
    }

    return personal ? next(noStore) : next();
  } catch {
    // Never let a middleware bug take the site down: fall through to the normal page.
    return next();
  }
}
