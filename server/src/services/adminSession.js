const { createHash, randomBytes } = require('node:crypto');
const User = require('../models/user');
const AdminSession = require('../models/adminSession');
const maria = require('../config/maria');
const adminNetwork = require('../middleware/adminNetwork');
const COOKIE = 'bukang_admin_session';
const DURATION = 15 * 60000;
const hash = value => createHash('sha256').update(value).digest('hex');
const bearer = req => req.header('Authorization')?.replace(/^Bearer /, '') || '';
const cookieOptions = () => ({ httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production', path: '/api' });
async function verify(req) {
  if (!adminNetwork.allowed(req)) return null;
  if (req.user?.role !== 'admin') return null;
  const token = req.cookies?.[COOKIE];
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) return null;
  const session = await AdminSession.findOne({ tokenHash: hash(token), userId: req.user.id, expiresAt: { $gt: new Date() } });
  if (!session || session.accessTokenHash !== hash(bearer(req))) return null;
  const user = await User.findById(req.user.id);
  if (!user || user.role !== 'admin' || !user.isActivated || session.passwordFingerprint !== hash(user.password)) return null;
  return session;
}
exports.requireAdmin = async (req, res, next) => {
  try {
    const session = await verify(req);
    if (!session) return res.status(403).json({ code: 'ADMIN_REAUTH_REQUIRED', message: '관리자 전용 로그인에서 다시 인증해주세요.' });
    req.adminVerified = true; req.adminSession = session;
    res.set('Cache-Control', 'no-store');
    next();
  } catch { res.status(503).json({ message: '관리자 인증을 확인할 수 없습니다. 잠시 후 다시 시도해주세요.' }); }
};
exports.optionalAdmin = async (req, res, next) => {
  try { req.adminVerified = Boolean(await verify(req)); next(); }
  catch { res.status(503).json({ message: '관리자 인증을 확인할 수 없습니다.' }); }
};
exports.ifAdmin = (req, res, next) => req.user?.role === 'admin' ? exports.requireAdmin(req, res, next) : next();
exports.create = async (req, res) => {
  res.set('Cache-Control', 'no-store');
  if (!adminNetwork.allowed(req)) return res.status(403).json({ message: '허용된 관리자 네트워크에서 접속해주세요.' });
  const { userId, password } = req.body || {};
  if (typeof userId !== 'string' || typeof password !== 'string' || Buffer.byteLength(password) > 72) return res.status(400).json({ message: '관리자 아이디와 비밀번호를 입력해주세요.' });
  try {
    const user = await User.findById(req.user.id);
    if (!user || req.user.role !== 'admin' || user.role !== 'admin' || !user.isActivated || user.userId !== userId || !(await user.comparePassword(password))) {
      return res.status(403).json({ message: '관리자 인증 정보를 확인해주세요.' });
    }
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + DURATION);
    await maria.transaction(async session => {
      // Lock the account so parallel reauthentication cannot leave multiple sessions behind.
      const current = await User.findById(user._id).session(session);
      if (!current || current.role !== 'admin' || !current.isActivated || current.password !== user.password) throw new Error('Account changed');
      await AdminSession.deleteMany({ userId: user._id }).session(session);
      await AdminSession.create({ userId: user._id, tokenHash: hash(token), accessTokenHash: hash(bearer(req)), passwordFingerprint: hash(user.password), expiresAt }, { session });
    });
    res.cookie(COOKIE, token, { ...cookieOptions(), maxAge: DURATION });
    res.status(200).json({ message: '관리자 인증을 완료했습니다.', expiresAt });
  } catch { res.status(503).json({ message: '관리자 로그인을 완료하지 못했습니다.' }); }
};
exports.destroy = async (req, res) => {
  res.set('Cache-Control', 'no-store');
  try {
    const token = req.cookies?.[COOKIE];
    if (typeof token === 'string') await AdminSession.deleteOne({ userId: req.user.id, tokenHash: hash(token) });
    res.clearCookie(COOKIE, cookieOptions());
    res.json({ message: '관리자 세션을 종료했습니다.' });
  } catch { res.status(503).json({ message: '관리자 세션을 종료하지 못했습니다.' }); }
};
exports.inspect = (req, res) => res.json({ authorized: true, expiresAt: req.adminSession.expiresAt });
