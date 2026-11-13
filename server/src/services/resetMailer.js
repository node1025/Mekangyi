const nodemailer = require('nodemailer');

exports.getSettings = () => {
    const { SMTP_HOST, SMTP_USER, SMTP_PASSWORD, SMTP_FROM, FRONTEND_URL } = process.env;
    if (process.env.RESET_MAIL_MODE === 'local') {
        const frontend = new URL(FRONTEND_URL);
        if (process.env.NODE_ENV !== 'development' || !['localhost','127.0.0.1','[::1]'].includes(frontend.hostname) ||
            frontend.protocol !== 'http:' || frontend.username || frontend.password || frontend.search || frontend.hash) {
            throw new Error('LOCAL_RESET_MAIL_DEVELOPMENT_ONLY');
        }
        return { local: true, frontend: frontend.href.replace(/\/+$/, ''), from: 'bukangi@localhost' };
    }
    const port = Number(process.env.SMTP_PORT || 587);
    if (!SMTP_HOST || !SMTP_USER || !SMTP_PASSWORD || !SMTP_FROM || !FRONTEND_URL ||
        !Number.isInteger(port) || port < 1 || port > 65535) {
        throw new Error('PASSWORD_RESET_MAIL_NOT_CONFIGURED');
    }
    const frontend = new URL(FRONTEND_URL);
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(frontend.hostname);
    if (frontend.username || frontend.password || frontend.search || frontend.hash ||
        (frontend.protocol !== 'https:' && !(process.env.NODE_ENV !== 'production' && local && frontend.protocol === 'http:'))) {
        throw new Error('PASSWORD_RESET_FRONTEND_URL_INVALID');
    }
    return {
        frontend: frontend.href.replace(/\/+$/, ''),
        from: SMTP_FROM,
        transport: {
            host: SMTP_HOST,
            port,
            secure: port === 465,
            requireTLS: port !== 465,
            auth: { user: SMTP_USER, pass: SMTP_PASSWORD },
            connectionTimeout: 10000,
            greetingTimeout: 10000,
            socketTimeout: 15000,
            disableFileAccess: true,
            disableUrlAccess: true
        }
    };
};

exports.sendResetLink = async ({ email, token }, settings) => {
    // A fragment keeps the bearer token out of HTTP request paths and referrers.
    const link = `${settings.frontend}/reset-password#token=${encodeURIComponent(token)}`;
    if (settings.local) {
        if (process.env.NODE_ENV !== 'development' || process.env.RESET_MAIL_MODE !== 'local') throw new Error('LOCAL_RESET_MAIL_DEVELOPMENT_ONLY');
        require('./localMail').createStore().save({ to: email, subject: '[부캉이] 비밀번호 재설정 안내', link });
        return;
    }
    const transport = nodemailer.createTransport(settings.transport);
    const result = await transport.sendMail({
        from: settings.from,
        to: email,
        subject: '[부캉이] 비밀번호 재설정 안내',
        text: [
            '아래 링크에서 비밀번호를 변경해주세요. 링크는 15분 동안 한 번만 사용할 수 있습니다.',
            '', link, '',
            '직접 요청하지 않았다면 이 메일을 무시해주세요. 링크를 사용하기 전에는 비밀번호가 변경되지 않습니다.'
        ].join('\n')
    });
    if (!result.accepted?.length) throw new Error('PASSWORD_RESET_MAIL_REJECTED');
};
