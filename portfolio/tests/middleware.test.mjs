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

beforeEach(() => { db = new Map(); redisDown = false; redisCalls = 0; delete process.env.LIVE_UI; });

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

// ---- visitors -----------------------------------------------------------------------------
test('visitor gets Neon on every page and storage is never touched', async () => {
  for (const p of ['/', '/abhimate', '/aurago', '/discova', '/abhinova']) {
    const res = await middleware(req(p));
    assert.ok(isNext(res), p);
    assert.equal(rewriteOf(res), null);
  }
  assert.equal(redisCalls, 0, 'no storage calls for normal visitors');
});

test('visitor cannot open /v2 directly', async () => {
  for (const p of ['/v2', '/v2/abhimate', '/v2/abhimate.html']) {
    assert.equal((await middleware(req(p))).status, 303, p);
  }
});

test('forged cookies without a valid session change nothing', async () => {
  await setUp();
  for (const cookie of [
    'ui=new; owner_ui=1',
    'owner_session=1.9999999999.' + '0'.repeat(64) + '; ui=new',
    'owner_session=garbage; ui=new',
  ]) {
    assert.equal(rewriteOf(await middleware(req('/', { cookie }))), null, cookie);
  }
});

test('visitor cannot use the switch', async () => {
  const res = await middleware(req('/owner/switch?to=paper'));
  assert.equal(res.status, 303);
  assert.equal(setCookies(res).length, 0);
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
  assert.ok(sessionFrom(ok));
});

test('5 wrong tries block that IP, even for the right password', async () => {
  await setUp();
  for (let i = 0; i < 5; i++) await post('/owner/login', { password: `nope-${i}-nope` });
  const blockedRes = await post('/owner/login', { password: PASSWORD });
  assert.equal(blockedRes.status, 429);
  const body = await blockedRes.json();
  assert.equal(body.error, 'too-many');
  assert.ok(body.minutes >= 1 && body.minutes <= 15);
  // another IP is not affected
  assert.equal((await post('/owner/login', { password: PASSWORD }, { ip: '2.2.2.2' })).status, 200);
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
  const res = await post('/owner/login', { password: PASSWORD }, { origin: 'https://evil.example' });
  assert.equal(res.status, 403);
});

test('non-JSON bodies are refused', async () => {
  const res = await middleware(new Request(BASE + '/owner/login', {
    method: 'POST', headers: { origin: BASE, 'content-type': 'application/x-www-form-urlencoded' }, body: 'password=x',
  }));
  assert.equal(res.status, 400);
});

// ---- owner session ---------------------------------------------------------------------------
test('owner picking Paper gets every page rewritten to /v2, uncached', async () => {
  const s = await setUp();
  const map = { '/': '/v2', '/abhimate': '/v2/abhimate', '/aurago': '/v2/aurago', '/discova': '/v2/discova', '/abhinova': '/v2/abhinova' };
  for (const [from, to] of Object.entries(map)) {
    const res = await middleware(req(from, { cookie: `${s}; ui=new` }));
    assert.equal(rewriteOf(res), BASE + to, from);
    assert.match(res.headers.get('cache-control') || '', /no-store/);
  }
  assert.ok(isNext(await middleware(req('/v2', { cookie: s }))), 'owner can open /v2');
});

test('switch accepts neon/paper and returns to the same page', async () => {
  const s = await setUp();
  const res = await middleware(req('/owner/switch?to=paper&back=/discova', { cookie: s }));
  assert.equal(location(res), `${BASE}/discova`);
  assert.ok(setCookies(res).some((c) => c.startsWith('ui=new')));
  const back = await middleware(req('/owner/switch?to=neon&back=/', { cookie: s }));
  assert.ok(setCookies(back).some((c) => c.startsWith('ui=classic')));
});

test('switch never redirects off-site', async () => {
  const s = await setUp();
  for (const back of ['https://evil.example', '//evil.example', 'javascript:alert(1)']) {
    const res = await middleware(req(`/owner/switch?to=paper&back=${encodeURIComponent(back)}`, { cookie: s }));
    assert.equal(location(res), `${BASE}/`, back);
  }
});

test('an expired session is not the owner', async () => {
  await setUp();
  const secret = db.get('owner:secret').v;
  const exp = Math.floor(Date.now() / 1000) - 10;
  const sig = createHmac('sha256', Buffer.from(secret, 'hex')).update(`owner.1.${exp}`).digest('hex');
  const res = await middleware(req('/', { cookie: `owner_session=1.${exp}.${sig}; ui=new` }));
  assert.equal(rewriteOf(res), null);
});

