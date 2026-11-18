const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const maria = require('../src/config/maria');
const User = require('../src/models/user');
const PasswordReset = require('../src/models/passwordReset');
const mailer = require('../src/services/resetMailer');
const reset = require('../src/controllers/passwordResetController');
const auth = require('../src/controllers/authController');
const { createResetRateLimit } = require('../src/middleware/resetRateLimit');

const id = '507f1f77bcf86cd799439011';
const token = 'a'.repeat(64);
const oldHash = 'existing-bcrypt-hash';
const hash = value => createHash('sha256').update(value).digest('hex');
const response = () => ({
    statusCode: 200, headers: {}, cookies: [],
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    set(key, value) { this.headers[key] = value; return this; },
    clearCookie(name) { this.cookies.push(name); return this; }
});
const user = () => ({ _id: id, password: oldHash, email: 'member@example.com', isActivated: true, refreshToken: 'old-refresh' });
const record = () => ({ userId: id, email: 'member@example.com', passwordFingerprint: hash(oldHash) });
const request = body => ({ body, user: { id } });

function mockRequest(t, member = user()) {
    t.mock.method(mailer, 'getSettings', () => ({ frontend: 'https://shop.example.com' }));
    t.mock.method(User, 'findOne', async () => member);
}

test('reset request stores only token hash and emails the registered address', async t => {
    mockRequest(t);
    let stored;
    t.mock.method(PasswordReset, 'findOneAndUpdate', async (filter, update, options) => {
        assert.equal(filter.userId, id);
        assert.ok(filter.requestedAt.$lte < new Date());
        assert.equal(options.upsert, true);
        stored = update.$set;
        return stored;
    });
    const send = t.mock.method(mailer, 'sendResetCode', async payload => {
        assert.equal(payload.email, 'member@example.com');
        assert.match(payload.code, /^\d{6}$/);
        assert.equal(stored.verified, false);
        assert.equal(stored.attempts, 0);
        assert.equal(stored.passwordFingerprint, hash(oldHash));
        assert.equal(stored.expiresAt - stored.requestedAt, 15 * 60000);
        assert.equal(Object.hasOwn(stored, 'token'), false);
    });
    const res = response();
    await reset.requestReset(request({ userId: 'member', birthDate: '2000-01-01', email: 'member@example.com' }), res);
    assert.equal(res.statusCode, 202);
    assert.deepEqual(Object.keys(res.body), ['message', 'challenge']);
    assert.equal(send.mock.callCount(), 1);
});

test('lookup requires all three identity fields and delivers only to stored email', async t => {
    mockRequest(t);
    t.mock.method(User, 'findOne', async query => {
        assert.deepEqual(query, { userId: 'member', birthDate: new Date('2000-01-01'), email: 'member@example.com', isActivated: true });
        return user();
    });
    t.mock.method(PasswordReset, 'findOneAndUpdate', async () => ({}));
    const send = t.mock.method(mailer, 'sendResetCode', async data => assert.equal(data.email, 'member@example.com'));
    const res = response();
    await reset.requestReset(request({ userId: 'member', birthDate: '2000-01-01', email: 'member@example.com' }), res);
    assert.equal(res.statusCode, 202);
    assert.equal(send.mock.callCount(), 1);
});

test('unknown accounts and cooldown requests return identical neutral response', async t => {
    mockRequest(t, null);
    const send = t.mock.method(mailer, 'sendResetCode', async () => {});
    const unknown = response();
    await reset.requestReset(request({ userId: 'member', birthDate: '2000-01-01', email: 'member@example.com' }), unknown);
    t.mock.method(User, 'findOne', async () => user());
    t.mock.method(PasswordReset, 'findOneAndUpdate', async () => { throw Object.assign(new Error('duplicate'), { code: 11000 }); });
    const remove = t.mock.method(PasswordReset, 'deleteOne', async () => {});
    const cooldown = response();
    await reset.requestReset(request({ userId: 'member', birthDate: '2000-01-01', email: 'member@example.com' }), cooldown);
    assert.equal(unknown.statusCode, 202);
    assert.equal(cooldown.statusCode, 202);
    assert.equal(unknown.body.message, cooldown.body.message);
    assert.match(unknown.body.challenge, /^[a-f0-9]{64}$/);
    assert.equal(send.mock.callCount(), 0);
    assert.equal(remove.mock.callCount(), 0);
});

