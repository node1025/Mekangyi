const { Schema, ObjectId, createModel } = require('./mariaSchema');

// 장바구니 정보 스키마 정의
const cartSchema = new Schema({
  userId: {             // 사용자 아이디
    type: ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  items: [{
    productId: {        // 상품 기본 정보 참조
      type: ObjectId,
      ref: 'Product',
      required: true
    },
    variantId: {        // 상품 옵션 정보 (색상, 옵션 등)
      type: ObjectId,
      ref: 'ProductVariant',
      required: true
    },
    size: {             // 선택한 사이즈
      type: String,
      required: true
    },
    quantity: {         // 담은 수량
      type: Number,
      required: true,
      min: [1, '수량은 최소 1개 이상이어야 합니다.'],
      default: 1
    },
    price: {            // 담을 당시의 가격
      type: Number,
      required: true
    }
  }]
}, { timestamps: true });

// Cart 모델 생성 후 외부에서 사용
module.exports = require('./mariaRepository')(createModel('Cart', cartSchema));
