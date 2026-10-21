// Tests for the owner-only design switch (middleware.js). Run: npm test
// Uses a throwaway recovery key and an in-memory fake of the Upstash Redis REST API.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, createHmac } from 'node:crypto';

const RECOVERY = 'test-recovery-key-0123456789-abcdefghijk';
const PASSWORD = 'correct horse battery';
process.env.OWNER_KEY_SHA256 = createHash('sha256').update(RECOVERY).digest('hex');
process.env.KV_REST_API_URL = 'https://redis.test';
process.env.KV_REST_API_TOKEN = 'test-token';
process.env.UI_CACHE_MS = '0'; // no caching between requests unless a test turns it on
delete process.env.LIVE_UI;

// ---- fake Upstash Redis (pipeline endpoint) ------------------------------------------------
let db = new Map();
let redisDown = false;
let redisCalls = 0;
const realFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const u = String(input);
  if (!u.startsWith('https://redis.test')) return realFetch(input, init);
  redisCalls++;
  if (redisDown) throw new Error('network down');
  assert.equal(init.headers.Authorization, 'Bearer test-token');
  const now = Date.now();
  const live = (k) => { const e = db.get(k); if (e && e.exp && e.exp <= now) { db.delete(k); return undefined; } return e; };
  const out = JSON.parse(init.body).map(([cmd, key, ...args]) => {
    const c = cmd.toUpperCase();
    if (c === 'GET') return { result: live(key)?.v ?? null };
    if (c === 'SET') {
      const nx = args.includes('NX');
      const exIdx = args.indexOf('EX');
      if (nx && live(key)) return { result: null };
      db.set(key, { v: String(args[0]), exp: exIdx >= 0 ? now + Number(args[exIdx + 1]) * 1000 : 0 });
      return { result: 'OK' };
    }
    if (c === 'INCR') { const e = live(key) ?? { v: '0', exp: 0 }; e.v = String(Number(e.v) + 1); db.set(key, e); return { result: Number(e.v) }; }
    if (c === 'DECR') { const e = live(key) ?? { v: '0', exp: 0 }; e.v = String(Number(e.v) - 1); db.set(key, e); return { result: Number(e.v) }; }
    if (c === 'DEL') return { result: db.delete(key) ? 1 : 0 };
    if (c === 'TTL') { const e = live(key); return { result: !e ? -2 : e.exp ? Math.ceil((e.exp - now) / 1000) : -1 }; }
    return { error: 'unknown command' };
  });
  return new Response(JSON.stringify(out), { status: 200, headers: { 'content-type': 'application/json' } });
};

const { default: middleware } = await import('../middleware.js');
const BASE = 'https://theabhinavsaxena.in';
const PAGES = { '/': '/v2', '/abhimate': '/v2/abhimate', '/aurago': '/v2/aurago', '/discova': '/v2/discova', '/abhinova': '/v2/abhinova' };

beforeEach(() => {
  db = new Map(); redisDown = false; redisCalls = 0;
  delete process.env.LIVE_UI; process.env.UI_CACHE_MS = '0';
});