test('failed mail delivery removes only the newly issued token without exposing account', async t => {
    mockRequest(t);
    t.mock.method(console, 'error', () => {});
    let issuedHash;
    t.mock.method(PasswordReset, 'findOneAndUpdate', async (_filter, update) => { issuedHash = update.$set.tokenHash; return {}; });
    t.mock.method(mailer, 'sendResetCode', async () => { throw new Error('SMTP error'); });
    const remove = t.mock.method(PasswordReset, 'deleteOne', async filter => assert.deepEqual(filter, { tokenHash: issuedHash }));
    const res = response();
    await reset.requestReset(request({ userId: 'member', birthDate: '2000-01-01', email: 'member@example.com' }), res);
    assert.equal(remove.mock.callCount(), 1);
    assert.equal(res.statusCode, 202);
    assert.deepEqual(Object.keys(res.body), ['message', 'challenge']);
});

test('missing SMTP configuration fails before querying an account', async t => {
    t.mock.method(mailer, 'getSettings', () => { throw new Error('not configured'); });
    const query = t.mock.method(User, 'findOne', async () => { throw new Error('must not query'); });
    const res = response();
    await reset.requestReset(request({ userId: 'member', birthDate: '2000-01-01', email: 'member@example.com' }), res);
    assert.equal(res.statusCode, 503);
    assert.equal(query.mock.callCount(), 0);
});

test('lookup rejects object injection and ambiguous identity before database reads', async t => {
    const query = t.mock.method(User, 'findOne', async () => { throw new Error('must not query'); });
    for (const body of [
        { name: { $ne: '' }, email: 'member@example.com' },
        { name: 'Member', email: { $ne: '' } },
        { name: 'Member' },
        { name: 'Member', email: 'member@example.com', phone: '01012345678' },
        { name: 'Member', email: 'invalid' },
        { name: 'Member', phone: 'not-a-phone' },
        { userId: 'member', birthDate: '2000-02-30', email: 'member@example.com' }
    ]) {
        const res = response();
        await reset.requestReset(request(body), res);
        assert.equal(res.statusCode, 400);
    }
    assert.equal(query.mock.callCount(), 0);
});

test('legacy userId-only reset is rejected by the original controller export', async t => {
    const transaction = t.mock.method(maria, 'transaction', async () => { throw new Error('must not start'); });
    const res = response();
    await auth.resetPasswordUnauthenticated(request({ userId: id, newPassword: 'NewPassword1!' }), res);
    assert.equal(res.statusCode, 400);
    assert.equal(transaction.mock.callCount(), 0);
});

test('invalid token or password never consumes a reset token', async t => {
    const transaction = t.mock.method(maria, 'transaction', async () => { throw new Error('must not start'); });
    for (const body of [
        { token: 'invalid', newPassword: 'NewPassword1!' },
        { token, newPassword: 'short' },
        { token, newPassword: 'a'.repeat(73) + '1!' },
        { token, newPassword: '가'.repeat(30) + 'Ab1!' },
        { token, newPassword: { $ne: '' } }
    ]) {
        const res = response();
        await reset.resetPassword(request(body), res);
        assert.equal(res.statusCode, 400);
    }
    assert.equal(transaction.mock.callCount(), 0);
});

function mockTransaction(t, resetRecord = record(), member = user()) {
    const session = {};
    const transaction = t.mock.method(maria, 'transaction', async callback => callback(session));
    t.mock.method(PasswordReset, 'findOneAndDelete', filter => ({ session: async actual => {
        assert.equal(actual, session);
        assert.equal(filter.tokenHash, hash(token));
        assert.equal(filter.verified, true);
        assert.ok(filter.expiresAt.$gt instanceof Date);
        return resetRecord;
    } }));
    t.mock.method(User, 'findById', userId => ({ session: async actual => {
        assert.equal(userId, id);
        assert.equal(actual, session);
        return member;
    } }));
    return { session, transaction };
}

test('valid token is consumed and password saved with refresh revoked in the same transaction', async t => {
    const member = user();
    const { session, transaction } = mockTransaction(t, record(), member);
    let saved = false;
    member.save = async options => {
        assert.equal(options.session, session);
        assert.equal(member.password, 'NewPassword1!');
        assert.equal(member.refreshToken, undefined);
        saved = true;
    };
    const res = response();
    await reset.resetPassword(request({ token, newPassword: 'NewPassword1!' }), res);
    assert.equal(transaction.mock.callCount(), 1);
    assert.equal(saved, true);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.cookies, ['refreshToken']);
});

test('expired or used tokens cannot reach password save', async t => {
    mockTransaction(t, null);
    const query = t.mock.method(User, 'findById', () => { throw new Error('must not load user'); });
    const res = response();
    await reset.resetPassword(request({ token, newPassword: 'NewPassword1!' }), res);
    assert.equal(res.statusCode, 400);
    assert.equal(query.mock.callCount(), 0);
});

