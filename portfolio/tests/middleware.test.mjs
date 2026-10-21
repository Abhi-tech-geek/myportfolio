// Tests for the owner-only UI switch (middleware.js). Run: npm test
// Uses a throwaway test key; the real key never appears in the repo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

const TEST_KEY = 'test-owner-key-0123456789-abcdefghijklmnop';
process.env.OWNER_KEY_SHA256 = createHash('sha256').update(TEST_KEY).digest('hex');
delete process.env.LIVE_UI;

const { default: middleware } = await import('../middleware.js');
const BASE = 'https://theabhinavsaxena.in';

const req = (path, { cookie, method = 'GET', body } = {}) =>
  new Request(BASE + path, {
    method,
    headers: { ...(cookie ? { cookie } : {}), ...(body ? { 'content-type': 'application/x-www-form-urlencoded' } : {}) },
    body,
  });

const owner = (extra = '') => `owner_key=${encodeURIComponent(TEST_KEY)}; owner_ui=1${extra}`;
const rewriteOf = (res) => res.headers.get('x-middleware-rewrite');
const isNext = (res) => res.headers.get('x-middleware-next') === '1';
const location = (res) => res.headers.get('location');
const setCookies = (res) => res.headers.getSetCookie?.() ?? [];

// ---- visitors -----------------------------------------------------------------------------
test('visitor gets the live (classic) UI on every page', async () => {
  for (const p of ['/', '/abhimate', '/aurago', '/discova', '/abhinova']) {
    const res = await middleware(req(p));
    assert.ok(isNext(res), `${p} should pass through`);
    assert.equal(rewriteOf(res), null);
  }
});

test('visitor cannot open the unfinished /v2 pages directly', async () => {
  for (const p of ['/v2', '/v2/abhimate', '/v2/anything']) {
    const res = await middleware(req(p));
    assert.equal(res.status, 303);
    assert.equal(location(res), `${BASE}/`);
  }
});

test('forged ui / marker cookies without the key change nothing', async () => {
  const res = await middleware(req('/', { cookie: 'ui=new; owner_ui=1' }));
  assert.ok(isNext(res));
  assert.equal(rewriteOf(res), null);
  const v2 = await middleware(req('/v2', { cookie: 'ui=new; owner_ui=1' }));
  assert.equal(v2.status, 303);
});

test('a wrong key cookie is not the owner', async () => {
  const res = await middleware(req('/', { cookie: 'owner_key=wrong-key-wrong-key-wrong-key; ui=new' }));
  assert.equal(rewriteOf(res), null);
});

test('visitor cannot use the switch endpoint', async () => {
  const res = await middleware(req('/owner/switch?to=new&back=/'));
  assert.equal(res.status, 303);
  assert.equal(setCookies(res).length, 0);
});

// ---- unlock -------------------------------------------------------------------------------
test('wrong key on unlock sets no cookie and shows an error', async () => {
  const res = await middleware(req('/owner', { method: 'POST', body: 'key=nope-nope-nope-nope-nope' }));
  assert.equal(res.status, 303);
  assert.equal(location(res), `${BASE}/owner?e=1`);
  assert.equal(setCookies(res).length, 0);
});

test('right key on unlock sets an HttpOnly, Secure key cookie and the marker', async () => {
  const res = await middleware(req('/owner', { method: 'POST', body: `key=${encodeURIComponent(TEST_KEY)}` }));
  assert.equal(res.status, 303);
  assert.equal(location(res), `${BASE}/`);
  const cookies = setCookies(res);
  const keyCookie = cookies.find((c) => c.startsWith('owner_key='));
  assert.ok(keyCookie, 'owner_key cookie set');
  assert.match(keyCookie, /HttpOnly/);
  assert.match(keyCookie, /Secure/);
  assert.ok(cookies.some((c) => c.startsWith('owner_ui=1')), 'marker cookie set');
});

// ---- owner ----------------------------------------------------------------------------------
test('owner choosing "new" gets every page rewritten to /v2', async () => {
  const map = { '/': '/v2', '/abhimate': '/v2/abhimate', '/aurago': '/v2/aurago', '/discova': '/v2/discova', '/abhinova': '/v2/abhinova' };
  for (const [from, to] of Object.entries(map)) {
    const res = await middleware(req(from, { cookie: owner('; ui=new') }));
    assert.equal(rewriteOf(res), BASE + to, from);
    assert.match(res.headers.get('cache-control') || '', /no-store/, 'owner pages are not cached');
  }
});