// ---- helpers --------------------------------------------------------------------------------
const req = (path, { cookie, method = 'GET', body, ip = '1.1.1.1', origin = BASE } = {}) =>
  new Request(BASE + path, {
    method,
    headers: {
      ...(cookie ? { cookie } : {}),
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      ...(method === 'POST' && origin ? { origin } : {}),
      'x-real-ip': ip,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
const post = (path, body, opts = {}) => middleware(req(path, { method: 'POST', body, ...opts }));
const get = (path, opts = {}) => middleware(req(path, opts));
const rewriteOf = (res) => res.headers.get('x-middleware-rewrite');
const isNext = (res) => res.headers.get('x-middleware-next') === '1';
const location = (res) => res.headers.get('location');
const setCookies = (res) => res.headers.getSetCookie?.() ?? [];
const sessionFrom = (res) => {
  const c = setCookies(res).find((x) => x.startsWith('owner_session='));
  return c ? c.split(';')[0] : null;
};
async function setUp(password = PASSWORD) {
  const res = await post('/owner/setup', { recoveryKey: RECOVERY, password });
  assert.equal(res.status, 200, 'setup should succeed');
  return `${sessionFrom(res)}; owner_ui=1`;
}
const sw = (to, cookie, opts = {}) => post('/owner/switch', { to }, { cookie, ...opts });
const isOwnerCookie = async (cookie) => isNext(await get('/v2', { cookie })); // only the owner may open /v2 while Neon is live

// ---- visitors -----------------------------------------------------------------------------
test('visitor gets Neon on every page by default', async () => {
  for (const p of Object.keys(PAGES)) {
    const res = await get(p);
    assert.ok(isNext(res), p);
    assert.equal(rewriteOf(res), null);
  }
});

test('visitor cannot open /v2 directly while Neon is live', async () => {
  for (const p of ['/v2', '/v2/abhimate', '/v2/abhimate.html']) assert.equal((await get(p)).status, 303, p);
});

test('forged cookies without a valid session change nothing', async () => {
  await setUp();
  for (const cookie of [
    'ui=new; owner_ui=1',
    'owner_session=1.9999999999.' + '0'.repeat(64) + '; ui=new',
    'owner_session=garbage; ui=new',
  ]) {
    assert.equal(rewriteOf(await get('/', { cookie })), null, cookie);
    assert.equal((await sw('paper', cookie)).status, 401);
  }
  assert.equal(db.get('site:ui'), undefined, 'forged cookies could not change the live design');
});

test('visitor cannot use the switch', async () => {
  assert.equal((await sw('paper')).status, 401);
  assert.equal(db.get('site:ui'), undefined);
});

// ---- the switch is global -------------------------------------------------------------------
test('owner switching to Paper shows Paper to EVERY visitor until switched back', async () => {
  const s = await setUp();
  const res = await sw('paper', s);
  assert.equal(res.status, 200);
  assert.equal((await res.json()).live, 'paper');
  assert.equal(db.get('site:ui').v, 'new');
  for (const [from, to] of Object.entries(PAGES)) {
    assert.equal(rewriteOf(await get(from)), BASE + to, `visitor ${from}`);
    assert.equal(rewriteOf(await get(from, { cookie: s })), BASE + to, `owner ${from}`);
  }
  assert.ok(isNext(await get('/v2')), 'visitors may open /v2 once Paper is live');

  assert.equal((await sw('neon', s)).status, 200);
  assert.equal(db.get('site:ui').v, 'classic');
  for (const p of Object.keys(PAGES)) assert.equal(rewriteOf(await get(p)), null, `back to Neon ${p}`);
  assert.equal((await get('/v2')).status, 303);
});

test('switch clears the old per-browser preference cookie and ignores unknown names', async () => {
  const s = await setUp();
  const res = await sw('paper', s);
  assert.ok(setCookies(res).some((c) => c.startsWith('ui=') && /Max-Age=0/.test(c)));
  assert.equal((await sw('banana', s)).status, 400);
  assert.equal(db.get('site:ui').v, 'new', 'unknown name changed nothing');
});

test('an old per-browser ui cookie no longer overrides the live design', async () => {
  const s = await setUp();
  assert.equal(rewriteOf(await get('/', { cookie: `${s}; ui=new` })), null, 'still Neon for the owner too');
});

test("CSRF: another site cannot flip the design through the owner's browser", async () => {
  const s = await setUp();
  assert.equal((await sw('paper', s, { origin: 'https://evil.example' })).status, 403, 'cross-site POST');
  const getAttempt = await get('/owner/switch?to=paper&back=/', { cookie: s });
  assert.equal(getAttempt.status, 303, 'GET link does nothing');
  const noOrigin = await middleware(new Request(BASE + '/owner/switch', {
    method: 'POST', headers: { cookie: s, 'content-type': 'application/json', 'sec-fetch-site': 'cross-site' }, body: JSON.stringify({ to: 'paper' }),
  }));
  assert.equal(noOrigin.status, 403, 'POST without Origin from another site');
  assert.equal(db.get('site:ui'), undefined, 'design never changed');
});

test('owner can preview Paper at /v2 while Neon is live', async () => {
  const s = await setUp();
  assert.ok(await isOwnerCookie(s));
  assert.equal(rewriteOf(await get('/')), null, 'visitors still see Neon');
});

test('owner responses are never cached; the live design is cached briefly', async () => {
  const s = await setUp();
  assert.match((await get('/', { cookie: s })).headers.get('cache-control') || '', /no-store/);
  process.env.UI_CACHE_MS = '60000';
  await sw('paper', s);
  redisCalls = 0;
  for (let i = 0; i < 20; i++) await get('/');
  assert.equal(redisCalls, 0, 'visitors served from the in-memory cache');
});

test('LIVE_UI from the config/env is used until the switch has been used', async () => {
  for (const [value, paper] of [['paper', true], ['Paper ', true], ['neon', false], ['NEON', false], ['banana', false]]) {
    process.env.LIVE_UI = value;
    assert.equal(rewriteOf(await get('/')) === `${BASE}/v2`, paper, value);
  }
  process.env.LIVE_UI = 'paper';
  const s = await setUp();
  await sw('neon', s);
  assert.equal(rewriteOf(await get('/')), null, 'the switch wins over LIVE_UI');
});

// ---- first-time setup -----------------------------------------------------------------------
test('login before setup says not-set-up', async () => {
  const res = await post('/owner/login', { password: PASSWORD });
  assert.equal(res.status, 409);
  assert.equal((await res.json()).error, 'not-set-up');
});

test('setup needs the recovery key', async () => {
  const res = await post('/owner/setup', { recoveryKey: 'wrong-wrong-wrong-wrong-wrong', password: PASSWORD });
  assert.equal(res.status, 401);
  assert.equal(setCookies(res).length, 0);
});

test('setup rejects short passwords', async () => {
  const res = await post('/owner/setup', { recoveryKey: RECOVERY, password: 'short' });
  assert.equal(res.status, 400);
  assert.equal((await res.json()).error, 'weak');
});

test('setup stores only a PBKDF2 hash and signs the device in', async () => {
  const res = await post('/owner/setup', { recoveryKey: RECOVERY, password: PASSWORD });
  assert.equal(res.status, 200);
  const sess = setCookies(res).find((c) => c.startsWith('owner_session='));
  assert.match(sess, /HttpOnly/);
  assert.match(sess, /Secure/);
  const stored = db.get('owner:cred').v;
  assert.ok(!stored.includes(PASSWORD), 'plain password never stored');
  assert.equal(JSON.parse(stored).iter, 100000);
});

// ---- login ---------------------------------------------------------------------------------
test('right password signs in; wrong one counts down', async () => {
  await setUp();
  const wrong = await post('/owner/login', { password: 'not the password' });
  assert.equal(wrong.status, 401);
  assert.equal((await wrong.json()).left, 4);
  const ok = await post('/owner/login', { password: PASSWORD });
  assert.equal(ok.status, 200);
  assert.ok(await isOwnerCookie(sessionFrom(ok)));
});

test('5 wrong tries block that IP, even for the right password', async () => {
  await setUp();
  for (let i = 0; i < 5; i++) await post('/owner/login', { password: `nope-${i}-nope` });
  const blockedRes = await post('/owner/login', { password: PASSWORD });
  assert.equal(blockedRes.status, 429);
  const body = await blockedRes.json();
  assert.equal(body.error, 'too-many');
  assert.ok(body.minutes >= 1 && body.minutes <= 15);
  assert.equal((await post('/owner/login', { password: PASSWORD }, { ip: '2.2.2.2' })).status, 200, 'other IP fine');
});

test('many wrong tries across IPs pause sign-in site-wide', async () => {
  await setUp();
  for (let i = 0; i < 100; i++) await post('/owner/login', { password: 'nope-nope-nope' }, { ip: `10.0.${i >> 8}.${i & 255}` });
  const res = await post('/owner/login', { password: PASSWORD }, { ip: '9.9.9.9' });
  assert.equal(res.status, 429);
  assert.equal((await res.json()).error, 'paused');
});

test('cross-site posts are refused', async () => {
  await setUp();
  assert.equal((await post('/owner/login', { password: PASSWORD }, { origin: 'https://evil.example' })).status, 403);
});

test('non-JSON bodies are refused', async () => {
  const res = await middleware(new Request(BASE + '/owner/login', {
    method: 'POST', headers: { origin: BASE, 'content-type': 'application/x-www-form-urlencoded' }, body: 'password=x',
  }));
  assert.equal(res.status, 400);
});

test('an expired session is not the owner', async () => {
  await setUp();
  const secret = db.get('owner:secret').v;
  const exp = Math.floor(Date.now() / 1000) - 10;
  const sig = createHmac('sha256', Buffer.from(secret, 'hex')).update(`owner.1.${exp}`).digest('hex');
  const cookie = `owner_session=1.${exp}.${sig}`;
  assert.equal(await isOwnerCookie(cookie), false);
  assert.equal((await sw('paper', cookie)).status, 401);
  assert.equal(db.get('site:ui'), undefined);
});

// ---- change password -------------------------------------------------------------------------
test('changing the password signs out every other device', async () => {
  const oldDevice = await setUp();
  const otherDevice = sessionFrom(await post('/owner/login', { password: PASSWORD }));
  const res = await post('/owner/password', { current: PASSWORD, next: 'a brand new passphrase' }, { cookie: oldDevice });
  assert.equal(res.status, 200);
  assert.equal(await isOwnerCookie(otherDevice), false, 'other device signed out');
  assert.equal(await isOwnerCookie(sessionFrom(res)), true, 'this device stays in');
  assert.equal((await post('/owner/login', { password: PASSWORD })).status, 401, 'old password dead');
  assert.equal((await post('/owner/login', { password: 'a brand new passphrase' })).status, 200);
});

test('changing the password needs a session and the current password', async () => {
  const s = await setUp();
  assert.equal((await post('/owner/password', { current: PASSWORD, next: 'whatever whatever' })).status, 401);
  assert.equal((await post('/owner/password', { current: 'wrong wrong', next: 'whatever whatever' }, { cookie: s })).status, 401);
  assert.equal((await post('/owner/password', { current: PASSWORD, next: 'short' }, { cookie: s })).status, 400);
});

test('forgot password: the recovery key sets a new one', async () => {
  await setUp();
  assert.equal((await post('/owner/setup', { recoveryKey: RECOVERY, password: 'my new memorable one' })).status, 200);
  assert.equal((await post('/owner/login', { password: 'my new memorable one' })).status, 200);
  assert.equal((await post('/owner/login', { password: PASSWORD })).status, 401);
});

test('lock clears the owner cookies', async () => {
  const s = await setUp();
  const lockRes = await post('/owner/lock', {}, { cookie: s });
  assert.equal(lockRes.status, 200);
  const cookies = setCookies(lockRes);
  for (const name of ['owner_session', 'owner_ui', 'ui']) {
    assert.ok(cookies.some((c) => c.startsWith(`${name}=`) && /Max-Age=0/.test(c)), name);
  }
});

// ---- robustness -------------------------------------------------------------------------------
test('storage down: the site keeps serving the last known design, sign-in reports unavailable', async () => {
  const s = await setUp();
  await sw('paper', s);
  redisDown = true;
  assert.equal(rewriteOf(await get('/')), `${BASE}/v2`, 'last known design (Paper) kept');
  assert.equal((await post('/owner/login', { password: PASSWORD })).status, 503);
  assert.equal((await sw('neon', s)).status, 503, 'switch reports unavailable, never crashes');
});

test('storage not connected: sign-in says so, site serves LIVE_UI', async () => {
  const url = process.env.KV_REST_API_URL;
  delete process.env.KV_REST_API_URL;
  try {
    const res = await post('/owner/login', { password: PASSWORD });
    assert.equal(res.status, 503);
    assert.equal((await res.json()).error, 'storage-missing');
    assert.ok(isNext(await get('/')));
  } finally {
    process.env.KV_REST_API_URL = url;
  }
});

test('malformed cookies never crash the site', async () => {
  for (const cookie of ['owner_session=%E0%A4%A; ui=new', `owner_session=${'x'.repeat(5000)}`, '=;;;=;', 'ui']) {
    assert.ok(isNext(await get('/', { cookie })), cookie.slice(0, 20));
  }
});

// ---- security review fixes ------------------------------------------------------------------
test('a burst of parallel guesses cannot get past the per-IP limit', async () => {
  await setUp();
  const results = await Promise.all(Array.from({ length: 20 }, (_, i) => post('/owner/login', { password: `burst-guess-${i}` })));
  const checked = results.filter((r) => r.status === 401).length;
  assert.ok(checked <= 5, `only 5 guesses may be checked, got ${checked}`);
  assert.equal(checked + results.filter((r) => r.status === 429).length, 20);
});

test('site-wide pause cannot lock the owner out: the recovery key still works and clears it', async () => {
  await setUp();
  for (let i = 0; i < 100; i++) await post('/owner/login', { password: 'nope-nope-nope' }, { ip: `10.1.${i >> 8}.${i & 255}` });
  assert.equal((await post('/owner/login', { password: PASSWORD }, { ip: '8.8.8.8' })).status, 429, 'paused');
  assert.equal((await post('/owner/setup', { recoveryKey: RECOVERY, password: 'rescued passphrase' }, { ip: '8.8.8.8' })).status, 200);
  assert.equal((await post('/owner/login', { password: 'rescued passphrase' }, { ip: '7.7.7.7' })).status, 200, 'pause cleared');
});

test('a successful sign-in gives its site-wide slot back', async () => {
  await setUp();
  for (let i = 0; i < 3; i++) assert.equal((await post('/owner/login', { password: PASSWORD }, { ip: `5.5.5.${i}` })).status, 200);
  assert.equal(Number(db.get('owner:fail:all')?.v ?? 0), 0);
});

test('one IP hammering sign-in cannot trigger the site-wide pause', async () => {
  await setUp();
  for (let i = 0; i < 150; i++) await post('/owner/login', { password: 'nope-nope-nope' }, { ip: '6.6.6.6' });
  assert.ok(Number(db.get('owner:fail:all')?.v ?? 0) <= 5);
  assert.equal((await post('/owner/login', { password: PASSWORD }, { ip: '4.4.4.4' })).status, 200);
});

test('changing the password is limited per session, whatever the IP', async () => {
  const s = await setUp();
  for (let i = 0; i < 5; i++) {
    assert.equal((await post('/owner/password', { current: `wrong-${i}-wrong`, next: 'whatever whatever' }, { cookie: s, ip: `3.3.3.${i}` })).status, 401);
  }
  assert.equal((await post('/owner/password', { current: PASSWORD, next: 'whatever whatever' }, { cookie: s, ip: '3.3.3.99' })).status, 429);
});