test('changed password, changed email, inactive or deleted account invalidate earlier links', async t => {
    for (const member of [
        { ...user(), password: 'changed-hash' },
        { ...user(), email: 'changed@example.com' },
        { ...user(), isActivated: false },
        null
    ]) {
        mockTransaction(t, record(), member);
        if (member) member.save = () => { throw new Error('must not save'); };
        const res = response();
        await reset.resetPassword(request({ token, newPassword: 'NewPassword1!' }), res);
        assert.equal(res.statusCode, 400);
    }
});

test('password save errors escape transaction callback so MariaDB can roll back token consumption', async t => {
    const member = user();
    mockTransaction(t, record(), member);
    const failure = new Error('database unavailable');
    member.save = async () => { throw failure; };
    let rejected = false;
    t.mock.method(maria, 'transaction', async callback => {
        try { await callback({}); } catch (error) { rejected = true; throw error; }
    });
    // Keep session assertions independent of the transaction implementation here.
    t.mock.method(PasswordReset, 'findOneAndDelete', () => ({ session: async () => record() }));
    t.mock.method(User, 'findById', () => ({ session: async () => member }));
    t.mock.method(console, 'error', () => {});
    const res = response();
    await reset.resetPassword(request({ token, newPassword: 'NewPassword1!' }), res);
    assert.equal(rejected, true);
    assert.equal(res.statusCode, 503);
    assert.deepEqual(res.cookies, []);
});

test('IP rate limit blocks excessive requests and resets after the time window', () => {
    let time = 1000;
    const limit = createResetRateLimit({ limit: 2, windowMs: 60000, now: () => time });
    let allowed = 0;
    const next = () => { allowed++; };
    limit({ ip: '127.0.0.1' }, response(), next);
    limit({ ip: '127.0.0.1' }, response(), next);
    const blocked = response();
    limit({ ip: '127.0.0.1' }, blocked, next);
    assert.equal(allowed, 2);
    assert.equal(blocked.statusCode, 429);
    assert.equal(blocked.headers['Retry-After'], '60');
    time += 60000;
    limit({ ip: '127.0.0.1' }, response(), next);
    assert.equal(allowed, 3);
});

test('reset collection declares both per-user uniqueness and token expiry indexes', () => {
    const indexes = PasswordReset.schema.indexes();
    assert.ok(indexes.some(([keys, options]) => keys.userId === 1 && options.unique));
    assert.ok(indexes.some(([keys, options]) => keys.tokenHash === 1 && options.unique));
    assert.ok(indexes.some(([keys, options]) => keys.expiresAt === 1 && options.expireAfterSeconds === 0));
});

function mockCode(t, record) {
    t.mock.method(maria, 'transaction', async callback => callback({}));
    t.mock.method(PasswordReset, 'findOne', filter => ({ session: async () => {
        assert.equal(filter.verified, false);
        assert.ok(filter.expiresAt.$gt instanceof Date);
        return record && record.tokenHash === filter.tokenHash ? record : null;
    } }));
}
test('code verification commits failed attempts and blocks even the correct code after five guesses', async t => {
    const challenge = 'b'.repeat(64);
    const record = { tokenHash: hash(challenge), codeHash: hash(challenge + '012345'), attempts: 0, save: async () => {} };
    mockCode(t, record);
    for (let i = 0; i < 5; i++) {
        const res = response(); await reset.verifyCode(request({ challenge, code: '000000' }), res);
        assert.equal(res.statusCode, 400); assert.equal(record.attempts, i + 1);
    }
    const res = response(); await reset.verifyCode(request({ challenge, code: '012345' }), res);
    assert.equal(res.statusCode, 400); assert.equal(record.attempts, 5);
});
test('valid code rotates the challenge into a single-use reset credential and rejects replay', async t => {
    const challenge = 'b'.repeat(64);
    const record = { tokenHash: hash(challenge), codeHash: hash(challenge + '012345'), attempts: 0, save: async () => {} };
    mockCode(t, record);
    const res = response(); await reset.verifyCode(request({ challenge, code: '012345' }), res);
    assert.equal(res.statusCode, 200); assert.match(res.body.token, /^[a-f0-9]{64}$/);
    assert.equal(record.verified, true); assert.equal(record.tokenHash, hash(res.body.token));
    assert.equal(record.codeHash, undefined);
    const replay = response(); await reset.verifyCode(request({ challenge, code: '012345' }), replay);
    assert.equal(replay.statusCode, 400);
});
test('expired, missing and malformed challenges never authorize a reset', async t => {
    mockCode(t, null);
    for (const body of [{challenge:'b'.repeat(64),code:'012345'}, {challenge:{},code:'012345'}, {challenge:'b'.repeat(64),code:'12'}]) {
        const res = response(); await reset.verifyCode(request(body), res); assert.equal(res.statusCode, 400);
    }
});
