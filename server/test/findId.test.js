const { test } = require('node:test');
const assert = require('node:assert/strict');
const User = require('../src/models/user');
const mailer = require('../src/services/resetMailer');
const { findId } = require('../src/controllers/findIdController');
const response = () => ({ status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } });
test('ID recovery mails only the stored address and never exposes account data', async t => {
    t.mock.method(mailer, 'getSettings', () => ({}));
    const lookup = t.mock.method(User, 'findOne', async query => {
        assert.deepEqual(query, { name: 'Member', phone: '01012345678', isActivated: true });
        return { email: 'stored@example.com', userId: 'private-id' };
    });
    const send = t.mock.method(mailer, 'sendAccountId', async payload => assert.deepEqual(payload, { email: 'stored@example.com', userId: 'private-id' }));
    const found = response();
    await findId({ body: { name: ' Member ', phone: '010-1234-5678' } }, found);
    assert.equal(found.code, 202);
    assert.deepEqual(Object.keys(found.body), ['message']);
    assert.equal(send.mock.callCount(), 1);
    lookup.mock.mockImplementation(async () => null);
    const missing = response();
    await findId({ body: { name: 'Unknown', email: 'none@example.com' } }, missing);
    assert.deepEqual(missing, { ...missing, code: found.code, body: found.body });
    assert.equal(send.mock.callCount(), 1);
});
test('ID recovery rejects object injection and ambiguous contacts before lookup', async t => {
    const lookup = t.mock.method(User, 'findOne', async () => { throw new Error('must not query'); });
    for (const body of [{ name: {}, email: 'a@example.com' }, { name: 'A', email: { $ne: null } }, { name: 'A', email: 'a@example.com', phone: '01012345678' }]) {
        const res = response(); await findId({ body }, res); assert.equal(res.code, 400);
    }
    assert.equal(lookup.mock.callCount(), 0);
});
