const { Schema, ObjectId, createModel } = require('../mariaSchema');

// 상품 재고(Variant) 스키마 정의
const inventorySchema = new Schema({
  variantId: {      // 상품 옵션 ID
    type: ObjectId,
    ref: 'ProductVariant',
    required: true
  },

  sku: {            // 재고 식별 코드
    type: String,
    required: true,
    unique: true
  },

  size: {           // 옵션 사이즈 (프리, S/M/L 등)
    type: String,
    required: true
  },

  stockQuantity: {  // 재고 수량
    type: Number,
    default: 0,
    min: [0, '재고는 0개 미만이 될 수 없습니다.'],
    validate: { validator: Number.isSafeInteger, message: '재고는 0 이상의 정수여야 합니다.' }
  }
}, { timestamps: true });

inventorySchema.index({ variantId: 1, size: 1 }, { unique: true });

// Inventory 모델 생성 후 외부에서 사용
module.exports = require('../mariaRepository')(createModel('Inventory', inventorySchema));
