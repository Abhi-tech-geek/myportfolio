// Vercel Routing Middleware: runs on Vercel's servers before a page is served.
//
// It decides which UI a request gets:
//   - everyone gets LIVE_UI (site-ui.config.js, or the LIVE_UI env var)
//   - the owner, once unlocked, can pick classic/new for themselves with the on-page switch
//
// The new UI is built under /v2/*. Public URLs never change: /, /abhimate, ... are rewritten to
// /v2, /v2/abhimate, ... when the new UI should be shown. /v2/* itself is closed to the public
// until the new UI goes live, so unfinished work can't be opened by guessing the URL.
//
// Owner unlock: POST the key to /owner. The key is checked against a SHA-256 hash, then stored in
// an HttpOnly, Secure cookie. Nothing in the page's JavaScript can read or forge it.
import { next, rewrite } from '@vercel/functions/middleware';
import { LIVE_UI, OWNER_KEY_SHA256 } from './site-ui.config.js';

export const config = {
  matcher: ['/', '/abhimate', '/aurago', '/discova', '/abhinova', '/v2', '/v2/:path*', '/owner', '/owner/:path*'],
};

const PAGES = new Set(['/', '/abhimate', '/aurago', '/discova', '/abhinova']);
const YEAR = 60 * 60 * 24 * 365;
const UIS = new Set(['classic', 'new']);

// Friendly names: "neon" = the current dark design (classic), "paper" = the editorial redesign (new).
const ALIAS = { neon: 'classic', paper: 'new', classic: 'classic', new: 'new' };
const normalize = (v) => ALIAS[String(v ?? '').trim().toLowerCase()];

const env = (name) => (typeof process !== 'undefined' ? process.env?.[name] : undefined);
const liveUI = () => normalize(env('LIVE_UI')) ?? normalize(LIVE_UI) ?? 'classic';
// An env var can replace the committed hash (lets the key be rotated from the Vercel dashboard)
const ownerHash = () => (/^[0-9a-f]{64}$/.test(env('OWNER_KEY_SHA256') || '') ? env('OWNER_KEY_SHA256') : OWNER_KEY_SHA256);

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

async function sha256Hex(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Constant-time comparison so response timing reveals nothing about the hash
function sameHex(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function keyIsValid(key) {
  if (typeof key !== 'string' || key.length < 20 || key.length > 200) return false;
  return sameHex(await sha256Hex(key), ownerHash());
}

const cookie = (name, value, { httpOnly = false, maxAge = YEAR } = {}) =>
  `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; Secure; SameSite=Lax${httpOnly ? '; HttpOnly' : ''}`;

function redirect(url, location, setCookies = []) {
  const headers = new Headers({ Location: new URL(location, url).toString(), 'Cache-Control': 'no-store' });
  for (const c of setCookies) headers.append('Set-Cookie', c);
  return new Response(null, { status: 303, headers });
}

// Only ever send the owner back to one of our own pages
const safeBack = (value) => (PAGES.has(value) ? value : '/');

export default async function middleware(request) {
  try {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\.html$/, '').replace(/\/+$/, '') || '/';

    // --- owner endpoints -------------------------------------------------------------------
    if (path === '/owner' && request.method === 'POST') {
      let key = '';
      try { key = String((await request.formData()).get('key') || '').trim(); } catch {}
      if (!(await keyIsValid(key))) return redirect(url, '/owner?e=1');
      return redirect(url, '/', [
        cookie('owner_key', key, { httpOnly: true }),
        cookie('owner_ui', '1'), // marker only: tells the page to show the switch. Grants nothing.
      ]);
    }

    const owner = await keyIsValid(readCookie(request, 'owner_key'));

    if (path === '/owner/switch') {
      if (!owner) return redirect(url, '/');
      const to = normalize(url.searchParams.get('to'));
      return redirect(url, safeBack(url.searchParams.get('back')), to ? [cookie('ui', to)] : []);
    }

    if (path === '/owner/lock') {
      return redirect(url, '/', [
        cookie('owner_key', '', { httpOnly: true, maxAge: 0 }),
        cookie('owner_ui', '', { maxAge: 0 }),
        cookie('ui', '', { maxAge: 0 }),
      ]);
    }

    // --- which UI ---------------------------------------------------------------------------
    const pref = owner ? readCookie(request, 'ui') : null;
    const ui = UIS.has(pref) ? pref : liveUI();
    const noStore = { headers: { 'Cache-Control': 'private, no-store' } };

    if (path === '/v2' || path.startsWith('/v2/')) {
      // Closed to the public until the new UI is live
      if (owner || liveUI() === 'new') return next(noStore);
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