// ---- change password -------------------------------------------------------------------------
test('changing the password signs out every other device', async () => {
  const oldDevice = await setUp();
  const otherDevice = `${sessionFrom(await post('/owner/login', { password: PASSWORD }))}; owner_ui=1`;
  const res = await post('/owner/password', { current: PASSWORD, next: 'a brand new passphrase' }, { cookie: oldDevice });
  assert.equal(res.status, 200);
  const thisDevice = `${sessionFrom(res)}; owner_ui=1`;
  assert.equal(rewriteOf(await middleware(req('/', { cookie: `${otherDevice}; ui=new` }))), null, 'other device signed out');
  assert.equal(rewriteOf(await middleware(req('/', { cookie: `${thisDevice}; ui=new` }))), `${BASE}/v2`, 'this device stays in');
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
  const res = await post('/owner/setup', { recoveryKey: RECOVERY, password: 'my new memorable one' });
  assert.equal(res.status, 200);
  assert.equal((await post('/owner/login', { password: 'my new memorable one' })).status, 200);
  assert.equal((await post('/owner/login', { password: PASSWORD })).status, 401);
});

test('lock clears the owner cookies', async () => {
  const s = await setUp();
  const cookies = setCookies(await middleware(req('/owner/lock', { cookie: s })));
  for (const name of ['owner_session', 'owner_ui', 'ui']) {
    assert.ok(cookies.some((c) => c.startsWith(`${name}=`) && /Max-Age=0/.test(c)), name);
  }
});

// ---- going live + robustness -----------------------------------------------------------------
test('LIVE_UI accepts neon/paper (any case) and opens /v2 when Paper is live', async () => {
  for (const [value, paper] of [['paper', true], ['Paper ', true], ['neon', false], ['NEON', false], ['banana', false]]) {
    process.env.LIVE_UI = value;
    assert.equal(rewriteOf(await middleware(req('/'))) === `${BASE}/v2`, paper, value);
  }
  process.env.LIVE_UI = 'paper';
  assert.ok(isNext(await middleware(req('/v2'))));
});

test('storage down: visitors still get the site, sign-in reports unavailable', async () => {
  const s = await setUp();
  redisDown = true;
  assert.ok(isNext(await middleware(req('/'))), 'visitor fine');
  assert.ok(isNext(await middleware(req('/', { cookie: `${s}; ui=new` }))), 'owner falls back to Neon');
  const res = await post('/owner/login', { password: PASSWORD });
  assert.equal(res.status, 503);
});

test('storage not connected: sign-in says so, site unaffected', async () => {
  const url = process.env.KV_REST_API_URL;
  delete process.env.KV_REST_API_URL;
  try {
    const res = await post('/owner/login', { password: PASSWORD });
    assert.equal(res.status, 503);
    assert.equal((await res.json()).error, 'storage-missing');
    assert.ok(isNext(await middleware(req('/'))));
  } finally {
    process.env.KV_REST_API_URL = url;
  }
});

test('malformed cookies never crash the site', async () => {
  for (const cookie of ['owner_session=%E0%A4%A; ui=new', `owner_session=${'x'.repeat(5000)}`, '=;;;=;', 'ui']) {
    assert.ok(isNext(await middleware(req('/', { cookie }))), cookie.slice(0, 20));
  }
});

// ---- security review fixes ------------------------------------------------------------------
test('a burst of parallel guesses cannot get past the per-IP limit', async () => {
  await setUp();
  const results = await Promise.all(
    Array.from({ length: 20 }, (_, i) => post('/owner/login', { password: `burst-guess-${i}` })),
  );
  const checked = results.filter((r) => r.status === 401).length;
  const refused = results.filter((r) => r.status === 429).length;
  assert.ok(checked <= 5, `only 5 guesses may be checked, got ${checked}`);
  assert.equal(checked + refused, 20);
});

test('site-wide pause cannot lock the owner out: the recovery key still works and clears it', async () => {
  await setUp();
  for (let i = 0; i < 100; i++) await post('/owner/login', { password: 'nope-nope-nope' }, { ip: `10.1.${i >> 8}.${i & 255}` });
  assert.equal((await post('/owner/login', { password: PASSWORD }, { ip: '8.8.8.8' })).status, 429, 'paused');
  const rescue = await post('/owner/setup', { recoveryKey: RECOVERY, password: 'rescued passphrase' }, { ip: '8.8.8.8' });
  assert.equal(rescue.status, 200, 'recovery works during the pause');
  assert.equal((await post('/owner/login', { password: 'rescued passphrase' }, { ip: '7.7.7.7' })).status, 200, 'pause cleared');
});

test('a successful sign-in gives its site-wide slot back', async () => {
  await setUp();
  for (let i = 0; i < 3; i++) assert.equal((await post('/owner/login', { password: PASSWORD }, { ip: `5.5.5.${i}` })).status, 200);
  assert.equal(Number(db.get('owner:fail:all')?.v ?? 0), 0);
});
