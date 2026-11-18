const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { createLoginRateLimit } = require('../src/middleware/loginRateLimit');

async function fixture(t, options = {}) {
  let calls = 0;
  const app = express();
  app.use(express.json());
  app.post('/login', createLoginRateLimit(options), async (req, res) => {
    calls++;
    await new Promise(resolve => setImmediate(resolve));
    res.status(req.body.password === 'correct' ? 200 : 401).json({ message: '동일한 로그인 응답' });
  });
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const login = (userId = 'tester', password = 'wrong', forwarded) => fetch(`http://127.0.0.1:${server.address().port}/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(forwarded ? { 'X-Forwarded-For': forwarded } : {}) },
    body: JSON.stringify({ userId, password })
  });
  return { login, calls: () => calls };
}

test('sixth attempt is blocked before password processing with Retry-After', async t => {
  const api = await fixture(t);
  for (let i = 0; i < 5; i++) assert.equal((await api.login()).status, 401);
  const blocked = await api.login();
  assert.equal(blocked.status, 429);
  assert.ok(Number(blocked.headers.get('retry-after')) > 0);
  assert.equal(blocked.headers.get('cache-control'), 'no-store');
  assert.equal(api.calls(), 5);
});

test('successful authentication resets only that account/IP counter', async t => {
  const api = await fixture(t, { accountLimit: 3, ipLimit: 20 });
  await api.login(); await api.login();
  assert.equal((await api.login('tester', 'correct')).status, 200);
  for (let i = 0; i < 3; i++) assert.equal((await api.login()).status, 401);
  assert.equal((await api.login()).status, 429);
  assert.equal((await api.login('another')).status, 401);
});

test('rotating accounts is bounded by the IP cap, including successful logins', async t => {
  const api = await fixture(t, { accountLimit: 5, ipLimit: 3 });
  for (const id of ['alice', 'bobby', 'carol']) assert.equal((await api.login(id, 'correct')).status, 200);
  assert.equal((await api.login('david', 'correct')).status, 429);
  assert.equal(api.calls(), 3);
});

test('forwarded-header spoofing and parallel requests cannot bypass limits', async t => {
  const api = await fixture(t, { accountLimit: 3, ipLimit: 30 });
  const results = await Promise.all(Array.from({ length: 8 }, (_, i) => api.login('tester', 'wrong', `198.51.100.${i + 1}`)));
  assert.equal(results.filter(res => res.status === 401).length, 3);
  assert.equal(results.filter(res => res.status === 429).length, 5);
  assert.equal(api.calls(), 3);
});

test('expired entries allow retry and bounded storage fails closed', async t => {
  let time = 0;
  const api = await fixture(t, { accountLimit: 1, windowMs: 1000, maxKeys: 2, now: () => time });
  assert.equal((await api.login('alice')).status, 401);
  assert.equal((await api.login('alice')).status, 429);
  assert.equal((await api.login('bobby')).status, 429);
  time = 1001;
  assert.equal((await api.login('bobby')).status, 401);
});

test('actual login route protects unknown accounts without querying the DB after the cap', async t => {
  const User = require('../src/models/user');
  const routes = require('../src/routes/auth');
  let queries = 0;
  t.mock.method(User, 'findOne', async () => { queries++; return null; });
  const app = express(); app.use(express.json()); app.use('/auth', routes);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const request = () => fetch(`http://127.0.0.1:${server.address().port}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: 'missingUser', password: 'Incorrect123!' })
  });
  for (let i = 0; i < 5; i++) assert.equal((await request()).status, 401);
  assert.equal((await request()).status, 429);
  assert.equal(queries, 5);
});

test('a capped IP cannot exhaust storage by rotating more account names', () => {
  const { EventEmitter } = require('node:events');
  const limit = createLoginRateLimit({ ipLimit: 1, maxKeys: 4 });
  function attempt(ip, userId) {
    const res = new EventEmitter();
    res.statusCode = 200;
    res.set = () => res;
    res.status = status => { res.statusCode = status; return res; };
    res.json = () => res;
    let allowed = false;
    limit({ ip, body: { userId } }, res, () => { allowed = true; });
    return { allowed, status: res.statusCode };
  }
  assert.equal(attempt('first-ip', 'alice').allowed, true);
  for (let i = 0; i < 100; i++) assert.equal(attempt('first-ip', `name${i}`).status, 429);
  assert.equal(attempt('second-ip', 'bobby').allowed, true);
});
