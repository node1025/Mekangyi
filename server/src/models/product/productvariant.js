const { Schema, ObjectId, createModel } = require('../mariaSchema');

// 상품 옵션 스키마 정의
const productVariantSchema = new Schema({
  productId: {      // 상품 기본 정보 참조
    type: ObjectId,
    ref: 'Product',
    required: true
  },

  variantCode: {    // 상품 옵션 코드
    type: String,
    required: true,
    unique: true
  },

  color: {          // 색상 정보
    type: String,
    required: true
  },

  images: {
    thumbnail: { type: String, required: true },
    gallery: [{ type: String }]
  },

  isDeleted: {      // 논리적 삭제 여부
    type: Boolean,
    default: false
  }

}, { timestamps: true });

// ProductVariant 모델 생성 후 외부에서 사용
module.exports = require('../mariaRepository')(createModel('ProductVariant', productVariantSchema));
