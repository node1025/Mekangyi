const { Schema, createModel } = require('../mariaSchema');
const { salePriceFromProduct } = require('../../utils/productPricing');

// 상품 정보 스키마 정의
const productSchema = new Schema({
  name: {             // 상품명
    ko: { type: String, required: true },
    en: { type: String }
  },

  productCode: {      // 상품코드
    type: String,
    required: true,
    unique: true
  },

  category: {         // 카테고리
    type: String,
    required: true,
    default: 'Accessories'
  },

  basePrice: {        // 정가
    type: Number,
    required: true,
    min: 0,
    validate: { validator: Number.isSafeInteger, message: '가격은 0 이상의 정수여야 합니다.' }
  },

  discountRate: {     // 할인율 (적용 시점은 priceMode에 따름)
    type: Number,
    default: 0,
    min: [0, '할인율은 0% 이상이어야 합니다.'],
    max: [100, '할인율은 100%를 초과할 수 없습니다.']
  },

  /** 정가만(regular) | 상시 할인(always) | 이벤트 기간에만(event) */
  priceMode: {
    type: String,
    enum: ['regular', 'always', 'event'],
    default: 'regular'
  },

  /** priceMode === 'event' 일 때 할인 적용 시작·종료 (포함 구간, 서버 시각 기준) */
  eventDiscountStart: { type: Date, default: null },
  eventDiscountEnd: { type: Date, default: null },

  finalPrice: {       // 최종 판매가 (정가-할인)
    type: Number,
    default: 0
  },

  description: { type: String, trim: true, maxlength: 4000, default: '' },

  material: {         // 제품 소재
    type: String,
    required: true
  },

  origin: {           // 원산지
    type: String,
    default: '대한민국'
  },

  careInstructions: { // 취급 시 주의사항
    type: String
  },

  status: {           // 판매 상태
    type: String,
    enum: ['판매중', '품절', '중단'],
    default: '판매중'
  },

  metrics: {          // 상품 통계 정보
    viewCount: { type: Number, default: 0 }, // 조회 수
    salesCount: { type: Number, default: 0 } // 판매 수량
  },

  rating: {           // 상품 평점 정보
    avg: { type: Number, default: 0 },  // 평균 평점
    count: { type: Number, default: 0 } // 평점 수
  },

  isDeleted: {        // 논리적 삭제 여부
    type: Boolean,
    default: false
  }

}, { timestamps: true });

productSchema.pre('validate', function(next) {
  if (this.priceMode === 'event' && Number(this.discountRate) > 0 &&
      this.eventDiscountStart != null && this.eventDiscountEnd != null) {
    const start = new Date(this.eventDiscountStart).getTime();
    const end = new Date(this.eventDiscountEnd).getTime();
    if (Number.isFinite(start) && Number.isFinite(end) && end <= start) {
      const err = Object.assign(new Error('eventDiscountEnd: 이벤트 종료 시각은 시작 시각보다 이후여야 합니다.'), {
        name: 'ValidationError',
        errors: { eventDiscountEnd: { message: '이벤트 종료 시각은 시작 시각보다 이후여야 합니다.' } }
      });
      if (typeof next === 'function') return next(err);
      throw err;
    }
  }
  if (typeof next === 'function') next();
});

// 가격·할인·모드·이벤트 기간 변경 시 저장 시점 기준 최종가 계산
productSchema.pre('save', function(next) {
  if (this.basePrice != null) {
    this.finalPrice = salePriceFromProduct(this, new Date());
  }
  if (typeof next === 'function') next();
});

// Product 모델 생성 후 외부에서 사용
module.exports = require('../mariaRepository')(createModel('Product', productSchema));
