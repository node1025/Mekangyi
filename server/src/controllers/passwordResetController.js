const maria = require('../config/maria');
const { randomBytes, randomInt, createHash } = require('node:crypto');
const User = require('../models/user');
const PasswordReset = require('../models/passwordReset');
const mailer = require('../services/resetMailer');

const acceptedMessage = '입력하신 정보와 일치하는 회원이 있으면 등록된 이메일로 인증번호를 보내드립니다. 메일함과 스팸함을 확인해주세요.';
const invalidMessage = '유효하지 않거나 만료된 인증입니다. 인증번호를 다시 요청해주세요.';
const hash = value => createHash('sha256').update(value).digest('hex');
const text = (value, max) => typeof value === 'string' && value.trim().length > 0 && value.length <= max;
const invalidToken = () => Object.assign(new Error(invalidMessage), { invalidResetToken: true });

exports.requestReset = async (req, res) => {
    const { userId, birthDate, email } = req.body || {};
    if (!text(userId, 100) || !text(email, 254) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
        typeof birthDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(birthDate) ||
        !Number.isFinite(Date.parse(birthDate)) || new Date(birthDate).toISOString().slice(0, 10) !== birthDate) {
        return res.status(400).json({ message: '아이디, 생년월일, 가입 이메일을 정확히 입력해주세요.' });
    }
    const challenge = randomBytes(32).toString('hex');

    let settings;
    try {
        settings = mailer.getSettings();
    } catch {
        return res.status(503).json({ message: '이메일 발송 설정을 확인 중입니다. 잠시 후 다시 시도해주세요.' });
    }

    let tokenHash;
    try {
        const user = await User.findOne({ userId: userId.trim(), birthDate: new Date(birthDate), email: email.trim(), isActivated: true });
        if (user) {
            const now = new Date();
            const code = String(randomInt(0, 1000000)).padStart(6, '0');
            tokenHash = hash(challenge);
            // The unique userId index also closes concurrent upsert/cooldown races.
            const record = await PasswordReset.findOneAndUpdate({
                userId: user._id,
                requestedAt: { $lte: new Date(now.getTime() - 60000) }
            }, { $set: {
                tokenHash,
                codeHash: hash(challenge + code),
                attempts: 0,
                verified: false,
                passwordFingerprint: hash(user.password),
                email: user.email,
                requestedAt: now,
                expiresAt: new Date(now.getTime() + 15 * 60000)
            } }, { upsert: true, new: true, runValidators: true });
            if (record) await mailer.sendResetCode({ email: user.email, code }, settings);
        }
    } catch (error) {
        // Avoid disclosing account existence through status, message or token data.
        // A cooldown collision must not remove the previous valid reset record.
        if (error.code !== 11000) {
            if (tokenHash) {
                await PasswordReset.deleteOne({ tokenHash }).catch(() => {});
            }
            console.error('비밀번호 인증번호 처리 실패:', error.code || error.name || 'Error');
        }
    }
    return res.status(202).json({ message: acceptedMessage, challenge });
};

// A transaction locks the challenge row and serializes the durable attempt counter.
exports.verifyCode = async (req, res) => {
    const { challenge, code } = req.body || {};
    if (typeof challenge !== 'string' || !/^[a-f0-9]{64}$/.test(challenge) || typeof code !== 'string' || !/^\d{6}$/.test(code)) {
        return res.status(400).json({ message: '6자리 인증번호를 정확히 입력해주세요.' });
    }
    try {
        const token = await maria.transaction(async session => {
            const record = await PasswordReset.findOne({ tokenHash: hash(challenge), verified: false, expiresAt: { $gt: new Date() } }).session(session);
            if (!record || record.attempts >= 5) return null;
            record.attempts += 1;
            if (record.codeHash !== hash(challenge + code)) {
                await record.save({ session });
                return null;
            }
            const token = randomBytes(32).toString('hex');
            record.tokenHash = hash(token);
            record.verified = true;
            record.codeHash = undefined;
            await record.save({ session });
            return token;
        });
        if (!token) return res.status(400).json({ message: '인증번호가 틀렸거나 만료되었습니다. 5회 실패했다면 다시 요청해주세요.' });
        return res.json({ token });
    } catch {
        return res.status(503).json({ message: '인증을 완료하지 못했습니다. 잠시 후 다시 시도해주세요.' });
    }
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
                tokenHash: hash(token), verified: true, expiresAt: { $gt: new Date() }
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
