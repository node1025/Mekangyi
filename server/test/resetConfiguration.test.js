const { test } = require('node:test');
const assert = require('node:assert/strict');
const nodemailer = require('nodemailer');
const mailer = require('../src/services/resetMailer');

const configureMail = t => {
    const values = {
        NODE_ENV: 'development', SMTP_HOST: 'smtp.example.com', SMTP_PORT: '587',
        SMTP_USER: 'test-user', SMTP_PASSWORD: 'test-password', SMTP_FROM: 'shop@example.com',
        FRONTEND_URL: 'http://localhost:5173'
    };
    for (const [key, value] of Object.entries(values)) {
        const previous = process.env[key];
        process.env[key] = value;
        t.after(() => { if (previous === undefined) delete process.env[key]; else process.env[key] = previous; });
    }
};

test('SMTP uses required STARTTLS on 587 and implicit TLS on 465', t => {
    configureMail(t);
    const settings = mailer.getSettings();
    assert.equal(settings.transport.secure, false);
    assert.equal(settings.transport.requireTLS, true);
    assert.equal(settings.transport.disableFileAccess, true);
    process.env.SMTP_PORT = '465';
    assert.equal(mailer.getSettings().transport.secure, true);
});

test('production reset links require configured HTTPS and reject URL credentials', t => {
    configureMail(t);
    process.env.NODE_ENV = 'production';
    assert.throws(() => mailer.getSettings());
    process.env.FRONTEND_URL = 'https://shop.example.com/';
    assert.equal(mailer.getSettings().frontend, 'https://shop.example.com');
    for (const url of ['https://user:pass@shop.example.com', 'https://shop.example.com?token=abc', 'https://shop.example.com#abc', 'javascript:alert(1)']) {
        process.env.FRONTEND_URL = url;
        assert.throws(() => mailer.getSettings());
    }
});

test('reset email carries token in fragment and never uses an incoming Host header', async t => {
    configureMail(t);
    let message;
    t.mock.method(nodemailer, 'createTransport', options => {
        assert.equal(options.host, 'smtp.example.com');
        return { sendMail: async data => { message = data; return { accepted: [data.to] }; } };
    });
    const token = 'b'.repeat(64);
    await mailer.sendResetLink({ email: 'member@example.com', token }, mailer.getSettings());
    assert.equal(message.to, 'member@example.com');
    assert.ok(message.text.includes(`http://localhost:5173/reset-password#token=${token}`));
    assert.ok(!message.text.includes('?token='));
});

test('SMTP recipient rejection propagates so issued tokens can be cleaned up', async t => {
    configureMail(t);
    t.mock.method(nodemailer, 'createTransport', () => ({ sendMail: async () => ({ accepted: [] }) }));
    await assert.rejects(() => mailer.sendResetLink({ email: 'member@example.com', token: 'a'.repeat(64) }, mailer.getSettings()));
});

