const { test } = require('node:test');
const assert = require('node:assert/strict');
const User = require('../src/models/user');
const recovery = require('../src/controllers/accountRecoveryController');

const response = () => ({
    code: 200,
    cookies: [],
    status(code) { this.code = code; return this; },
    json(body) { this.body = body; return this; },
    clearCookie(name) { this.cookies.push(name); return this; }
});

test('email lookup returns the stored email and id only when name and phone match', async t => {
    const lookup = t.mock.method(User, 'findOne', async query => {
        assert.deepEqual(query, { name: '회원', phone: '01012345678', role: 'user', isActivated: true });
        return { email: 'member@example.com', userId: 'member1' };
    });
    const found = response();
    await recovery.findEmail({ body: { name: ' 회원 ', phone: '010-1234-5678' } }, found);
    assert.equal(found.code, 200);
    assert.deepEqual(found.body, { userId: 'me****1' });

    lookup.mock.mockImplementation(async () => null);
    const missing = response();
    await recovery.findEmail({ body: { name: '없는사람', phone: '01099998888' } }, missing);
    assert.equal(missing.code, 404);
    assert.equal(missing.body.message, '일치하는 회원 정보가 없습니다.');
});

test('email lookup rejects incomplete contact before querying', async t => {
    const lookup = t.mock.method(User, 'findOne', async () => { throw new Error('must not query'); });
    const res = response();
    await recovery.findEmail({ body: { name: '회원', phone: '123' } }, res);
    assert.equal(res.code, 400);
    assert.equal(lookup.mock.callCount(), 0);
});

test('phone reset changes the password after the current password matches', async t => {
    const user = {
        password: 'old',
        refreshToken: 'refresh',
        async comparePassword(candidate) { return candidate === 'OldPassword1!'; },
        async save() { this.saved = true; }
    };
    t.mock.method(User, 'findOne', async query => {
        assert.deepEqual(query, { userId: 'member1', phone: '01012345678', role: 'user', isActivated: true });
        return user;
    });
    const res = response();
    await recovery.resetPasswordByPhone({
        body: { userId: 'member1', phone: '010-1234-5678', currentPassword: 'OldPassword1!', newPassword: 'NewPassword1!' }
    }, res);
    assert.equal(res.code, 200);
    assert.equal(user.password, 'NewPassword1!');
    assert.equal(user.refreshToken, undefined);
    assert.equal(user.saved, true);
    assert.deepEqual(res.cookies, ['refreshToken']);
});

test('phone reset refuses a weak password, the same password, and a wrong current password', async t => {
    const lookup = t.mock.method(User, 'findOne', async () => ({
        async comparePassword() { return false; }
    }));
    const weak = response();
    await recovery.resetPasswordByPhone({
        body: { userId: 'member1', phone: '01012345678', currentPassword: 'OldPassword1!', newPassword: 'short' }
    }, weak);
    assert.equal(weak.code, 400);
    assert.equal(lookup.mock.callCount(), 0);

    const same = response();
    await recovery.resetPasswordByPhone({
        body: { userId: 'member1', phone: '01012345678', currentPassword: 'NewPassword1!', newPassword: 'NewPassword1!' }
    }, same);
    assert.equal(same.code, 400);

    const wrong = response();
    await recovery.resetPasswordByPhone({
        body: { userId: 'member1', phone: '01012345678', currentPassword: 'WrongPassword1!', newPassword: 'NewPassword1!' }
    }, wrong);
    assert.equal(wrong.code, 401);

    lookup.mock.mockImplementation(async () => null);
    const missing = response();
    await recovery.resetPasswordByPhone({
        body: { userId: 'member1', phone: '01012345678', currentPassword: 'OldPassword1!', newPassword: 'NewPassword1!' }
    }, missing);
    assert.equal(missing.code, 404);
});
