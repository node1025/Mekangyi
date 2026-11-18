const { Schema, ObjectId, createModel } = require('./mariaSchema');

const orderSchema = new Schema({
  userId: { type: ObjectId, ref: 'User', required: true },

  items: [{ // 주문 상품 목록
    productId: { type: ObjectId, ref: 'Product', required: true },
    variantId: { type: ObjectId, ref: 'ProductVariant', required: true },
    size: { type: String, required: true },
    quantity: { type: Number, required: true },
    price: { type: Number, required: true },
    isReviewed: { type: Boolean, default: false }
  }],

  totalPrice: { type: Number, required: true }, // 주문 총 금액

  shippingFee: { type: Number, default: 0 },  // 배송비

  shippingAddress: {  // 배송 정보
    receiver: String,
    phone: String,
    address: String,
    detailAddress: String,
    zipCode: String
  },

  status: { // 주문 상태
    type: String,
    enum: ['pending', 'paid', 'shipping', 'delivered', 'cancelled'],
    default: 'pending'
  },

  paymentKey: String, // 결제 서비스에서 발급된 결제 키
  inventoryApplied: { type: Boolean, default: false },
  orderId: { type: String, unique: true }
}, { timestamps: true });

module.exports = require('./mariaRepository')(createModel('Order', orderSchema));
