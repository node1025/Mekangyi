const { Schema, ObjectId, createModel } = require('./mariaSchema');

// 게시판 스키마 정의
const boardSchema = new Schema({
    title: {    // 제목
        type: String,
        required: [true, '제목을 입력해주세요.'],
        trim: true,
        maxlength: 100
    },
    content: {  // 내용
        type: String,
        required: [true, '내용을 입력해주세요.']
    },
    author: {   // 작성자
        type: ObjectId,
        ref: 'User',
        required: true
    },
    category: { // 커테고리
        type: String,
        enum: ['free', 'notice', 'qna', 'event'],
        default: 'free'
    },
    imageUrl: { type: String, default: null },
    views: {    // 조회수
        type: Number,
        default: 0
    },
    isPrivate: {    // 비밀글 여부
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

// Board 모델 생성 후 외부에서 사용
module.exports = require('./mariaRepository')(createModel('Board', boardSchema));
