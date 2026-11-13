const User = require('../models/user'); // User 스키마 불러오기
const AdminSession = require('../models/adminSession');
const jwt = require('jsonwebtoken');    // JWT 생성 및 검증을 위한 jsonwebtoken 모듈 불러오기
const { pick } = require('../utils/input');
const passwordResetController = require('./passwordResetController');
const { respondValidation, validateShippingAddressFields } = require('../utils/validationResponse');

const profileFields = ['name', 'email', 'phone', 'address', 'gender', 'birthDate'];
const publicUser = user => {
    const result = user.toObject();
    delete result.password;
    delete result.adminReauthPassword;
    delete result.refreshToken;
    return result;
};

// ⚠️ JWT 서명 및 검증에 사용되는 비밀 키 (.env 파일에 저장)
const { JWT_SECRET, JWT_REFRESH_SECRET } = process.env;

// 토큰 만료 시간 설정
const ACCESS_TOKEN_EXPIRATION = '1h';   // 1시간
const REFRESH_TOKEN_EXPIRATION = '7d';  // 7일

// [POST] 회원가입
exports.register = async (req, res) => {
    try {
        const newUser = new User(pick(req.body, ['userId', 'password', 'termsOfService', ...profileFields]));
        const user = await newUser.save();      // 저장 시 User 스키마의 pre('save') 훅이 실행되어 비밀번호가 bcrypt 해싱됨
        
        const responseUser = publicUser(user);
        delete responseUser.password;           // 비밀번호 필드 삭제

        res.status(201).json({
            message: '회원가입이 완료되었습니다.',
            user: responseUser
        });

    } catch (error) {
        if (error.name === 'ValidationError') {
            return respondValidation(res, error);
        }

        if (error.code === 11000) {             // MariaDB 유니크 인덱스(중복 키) — mysql errno 1062 → code 11000 (아이디 또는 이메일 중복)
            return res.status(400).json({
                message: '이미 사용 중인 아이디 또는 이메일입니다.'
            });
        }

        res.status(500).json({                  // 그 외 서버 오류
            message: '서버 에러로 회원가입에 실패했습니다.'
        });
    }
};

// [POST] 로그인
exports.login = async (req, res) => {
    const { userId, password } = req.body;
    if (typeof userId !== 'string' || typeof password !== 'string') {
        return res.status(400).json({ message: '아이디와 비밀번호를 입력해주세요.' });
    }
    try {
        const user = await User.findOne({ userId });    // userId로 사용자 찾기
        if (!user || !(await user.comparePassword(password))) {
            return res.status(401).json({ message: '아이디 또는 비밀번호가 올바르지 않습니다.' });
        }
        
        // Access Token 발급
        const accessToken = jwt.sign(
            { id: user._id, userId: user.userId, role: user.role },
            JWT_SECRET,
            { expiresIn: ACCESS_TOKEN_EXPIRATION }
        );
        // Refresh Token 발급
        const refreshToken = jwt.sign(
            { id: user._id },
            JWT_REFRESH_SECRET,
            { expiresIn: REFRESH_TOKEN_EXPIRATION }
        );

        user.lastLogin = new Date();        // 마지막 로그인 시간 갱신
        user.refreshToken = refreshToken;   // DB에 Refresh Token 저장
        await user.save();                  // save() 호출 시 훅은 비밀번호가 수정되지 않았으므로 건너뜀

        // Refresh Token을 HTTP-only 쿠키로 저장
        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',  // HTTPS에서만 전송
            maxAge: 1000 * 60 * 60 * 24 * 7                 // 7일
        });

        const responseUser = publicUser(user);
        delete responseUser.password;           // 비밀번호 제거

        res.status(200).json({
            message: '로그인 성공',
            accessToken,
            user: responseUser
        });

    } catch (error) {   // 서버 내부 오류
        res.status(500).json({
            message: '서버 에러로 로그인에 실패했습니다.'
        });
    }
};

