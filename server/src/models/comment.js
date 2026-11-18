const { Schema, ObjectId, createModel } = require('./mariaSchema');

// 댓글 스키마 정의
const commentSchema = new Schema({
    boardId: {  // 게시글의 ID
        type: ObjectId,
        ref: 'Board',
        required: true
    },
    author: {   // 작성자
        type: ObjectId,
        ref: 'User',
        required: true
    },
    content: {  // 내용
        type: String,
        required: true
    },
}, { timestamps: true });

// Comment 모델 생성 후 외부에서 사용
module.exports = require('./mariaRepository')(createModel('Comment', commentSchema));
