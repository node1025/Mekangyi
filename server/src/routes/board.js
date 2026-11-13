const adminSessions = require('../services/adminSession');
const express = require('express'); // Express 모듈 불러오기
const router = express.Router();    // Express 라우터 생성
const boardController = require('../controllers/boardController');
const { authMiddleware } = require('../middleware/authMiddleware');
const upload = require('../middleware/multerConfig'); // 파일 업로드(Multer) 설정

// [GET] 게시글 목록 조회
router.get('/', boardController.getPosts);

// [GET] 게시글 상세 조회
router.get('/:id', (req, res, next) => req.header('Authorization') ? authMiddleware(req, res, next) : next(), adminSessions.optionalAdmin, boardController.getPostDetail);

// [POST] 게시글 작성 (로그인 필요)
router.post('/', authMiddleware, adminSessions.ifAdmin, upload.single('image'), boardController.createPost);

// [PATCH] 게시글 수정 (작성자 또는 관리자)
router.patch('/:id', authMiddleware, adminSessions.ifAdmin, boardController.authorizeManage, upload.single('image'), boardController.updatePost);

// [DELETE] 게시글 삭제 (작성자 또는 관리자)
router.delete('/:id', authMiddleware, adminSessions.ifAdmin, boardController.authorizeManage, boardController.deletePost);

// 댓글 작성
router.post('/:id/comments', authMiddleware, adminSessions.optionalAdmin, boardController.addComment);

module.exports = router;

