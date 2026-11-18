const bcrypt = require('bcrypt');       // bcrypt 모듈 불러오기
const { Schema, createModel } = require('./mariaSchema');

// 회원 스키마 정의
const userSchema = new Schema({
    userId: {               // 사용자 아이디
        type: String,
        required: true,     // 필수 입력
        unique: true,       // 중복 불가
        minlength: 4,       // 최소 길이 4자
        maxlength: 16,      // 최대 길이 16자
        match: /^[a-zA-Z0-9]+$/,    // 영문자 + 숫자 조합만 가능
        trim: true          // 문자열 양쪽 공백 제거
    },
    password: {             // 1차 로그인 비밀번호
        type: String,
        required: true,
        minlength: 10,
        match: [            // 영문 + 숫자 + 특수문자 1개 이상 포함
            /^(?=.*[A-Za-z])(?=.*\d)(?=.*[!@#$%^&*]).{10,}$/,
            '비밀번호는 영문, 숫자, 특수문자를 포함해야 합니다.'
        ]
    },
    adminReauthPassword: {  // 관리자 2차 재인증 비밀번호 (관리자 role만 사용)
        type: String,
        required: false,
        minlength: 10,
        match: [
            /^(?=.*[A-Za-z])(?=.*\d)(?=.*[!@#$%^&*]).{10,}$/,
            '비밀번호는 영문, 숫자, 특수문자를 포함해야 합니다.'
        ]
    },
    name: {                 // 사용자 이름
        type: String,
        required: [true, '이름은 필수 입력 사항입니다.'],
        trim: true
    },
    email: {                // 이메일
        type: String,
        required: [true, '이메일은 필수 입력 사항입니다.'],
        unique: true,       // 중복 불가
        trim: true,
        match: [
            /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
            '유효한 이메일 주소를 입력해주세요.'
        ]
    },
    phone: {                // 휴대폰 번호
        type: String,
        required: [true, '휴대폰 번호는 필수 입력 사항입니다.']
    },
    address: {              // 주소 정보
        zipCode: {
            type: String,
            required: [true, '우편번호를 입력해주세요.']
        },
        basicAddress: {
            type: String,
            required: [true, '기본 주소를 입력해주세요. 주소 검색을 이용해주세요.']
        },
        detailAddress: {
            type: String,
            required: [true, '상세 주소를 입력해주세요.']
        }
    },
    shippingAddress: {
        receiver: { type: String },
        phone: { type: String },
        zipCode: { type: String },
        basicAddress: { type: String },
        detailAddress: { type: String }
    },
    gender: {               // 성별
        type: String,
        enum: ['male', 'female', 'none']
    },
    birthDate: {            // 생년월일
        type: Date,         // 'YYYY-MM-DD' 형식의 문자열을 Date 객체로 저장
        required: [true, '생년월일은 필수 입력 사항입니다.'],
        validate: {         // 사용자가 문자열로 보내도 Date.parse로 검사 가능
            validator: v => !isNaN(Date.parse(v)),
            message: '유효한 날짜를 입력해주세요.'
        }
    },
    termsOfService: {       // 약관 동의 정보
        agreeTermsOfService: {
            type: Boolean,
            required: true  // 필수 입력
        },
        agreePrivacyPolicy: {
            type: Boolean,
            required: true
        },
        agreeMarketing: {
            type: Boolean,
            default: false  // 선택 사항(기본값 false)
        }
    },

    refreshToken: {         // 리플레시 토큰(로그인 세션 관리용)
        type: String,
        required: false,    // 로그아웃 상태에서는 없음
        index: true,        // 조회 성능 향상
        unique: false,      // 한 사용자는 하나의 Refresh Token만 가질 수 있음
    },
    role: {                 // 사용자 권한
        type: String,
        default: 'user',    // 기본값 user
        enum: ['user', 'admin']
    },
    grade: {                // 회원 등급
        type: String,
        default: 'standard',
        enum: ['standard', 'premium', 'vip']
    },
    totalAmount: {          // 누적 구매 금액(회원 등급 산정 기준)
        type: Number,
        default: 0
    },
    points: {               // 사용 가능한 적립금
        type: Number,
        default: 0,
        min: 0              // 적립금이 마이너스가 되지 않도록 방지
    },
    joinDate: {             // 가입일
        type: Date,
        default: Date.now   // 가입 시점의 날짜로 자동 설정
    },
    lastLogin: {            // 마지막 로그인 시간
        type: Date
    },
    isActivated: {          // 계정 활성화 여부
        type: Boolean,
        default: true
    }
}, {
    timestamps: true        // createdAt, updatedAt 자동 생성
});

async function hashIfNeeded(instance, field) {
    if (!instance.isModified(field) || !instance[field]) return;
    const salt = await bcrypt.genSalt(10);
    instance[field] = await bcrypt.hash(instance[field], salt);
}

// 비밀번호 해싱
userSchema.pre('save', async function(next) {
    try {
        await hashIfNeeded(this, 'password');
        await hashIfNeeded(this, 'adminReauthPassword');
        if (typeof next === 'function') next();
    } catch (err) {
        if (typeof next === 'function') next(err);
        else throw err;
    }
});

// 1차 로그인 비밀번호 비교
userSchema.methods.comparePassword = async function(candidatePassword) {
    try {
        return await bcrypt.compare(candidatePassword, this.password);
    } catch (err) {
        throw new Error(err);
    }
};

// 관리자 2차 재인증 비밀번호 비교
userSchema.methods.compareAdminReauthPassword = async function(candidatePassword) {
    if (!this.adminReauthPassword) return false;
    try {
        return await bcrypt.compare(candidatePassword, this.adminReauthPassword);
    } catch (err) {
        throw new Error(err);
    }
};

// User 모델 생성 후 외부에서 사용
module.exports = require('./mariaRepository')(createModel('User', userSchema));
