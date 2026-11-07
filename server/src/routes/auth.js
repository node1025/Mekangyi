const express = require('express'); // Express 모듈 불러오기
const router = express.Router();    // Express 라우터 생성
const authController = require('../controllers/authController');
const { authMiddleware } = require('../middleware/authMiddleware');
const { createLoginRateLimit } = require('../middleware/loginRateLimit');
const loginLimit = createLoginRateLimit();
const { createResetRateLimit } = require('../middleware/resetRateLimit');
const resetRequestLimit = createResetRateLimit();
const resetSubmitLimit = createResetRateLimit({ limit: 20 });
const preventResetCaching = (_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
};

/** ------------------------------------------------
 * 공개 라우트 (누구나 접근 가능)
 * ------------------------------------------------ */

router.post('/register', authController.register);          // 회원가입
router.post('/login', loginLimit, authController.login);                // 로그인
router.post('/token/refresh', authController.refreshToken); // 토큰 갱신
router.post('/check-id', authController.checkId);           // 아이디 중복 확인
router.post('/find-id', authController.findId);             // 아이디 찾기
router.post('/verify-for-password', preventResetCaching, resetRequestLimit, authController.verifyForPassword);
router.patch('/reset-password-unauthenticated', preventResetCaching, resetSubmitLimit, authController.resetPasswordUnauthenticated);

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
