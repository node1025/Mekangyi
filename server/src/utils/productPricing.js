'use strict';

/** 100원 단위 절사 (기존 상품 가격 규칙과 동일) */
function roundTo100(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n / 100) * 100;
}

/**
 * 할인율을 적용한 판매가 (정가, 할인율 0~100)
 */
function priceWithDiscount(basePrice, discountRate) {
  const base = Number(basePrice);
  const rate = Number(discountRate);
  if (!Number.isFinite(base) || base < 0) return 0;
  if (!Number.isFinite(rate) || rate <= 0) return roundTo100(base);
  const clamped = Math.min(100, Math.max(0, rate));
  return roundTo100(base * (1 - clamped / 100));
}

function parseTime(value) {
  if (value == null || value === '') return NaN;
  const t = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isFinite(t) ? t : NaN;
}

/**
 * priceMode / 할인 기간에 따른 실제 적용 할인율 (0이면 정가 판매)
 */
function effectiveDiscountRate(product, at = new Date()) {
  if (!product || typeof product !== 'object') return 0;
  const mode = product.priceMode || 'regular';
  const rate = Number(product.discountRate);
  const safeRate = Number.isFinite(rate) ? Math.min(100, Math.max(0, rate)) : 0;

  if (mode === 'regular') return 0;
  if (mode === 'always') return safeRate;

  if (mode === 'event') {
    if (safeRate <= 0) return 0;
    const now = at instanceof Date ? at.getTime() : Date.parse(at);
    const start = parseTime(product.eventDiscountStart);
    const end = parseTime(product.eventDiscountEnd);
    if (!Number.isFinite(now) || !Number.isFinite(start) || !Number.isFinite(end)) return 0;
    if (end < start) return 0;
    return now >= start && now <= end ? safeRate : 0;
  }

  return safeRate;
}

/**
 * 현재 시점 기준 판매가 (주문·장바구니·API 응답 공통)
 */
function salePriceFromProduct(product, at = new Date()) {
  if (!product || typeof product !== 'object') return 0;
  const base = Number(product.basePrice);
  const rate = effectiveDiscountRate(product, at);
  return priceWithDiscount(base, rate);
}

/**
 * API/프론트용: plain 객체에 runtime 가격 필드 보강 (원본 불변)
 */
function enrichProductForResponse(product, at = new Date()) {
  if (!product || typeof product !== 'object') return product;
  const eff = effectiveDiscountRate(product, at);
  const sale = salePriceFromProduct(product, at);
  return {
    ...product,
    finalPrice: sale,
    effectiveDiscountRate: eff,
    isDiscountActive: eff > 0
  };
}

module.exports = {
  salePriceFromProduct,
  enrichProductForResponse
};