test('owner choosing "classic" gets the classic UI', async () => {
  const res = await middleware(req('/', { cookie: owner('; ui=classic') }));
  assert.ok(isNext(res));
  assert.equal(rewriteOf(res), null);
});

test('owner can open /v2 directly', async () => {
  const res = await middleware(req('/v2', { cookie: owner() }));
  assert.ok(isNext(res));
});

test('switch sets the preference and returns to the same page', async () => {
  const res = await middleware(req('/owner/switch?to=new&back=/discova', { cookie: owner() }));
  assert.equal(res.status, 303);
  assert.equal(location(res), `${BASE}/discova`);
  assert.ok(setCookies(res).some((c) => c.startsWith('ui=new')));
});

test('switch never redirects off-site (open redirect blocked)', async () => {
  for (const back of ['https://evil.example', '//evil.example', '/v2/../../x', 'javascript:alert(1)']) {
    const res = await middleware(req(`/owner/switch?to=new&back=${encodeURIComponent(back)}`, { cookie: owner() }));
    assert.equal(location(res), `${BASE}/`, back);
  }
});

test('switch ignores unknown UI names', async () => {
  const res = await middleware(req('/owner/switch?to=evil&back=/', { cookie: owner() }));
  assert.equal(setCookies(res).length, 0);
});

test('lock clears all owner cookies', async () => {
  const res = await middleware(req('/owner/lock', { cookie: owner('; ui=new') }));
  const cookies = setCookies(res);
  for (const name of ['owner_key', 'owner_ui', 'ui']) {
    assert.ok(cookies.some((c) => c.startsWith(`${name}=`) && /Max-Age=0/.test(c)), `${name} cleared`);
  }
});

// ---- going live + robustness ---------------------------------------------------------------
test('LIVE_UI=new serves the new UI to everyone and opens /v2', async () => {
  process.env.LIVE_UI = 'new';
  try {
    const res = await middleware(req('/aurago'));
    assert.equal(rewriteOf(res), `${BASE}/v2/aurago`);
    assert.ok(isNext(await middleware(req('/v2'))));
    // and the owner can still preview classic
    const back = await middleware(req('/', { cookie: owner('; ui=classic') }));
    assert.equal(rewriteOf(back), null);
  } finally {
    delete process.env.LIVE_UI;
  }
});

test('an invalid LIVE_UI value falls back to classic', async () => {
  process.env.LIVE_UI = 'banana';
  try {
    assert.equal(rewriteOf(await middleware(req('/'))), null);
  } finally {
    delete process.env.LIVE_UI;
  }
});

test('malformed cookies and oversized keys never crash the site', async () => {
  for (const cookie of ['owner_key=%E0%A4%A; ui=new', `owner_key=${'x'.repeat(5000)}`, '=;;;=;', 'ui']) {
    const res = await middleware(req('/', { cookie }));
    assert.ok(isNext(res), cookie.slice(0, 20));
  }
});

test('trailing slashes and .html variants are treated the same', async () => {
  assert.equal(rewriteOf(await middleware(req('/abhimate/', { cookie: owner('; ui=new') }))), `${BASE}/v2/abhimate`);
  assert.equal((await middleware(req('/v2/abhimate.html'))).status, 303);
});

// ---- friendly names: neon = classic, paper = new ----------------------------------------------
test('LIVE_UI accepts the friendly names (any case)', async () => {
  for (const [value, expectNew] of [['paper', true], ['Paper ', true], ['neon', false], ['NEON', false]]) {
    process.env.LIVE_UI = value;
    try {
      const res = await middleware(req('/'));
      assert.equal(rewriteOf(res) === `${BASE}/v2`, expectNew, value);
    } finally {
      delete process.env.LIVE_UI;
    }
  }
});

test('switch accepts to=paper / to=neon', async () => {
  const toPaper = await middleware(req('/owner/switch?to=paper&back=/', { cookie: owner() }));
  assert.ok(setCookies(toPaper).some((c) => c.startsWith('ui=new')));
  const toNeon = await middleware(req('/owner/switch?to=neon&back=/', { cookie: owner() }));
  assert.ok(setCookies(toNeon).some((c) => c.startsWith('ui=classic')));
});
