const User = require('../models/user');
const mailer = require('../services/resetMailer');
const accepted = '입력하신 정보와 일치하는 회원이 있으면 등록된 이메일로 아이디를 보내드립니다. 메일함과 스팸함을 확인해주세요.';
exports.findId = async (req, res) => {
    const { name, email, phone } = req.body || {};
    if (typeof name !== 'string' || !name.trim() || name.length > 100 || Boolean(email) === Boolean(phone) ||
        (email !== undefined && (typeof email !== 'string' || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) ||
        (phone !== undefined && (typeof phone !== 'string' || phone.length > 20 || !/^\d{10,11}$/.test(phone.replace(/-/g, ''))))) {
        return res.status(400).json({ message: '이름과 이메일 또는 휴대폰 번호를 정확히 입력해주세요.' });
    }
    let settings;
    try { settings = mailer.getSettings(); }
    catch { return res.status(503).json({ message: '이메일 발송 설정을 확인 중입니다. 잠시 후 다시 시도해주세요.' }); }
    try {
        const query = { name: name.trim(), isActivated: true };
        if (email) query.email = email.trim();
        else query.phone = phone.replace(/-/g, '');
        const user = await User.findOne(query);
        if (user) await mailer.sendAccountId({ email: user.email, userId: user.userId }, settings);
    } catch (error) {
        console.error('아이디 안내 처리 실패:', error.code || error.name || 'Error');
    }
    return res.status(202).json({ message: accepted });
};
