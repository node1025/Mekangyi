const maria = require('../config/maria');
const { randomBytes, createHash } = require('node:crypto');
const User = require('../models/user');
const PasswordReset = require('../models/passwordReset');
const mailer = require('../services/resetMailer');

const acceptedMessage = '입력하신 정보와 일치하는 회원이 있으면 등록된 이메일로 재설정 링크를 보내드립니다. 메일함과 스팸함을 확인해주세요.';
const invalidMessage = '유효하지 않거나 만료된 링크입니다. 재설정 링크를 다시 요청해주세요.';
const hash = value => createHash('sha256').update(value).digest('hex');
const text = (value, max) => typeof value === 'string' && value.trim().length > 0 && value.length <= max;
const invalidToken = () => Object.assign(new Error(invalidMessage), { invalidResetToken: true });

exports.requestReset = async (req, res) => {
    const { name, email, phone } = req.body || {};
    if (!text(name, 100) || Boolean(email) === Boolean(phone) ||
        (email !== undefined && (!text(email, 254) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) ||
        (phone !== undefined && (!text(phone, 20) || !/^\d{10,11}$/.test(phone.replace(/-/g, ''))))) {
        return res.status(400).json({ message: '이름과 이메일 또는 휴대폰 번호를 정확히 입력해주세요.' });
    }

    let settings;
    try {
        settings = mailer.getSettings();
    } catch {
        return res.status(503).json({ message: '이메일 발송 설정을 확인 중입니다. 잠시 후 다시 시도해주세요.' });
    }

    let tokenHash;
    try {
        const query = { name: name.trim(), isActivated: true };
        if (email) query.email = email.trim();
        else query.phone = phone.replace(/-/g, '');
        const user = await User.findOne(query);
        if (user) {
            const now = new Date();
            const token = randomBytes(32).toString('hex');
            tokenHash = hash(token);
            // The unique userId index also closes concurrent upsert/cooldown races.
            const record = await PasswordReset.findOneAndUpdate({
                userId: user._id,
                requestedAt: { $lte: new Date(now.getTime() - 60000) }
            }, { $set: {
                tokenHash,
                passwordFingerprint: hash(user.password),
                email: user.email,
                requestedAt: now,
                expiresAt: new Date(now.getTime() + 15 * 60000)
            } }, { upsert: true, new: true, runValidators: true });
            if (record) await mailer.sendResetLink({ email: user.email, token }, settings);
        }
    } catch (error) {
        // Avoid disclosing account existence through status, message or token data.
        // A cooldown collision must not remove the previous valid reset record.
        if (error.code !== 11000) {
            if (tokenHash) {
                await PasswordReset.deleteOne({ tokenHash }).catch(() => {});
            }
            console.error('비밀번호 재설정 링크 처리 실패:', error.code || error.name || 'Error');
        }
    }
    return res.status(202).json({ message: acceptedMessage });
};

exports.resetPassword = async (req, res) => {
    const { token, newPassword } = req.body || {};
    if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) {
        return res.status(400).json({ message: invalidMessage });
    }
    // bcrypt only consumes 72 bytes. Match the current schema's complexity policy.
    if (typeof newPassword !== 'string' || Buffer.byteLength(newPassword, 'utf8') > 72 ||
        !/^(?=.*[A-Za-z])(?=.*\d)(?=.*[!@#$%^&*]).{10,}$/.test(newPassword)) {
        return res.status(400).json({ message: '비밀번호는 영문, 숫자, 특수문자(!@#$%^&*)를 포함한 10자 이상, UTF-8 기준 72바이트 이하로 입력해주세요.' });
    }

    try {
        await maria.transaction(async session => {
            // Token consumption and password change either commit together or roll back.
            const record = await PasswordReset.findOneAndDelete({
                tokenHash: hash(token), expiresAt: { $gt: new Date() }
            }).session(session);
            if (!record) throw invalidToken();
            const user = await User.findById(record.userId).session(session);
            if (!user || !user.isActivated || user.email !== record.email || hash(user.password) !== record.passwordFingerprint) {
                throw invalidToken();
            }
            user.password = newPassword;
            user.refreshToken = undefined;
            await user.save({ session }); // Preserve the existing validation and bcrypt hook.
        });
        res.clearCookie('refreshToken');
        return res.status(200).json({ message: '비밀번호가 변경되었습니다. 다시 로그인해주세요.' });
    } catch (error) {
        if (error.invalidResetToken) return res.status(400).json({ message: invalidMessage });
        if (error.name === 'ValidationError') return res.status(400).json({ message: '비밀번호 규격을 확인해주세요.' });
        console.error('비밀번호 재설정 저장 실패:', error.code || error.name || 'Error');
        return res.status(503).json({ message: '비밀번호 변경을 완료하지 못했습니다. 잠시 후 다시 시도해주세요.' });
    }
};
