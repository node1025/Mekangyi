const User = require('../models/user');
const AdminSession = require('../models/adminSession');

// [PATCH] 관리자 2차(재인증) 비밀번호 변경 — 1차 로그인 JWT만 필요 (15분 재인증 세션 불필요)
exports.updateReauthPassword = async (req, res) => {
  const { loginPassword, currentReauthPassword, newReauthPassword } = req.body || {};

  if (typeof loginPassword !== 'string' || typeof newReauthPassword !== 'string') {
    return res.status(400).json({ message: '1차 로그인 비밀번호와 새 2차 비밀번호를 입력해주세요.' });
  }

  try {
    const user = await User.findById(req.user.id);
    if (!user || user.role !== 'admin' || !user.isActivated) {
      return res.status(403).json({ message: '관리자 계정만 변경할 수 있습니다.' });
    }

    if (!(await user.comparePassword(loginPassword))) {
      return res.status(401).json({ message: '1차 로그인 비밀번호가 일치하지 않습니다.' });
    }

    if (loginPassword === newReauthPassword) {
      return res.status(400).json({ message: '2차 비밀번호는 1차 로그인 비밀번호와 달라야 합니다.' });
    }

    if (await user.comparePassword(newReauthPassword)) {
      return res.status(400).json({ message: '2차 비밀번호는 1차 로그인 비밀번호와 달라야 합니다.' });
    }

    if (user.adminReauthPassword) {
      if (typeof currentReauthPassword !== 'string' || !currentReauthPassword) {
        return res.status(400).json({ message: '현재 2차 비밀번호를 입력해주세요.' });
      }
      if (!(await user.compareAdminReauthPassword(currentReauthPassword))) {
        return res.status(401).json({ message: '현재 2차 비밀번호가 일치하지 않습니다.' });
      }
      if (currentReauthPassword === newReauthPassword) {
        return res.status(400).json({ message: '새 2차 비밀번호는 현재와 달라야 합니다.' });
      }
      if (await user.compareAdminReauthPassword(newReauthPassword)) {
        return res.status(400).json({ message: '새 2차 비밀번호는 현재와 달라야 합니다.' });
      }
    }

    user.adminReauthPassword = newReauthPassword;
    await user.save();
    await AdminSession.deleteMany({ userId: user._id });

    res.status(200).json({
      message: '2차 재인증 비밀번호가 변경되었습니다. 관리자 기능을 쓰려면 재인증해주세요.'
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: '2차 비밀번호 규격을 확인해주세요.' });
    }
    res.status(500).json({ message: '2차 비밀번호 변경 중 오류가 발생했습니다.' });
  }
};
