const express = require('express'); // Express 모듈 불러오기
const router = express.Router();    // Express 라우터 생성
const reviewController = require('../controllers/reviewController');
const { authMiddleware, isAdmin } = require('../middleware/authMiddleware');
const upload = require('../middleware/multerConfig'); 

// 리뷰 작성 (로그인 필요, 이미지 최대 3장 업로드 가능)
router.post('/', authMiddleware, upload.array('images', 3), reviewController.createReview);

// 상품별 리뷰 조회 (누구나 가능)
router.get('/product/:productId', reviewController.getProductReviews);

// 관리자용 전체 리뷰 조회 (관리자 전용)
router.get('/admin/all', authMiddleware, isAdmin, reviewController.getAllReviewsForAdmin);

// 리뷰 삭제 (관리자 전용)
router.delete('/:reviewId', authMiddleware, isAdmin, reviewController.deleteReview);

module.exports = router;