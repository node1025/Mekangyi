const User = require('../models/user');

const passwordPattern = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[!@#$%^&*]).{10,}$/;
const notFound = '일치하는 회원 정보가 없습니다.';

function digits(value) {
    return typeof value === 'string' ? value.replace(/\D/g, '') : '';
}

function validName(name) {
    return typeof name === 'string' && name.trim().length > 0 && name.length <= 100;
}

function validPhone(phone) {
    return /^\d{10,11}$/.test(digits(phone));
}

function validPassword(password) {
    return typeof password === 'string' && Buffer.byteLength(password, 'utf8') <= 72 && passwordPattern.test(password);
}

function validUserId(userId) {
    return typeof userId === 'string' && /^[a-zA-Z0-9]{4,16}$/.test(userId.trim());
}

function maskUserId(userId) {
    const id = String(userId);
    if (id.length <= 2) return `${id.slice(0, 1)}*`;
    const hidden = Math.max(2, id.length - 3);
    return `${id.slice(0, 2)}${'*'.repeat(hidden)}${id.slice(-1)}`;
}

async function findActiveMember(userId, phone) {
    return User.findOne({
        userId: userId.trim(),
        phone: digits(phone),
        role: 'user',
        isActivated: true
    });
}

// 이름과 휴대폰이 일치하면 아이디 일부만 보여준다.
exports.findEmail = async (req, res) => {
    const { name, phone } = req.body || {};
    if (!validName(name) || !validPhone(phone)) {
        return res.status(400).json({ message: '이름과 휴대폰 번호를 정확히 입력해주세요.' });
    }
    try {
        const user = await User.findOne({
            name: name.trim(),
            phone: digits(phone),
            role: 'user',
            isActivated: true
        });
        if (!user) return res.status(404).json({ message: notFound });
        return res.json({ userId: maskUserId(user.userId) });
    } catch (error) {
        console.error('아이디 찾기 실패:', error.code || error.name || 'Error');
        return res.status(503).json({ message: '아이디 찾기를 완료하지 못했습니다. 잠시 후 다시 시도해주세요.' });
    }
};

exports.verifyAccount = async (req, res) => {
    const { userId, phone } = req.body || {};
    if (!validUserId(userId) || !validPhone(phone)) {
        return res.status(400).json({ message: '아이디와 휴대폰 번호를 정확히 입력해주세요.' });
    }
    try {
        const user = await findActiveMember(userId, phone);
        if (!user) return res.status(404).json({ message: notFound });
        return res.json({ message: '회원 정보가 확인되었습니다.' });
    } catch (error) {
        console.error('비밀번호 찾기 확인 실패:', error.code || error.name || 'Error');
        return res.status(503).json({ message: '회원 확인을 완료하지 못했습니다. 잠시 후 다시 시도해주세요.' });
    }
};

// 아이디·휴대폰·현재 비밀번호가 맞으면 이메일 인증 없이 새 비밀번호를 저장한다.
exports.resetPasswordByPhone = async (req, res) => {
    const { userId, phone, currentPassword, newPassword } = req.body || {};
    if (!validUserId(userId) || !validPhone(phone) || typeof currentPassword !== 'string' || !currentPassword) {
        return res.status(400).json({ message: '아이디, 휴대폰 번호, 현재 비밀번호를 정확히 입력해주세요.' });
    }
    if (!validPassword(newPassword)) {
        return res.status(400).json({ message: '비밀번호는 영문, 숫자, 특수문자(!@#$%^&*)를 포함한 10자 이상, UTF-8 기준 72바이트 이하로 입력해주세요.' });
    }
    if (currentPassword === newPassword) {
        return res.status(400).json({ message: '새 비밀번호는 현재 비밀번호와 다르게 설정해야 합니다.' });
    }
    try {
        const user = await findActiveMember(userId, phone);
        if (!user) return res.status(404).json({ message: notFound });
        const matched = await user.comparePassword(currentPassword);
        if (!matched) return res.status(401).json({ message: '현재 비밀번호가 일치하지 않습니다.' });
        user.password = newPassword;
        user.refreshToken = undefined;
        await user.save();
        res.clearCookie('refreshToken');
        return res.json({ message: '비밀번호가 변경되었습니다. 다시 로그인해주세요.' });
    } catch (error) {
        if (error.name === 'ValidationError') return res.status(400).json({ message: '비밀번호 규격을 확인해주세요.' });
        console.error('휴대폰 비밀번호 변경 실패:', error.code || error.name || 'Error');
        return res.status(503).json({ message: '비밀번호 변경을 완료하지 못했습니다. 잠시 후 다시 시도해주세요.' });
    }
};
