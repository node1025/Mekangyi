const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const authRoutes = require('../src/routes/auth');
const mailer = require('../src/services/resetMailer');

test('existing reset URLs reject legacy reset and expose non-cacheable errors over HTTP', async t => {
    const app = express();
    app.use(express.json());
    app.use('/api/auth', authRoutes);
    const server = app.listen(0, '127.0.0.1');
    await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
    t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
    const base = `http://127.0.0.1:${server.address().port}/api/auth`;
    const res = await fetch(`${base}/reset-password-unauthenticated`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: '507f1f77bcf86cd799439011', newPassword: 'Password123!' })
    });
    assert.equal(res.status, 400);
    assert.equal(res.headers.get('cache-control'), 'no-store');
    assert.equal((await res.json()).accessToken, undefined);

    t.mock.method(mailer, 'getSettings', () => { throw new Error('not configured'); });
    const missingConfig = await fetch(`${base}/verify-for-password`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Member', email: 'member@example.com' })
    });
    assert.equal(missingConfig.status, 503);
    assert.equal(missingConfig.headers.get('cache-control'), 'no-store');
});
