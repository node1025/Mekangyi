const express = require('express'); // Express 모듈 불러오기
const router = express.Router();    // Express 라우터 생성
const cartController = require('../controllers/cartController');                // 장바구니 관련 컨트롤러
const { authMiddleware } = require('../middleware/authMiddleware');             // 로그인 인증 미들웨어

/** ------------------------------------------------
 * 사용자 라우트 (로그인 필요)
 * ------------------------------------------------ */

// [POST] 장바구니에 상품 추가
router.post('/', authMiddleware, cartController.addToCart);

// [GET] 내 장바구니 목록 조회
router.get('/', authMiddleware, cartController.getCart);

// [PATCH] 장바구니 상품 수량 변경
router.patch('/', authMiddleware, cartController.updateQuantity);

// [DELETE] 장바구니 특정 항목 삭제 (itemId: 장바구니 항목 ID)
router.delete('/:itemId', authMiddleware, cartController.removeItem);

// [DELETE] 장바구니 전체 비우기
router.delete('/all/clear', authMiddleware, cartController.clearCart);

module.exports = router;