// [POST] 토큰 갱신
exports.refreshToken = async (req, res) => {
    const refreshToken = req.cookies.refreshToken;  // HTTP-only 쿠키에 저장된 Refresh Token 추출
    if (!refreshToken) {                            // Refresh Token이 없는 경우 (로그인되지 않은 상태)
        return res.status(401).json({ message: 'Refresh Token이 없습니다.' });
    }

    try {
        const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET);   // Refresh Token 검증 및 디코딩
        const user = await User.findById(decoded.id);                   // 토큰에 담긴 사용자 ID로 사용자 조회

        if (!user || user.refreshToken !== refreshToken) {  // 사용자 없거나 DB에 저장된 Refresh Token과 불일치 시
            res.clearCookie('refreshToken');                // 클라이언트에 남아 있는 쿠키 제거
            return res.status(403).json({ message: '유효하지 않은 토큰입니다.' });
        }

        // 새로운 Access Token 발급
        const newAccessToken = jwt.sign(
            { id: user._id, userId: user.userId, role: user.role },
            JWT_SECRET,
            { expiresIn: ACCESS_TOKEN_EXPIRATION }
        );
        // Access Token 반환
        res.status(200).json({ accessToken: newAccessToken });

    } catch (error) {
        res.status(403).json({ message: '토큰이 만료되었습니다.' });
    }
};

// [GET] 프로필 조회
exports.getProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password -refreshToken');
        
        if (!user) {    // 사용자 정보가 없는 경우
            return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });
        }

        res.status(200).json({ user }); // 프로필 정보 반환
    } catch (error) {
        res.status(500).json({ message: '조회 실패' });
    }
};

// [PATCH] 프로필 수정
exports.updateProfile = async (req, res) => {
    try {
        // 사용자 ID 기준으로 프로필 수정
        const updates = pick(req.body, profileFields);
        if (updates.address && typeof updates.address === 'object') {
            updates.address = pick(updates.address, ['zipCode', 'basicAddress', 'detailAddress']);
        }
        if (!Object.keys(updates).length) {
            return res.status(400).json({ message: '수정 가능한 회원정보가 없습니다.' });
        }
        const user = await User.findByIdAndUpdate(req.user.id, { $set: updates }, { new: true, runValidators: true }).select('-password -refreshToken');
        if (!user) return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });
        res.status(200).json({ message: '수정 성공', user });
    } catch (error) {
        if (error.name === 'ValidationError') return respondValidation(res, error);
        res.status(500).json({ message: '수정 실패' });
    }
};

exports.updateShippingAddress = async (req, res) => {
    const input = req.body || {};
    const fields = ['receiver','phone','zipCode','basicAddress','detailAddress'];
    if (fields.some(key => input[key] !== undefined && typeof input[key] !== 'string')) return res.status(400).json({ message: '배송지 입력 형식을 확인해주세요.' });
    const address = Object.fromEntries(fields.map(key => [key, (input[key] || '').trim()]));
    address.phone = address.phone.replace(/-/g, '');
    const invalid = validateShippingAddressFields(address);
    if (invalid) return res.status(400).json(invalid);
    try {
        const user = await User.findByIdAndUpdate(req.user.id, { $set: { shippingAddress: address } }, { new: true, runValidators: true });
        if (!user) return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });
        return res.json({ message: '배송지를 저장했습니다.', shippingAddress: user.shippingAddress });
    } catch { return res.status(503).json({ message: '배송지를 저장하지 못했습니다. 다시 시도해주세요.' }); }
};

// [POST] 아이디 중복 확인
exports.checkId = async (req, res) => {
    try {
        const user = await User.findOne({ userId: req.body.userId });   // 요청으로 전달된 userId로 사용자 조회
        res.status(200).json({ isAvailable: !user });                   // user가 없으면 사용 가능 (true)
    } catch (error) {
        res.status(500).json({ message: '확인 실패' });
    }
};

// [PATCH] 비밀번호 수정 (로그인 된 상태)
exports.updatePassword = async (req, res) => {
    const userId = req.user.id;                         // 인증 미들웨어에서 설정한 로그인 사용자 ID
    const { currentPassword, newPassword } = req.body;  // 요청 바디에서 현재 비밀번호와 새 비밀번호 추출

    if (!currentPassword || !newPassword) {             // 필수 값 누락 시 요청 거부
        return res.status(400).json({ message: '현재 비밀번호와 새 비밀번호를 모두 입력해야 합니다.' });
    }

    try {
        const user = await User.findById(userId);       // 사용자 조회
        if (!user) return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });

        // 현재 비밀번호 확인
        const isMatch = await user.comparePassword(currentPassword);
        if (!isMatch) return res.status(401).json({ message: '현재 비밀번호가 일치하지 않습니다.' });

        if (currentPassword === newPassword) {          // 기존 비밀번호와 동일한 비밀번호로 변경하는 경우 방지
            return res.status(400).json({ message: '새 비밀번호는 현재 비밀번호와 다르게 설정해야 합니다.' });
        }

        user.password = newPassword;        // 새 비밀번호 설정 (save 호출 시 pre-save 훅에 의해 자동 해싱됨)
        user.refreshToken = undefined;      // 비밀번호 변경 시 보안을 위해 기존 리프레시 토큰 무효화
        await user.save();                  // 변경 사항 저장
        if (user.role === 'admin') {
            await AdminSession.deleteMany({ userId: user._id });
        }

        res.clearCookie('refreshToken');    // 클라이언트에 저장된 Refresh Token 쿠키 제거
        res.status(200).json({ message: '비밀번호가 변경되었습니다. 다시 로그인해 주세요.' });
    } catch (error) {
        if (error.name === 'ValidationError') return res.status(400).json({ message: '비밀번호 규격을 확인해주세요.' });
        res.status(500).json({ message: '비밀번호 변경 중 서버 에러가 발생했습니다.' });
    }
};

