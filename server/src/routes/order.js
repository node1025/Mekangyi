const express = require('express'); // Express 모듈 불러오기
const router = express.Router();    // Express 라우터 생성
const orderController = require('../controllers/orderController');              // 주문 관련 컨트롤러
const { authMiddleware, isAdmin } = require('../middleware/authMiddleware');    // 인증 및 관리자 권한 확인 미들웨어

/** ------------------------------------------------
 * 사용자 라우트 (로그인 필요)
 * ------------------------------------------------ */

// 주문 생성
router.post('/prepare', authMiddleware, orderController.prepareOrder);
router.post('/', authMiddleware, orderController.createOrder);

// 내 주문 목록 조회
router.get('/my', authMiddleware, orderController.getMyOrders);

/** ------------------------------------------------
 * 관리자 전용 라우트 (로그인 & 관리자 권한 필요)
 * ------------------------------------------------ */

// 전체 주문 목록 조회
router.get('/admin/all', authMiddleware, isAdmin, orderController.getAllOrders);

// 주문 상태 변경
router.patch('/:orderId/status', authMiddleware, isAdmin, orderController.updateOrderStatus);

// 주문 취소
router.delete('/:orderId', authMiddleware, isAdmin, orderController.cancelOrder);

module.exports = router;
