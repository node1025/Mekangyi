const jwt = require('jsonwebtoken');    // jsonwebtoken 라이브러리 불러오기
const { JWT_SECRET } = process.env;     // 환경 변수에서 JWT 비밀 키 가져오기

/**
 * JWT 유효성을 검사하고 사용자 정보를 req.user에 추가하는 미들웨어
 * @param {object} req - Express 요청 객체
 * @param {object} res - Express 응답 객체
 * @param {function} next - 다음 미들웨어 함수
 */

const authMiddleware = (req, res, next) => {
    // Authorization 헤더 추출 (형식: "Bearer <JWT_TOKEN>")
    const authHeader = req.header('Authorization');

    // 인증 헤더 자체가 없는 경우
    if (!authHeader) {
        // 401 Unauthorized: 인증 정보가 제공되지 않음
        return res.status(401).json({ message: '접근 권한이 없습니다. (토큰 없음)' });
    }
    
    // "Bearer " 접두사를 제거하여 실제 JWT 토큰만 추출
    const token = authHeader.replace('Bearer ', '');
    
    try {
        // JWT 검증 및 복호화
        // 검증 성공 시 payload (예: userId, role, iat, exp)가 반환됨
        const decoded = jwt.verify(token, JWT_SECRET);
        
        // 복호화된 정보를 req.user에 저장하여 다음 미들웨어/라우터에서 사용 가능
        req.user = decoded;
        
        next(); // 다음 단계로 이동

    } catch (error) {
        // JWT가 만료되었거나 변조된 경우
        console.error('JWT 검증 실패:', error);
        // 403 Forbidden: 유효하지 않은 인증 정보
        res.status(403).json({ message: '유효하지 않거나 만료된 토큰입니다.' });
    }
};

// 관리자 권한 확인 미들웨어
const isAdmin = require('../services/adminSession').requireAdmin;

// 다른 파일에서 사용할 수 있도록 내보내기
module.exports = { authMiddleware, isAdmin };
