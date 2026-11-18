const express = require('express'); // Express 모듈 불러오기
const router = express.Router();    // Express 라우터 생성
const authController = require('../controllers/authController');
const { authMiddleware } = require('../middleware/authMiddleware');
const { createLoginRateLimit } = require('../middleware/loginRateLimit');
const loginLimit = createLoginRateLimit();

/** ------------------------------------------------
 * 공개 라우트 (누구나 접근 가능)
 * ------------------------------------------------ */

const { createResetRateLimit } = require('../middleware/resetRateLimit');
const recoveryLimit = createResetRateLimit();
const noStore = (_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); };

router.post('/register', authController.register);          // 회원가입
router.post('/login', loginLimit, authController.login);                // 로그인
router.post('/token/refresh', authController.refreshToken); // 토큰 갱신
router.post('/check-id', authController.checkId);           // 아이디 중복 확인
router.post('/find-id', noStore, recoveryLimit, authController.findId);             // 아이디 안내 메일
router.post('/verify-for-password', noStore, recoveryLimit, authController.verifyForPassword);
router.post('/verify-reset-code', noStore, recoveryLimit, require('../controllers/passwordResetController').verifyCode);
router.patch('/reset-password-unauthenticated', noStore, recoveryLimit, authController.resetPasswordUnauthenticated);

/** ------------------------------------------------
 * 보호된 라우트 (로그인 시에만 접근 가능)
 * ------------------------------------------------ */

router.get('/profile', authMiddleware, authController.getProfile);              // 회원 정보 조회
router.patch('/profile', authMiddleware, authController.updateProfile);         // 회원 정보 수정
router.patch('/shipping-address', authMiddleware, authController.updateShippingAddress);
router.patch('/password', authMiddleware, authController.updatePassword);       // 비밀번호 변경
router.delete('/profile', authMiddleware, authController.withdraw);             // 회원 탈퇴
router.post('/verify-password', authMiddleware, authController.verifyPassword); // 비밀번호 재확인

module.exports = router;
