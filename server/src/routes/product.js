const express = require('express'); // Express 모듈 불러오기
const router = express.Router();    // Express 라우터 생성
const productController = require('../controllers/productController');          // 상품 관련 컨트롤러
const { authMiddleware, isAdmin } = require('../middleware/authMiddleware');    // 인증 및 관리자 권한 확인 미들웨어
const upload = require('../middleware/multerConfig'); // 파일 업로드(Multer) 설정

/** ------------------------------------------------
 * 공개 라우트 (누구나 접근 가능)
 * ------------------------------------------------ */

// 전체 목록 조회
router.get('/', productController.getAllProducts);

// 상세 정보 조회
router.get('/:id', productController.getProductDetail);

/** ------------------------------------------------
 * 관리자 전용 라우트 (로그인 & 관리자 권한 필요)
 * ------------------------------------------------ */

// 상품 등록
router.post('/complex', authMiddleware, isAdmin, upload.product(), productController.createFullProduct);

// 상품 수정
router.patch('/:id', authMiddleware, isAdmin, upload.product(), productController.updateProduct);

// 상품 삭제
router.delete('/:id', authMiddleware, isAdmin, productController.deleteProduct);

module.exports = router;