// [DELETE] 회원 탈퇴
exports.withdraw = async (req, res) => {
    const userId = req.user.id;     // 인증 미들웨어에서 주입된 로그인 사용자 ID
    const { password } = req.body;  // 탈퇴 재확인용 비밀번호

    if (!password) {                // 비밀번호 미입력 시 요청 거부
        return res.status(400).json({ message: '회원 탈퇴를 위해 비밀번호를 입력해야 합니다.' });
    }

    try {
        const user = await User.findById(userId);   // 사용자 조회
        if (!user) return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });

        // 비밀번호 확인
        const isMatch = await user.comparePassword(password);
        if (!isMatch) return res.status(401).json({ message: '비밀번호가 일치하지 않아 탈퇴할 수 없습니다.' });

        if (user.role === 'admin') {
            const adminCount = await User.countDocuments({ role: 'admin', isActivated: true });
            if (adminCount <= 1) {
                return res.status(400).json({ message: '마지막 관리자 계정은 삭제할 수 없습니다. 다른 관리자를 만든 뒤 시도해주세요.' });
            }
            await AdminSession.deleteMany({ userId: user._id });
        }

        await User.findByIdAndDelete(userId);   // 사용자 계정 삭제
        res.clearCookie('refreshToken');        // 클라이언트에 저장된 Refresh Token 쿠키 제거

        res.status(204).send();                 // 성공 시 데이터 없이 응답
    } catch (error) {
        res.status(500).json({ message: '회원 탈퇴 처리 중 서버 에러가 발생했습니다.' });
    }
};

// [POST] 아이디 찾기 (이름 + 이메일 or 휴대폰)
exports.findId = async (req, res) => {
    const { name, email, phone } = req.body;

    if (!name || (!email && !phone)) {  // 필수 입력값 검증
        return res.status(400).json({ message: '이름과 이메일 또는 휴대폰 번호를 입력해주세요.' });
    }

    try {
        const query = { name, $or: [] };    // 이름 + (이메일 또는 휴대폰) 조건으로 사용자 검색
        if (email) query.$or.push({ email });
        if (phone) query.$or.push({ phone });

        const user = await User.findOne(query);
        if (!user) {    // 일치하는 사용자 없음
            return res.status(404).json({ message: '일치하는 회원이 없습니다.' });
        }

        res.status(200).json({  // 아이디 및 가입일 반환
            userId: user.userId,
            joinDate: user.joinDate
        });
    } catch (error) {
        res.status(500).json({ message: '서버 에러가 발생했습니다.' });
    }
};

// [POST] 비밀번호 재설정을 위한 사용자 확인 (비로그인 상태)
exports.verifyForPassword = passwordResetController.requestReset;

// [PATCH] 비로그인 상태에서 비밀번호 재설정
exports.resetPasswordUnauthenticated = passwordResetController.resetPassword;

// [POST] 비밀번호 확인 (마이페이지 진입 전 등 비밀번호 재입력)
exports.verifyPassword = async (req, res) => {
    const { password } = req.body;
    const userId = req.user.id; // authMiddleware에서 주입된 정보

    try {
        const user = await User.findById(userId);               // 사용자 조회
        const isMatch = await user.comparePassword(password);   // 비밀번호 검증
        
        if (!isMatch) return res.status(401).json({ message: '비밀번호가 일치하지 않습니다.' });

        const responseUser = publicUser(user);
        delete responseUser.password;           // 민감 정보 제거
        res.status(200).json({ message: '인증 성공', user: responseUser });
    } catch (error) {
        res.status(500).json({ message: '서버 에러' });
    }
};
