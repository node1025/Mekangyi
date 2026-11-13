const { isObjectIdOrHexString } = require('../models/mariaSchema');
const Product = require('../models/product/product');
const Variant = require('../models/product/productvariant');
const Inventory = require('../models/product/inventory');
const { salePriceFromProduct } = require('../utils/productPricing');
const { validateShippingAddressFields } = require('../utils/validationResponse');

const fail = (message, status = 400, errors) => {
  const error = Object.assign(new Error(message), { status });
  if (errors) error.errors = errors;
  return error;
};
const validId = value => typeof value === 'string' && isObjectIdOrHexString(value);

function normalizeItems(items) {
  if (!Array.isArray(items) || !items.length || items.length > 100) throw fail('주문 상품을 확인해주세요.');
  const grouped = new Map();
  for (const item of items) {
    if (!item || !validId(item.productId) || !validId(item.variantId) ||
        typeof item.size !== 'string' || !item.size.trim() || item.size.length > 30 ||
        !Number.isSafeInteger(item.quantity) || item.quantity < 1) throw fail('상품 옵션과 정수 수량을 확인해주세요.');
    const row = { productId: item.productId.toLowerCase(), variantId: item.variantId.toLowerCase(), size: item.size.trim(), quantity: item.quantity };
    const key = `${row.variantId}:${row.size}`;
    const existing = grouped.get(key);
    if (existing) {
      if (existing.productId !== row.productId || !Number.isSafeInteger(existing.quantity + row.quantity)) throw fail('주문 상품 구성이 올바르지 않습니다.');
      existing.quantity += row.quantity;
    } else grouped.set(key, row);
  }
  return [...grouped.values()].sort((a, b) => `${a.variantId}:${a.size}`.localeCompare(`${b.variantId}:${b.size}`));
}

function shippingAddress(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw fail('배송 정보를 입력해주세요.');
  const address = {
    receiver: typeof input.receiver === 'string' ? input.receiver.trim() : '',
    phone: typeof input.phone === 'string' ? input.phone.replace(/-/g, '').trim() : '',
    zipCode: typeof input.zipCode === 'string' ? input.zipCode.trim() : '',
    address: typeof input.address === 'string' ? input.address.trim() : '',
    detailAddress: typeof input.detailAddress === 'string' ? input.detailAddress.trim() : '',
  };
  const invalid = validateShippingAddressFields({
    receiver: address.receiver,
    phone: address.phone,
    zipCode: address.zipCode,
    address: address.address,
    detailAddress: address.detailAddress,
  });
  if (invalid) throw fail(invalid.message, 400, invalid.errors);
  return address;
}

async function quoteItems(input, session) {
  const items = normalizeItems(input);
  let subtotal = 0;
  for (const item of items) {
    const product = await Product.findOne({ _id: item.productId, isDeleted: false, status: '판매중' }).session(session);
    const variant = await Variant.findOne({ _id: item.variantId, productId: item.productId }).session(session);
    const inventory = await Inventory.findOne({ variantId: item.variantId, size: item.size }).session(session);
    if (!product || !variant || !inventory) throw fail('판매 가능한 상품 옵션이 아닙니다.', 409);
    if (!Number.isSafeInteger(inventory.stockQuantity) || inventory.stockQuantity < item.quantity) throw fail('상품 재고가 부족합니다.', 409);
    const unit = salePriceFromProduct(product);
    if (!Number.isSafeInteger(unit) || unit < 0) throw fail('상품 가격을 확인해주세요.', 409);
    item.price = unit;
    subtotal += item.price * item.quantity;
    if (!Number.isSafeInteger(subtotal)) throw fail('주문 금액이 허용 범위를 초과했습니다.');
  }
  const shippingFee = subtotal >= 50000 ? 0 : 2800;
  if (!Number.isSafeInteger(subtotal + shippingFee)) throw fail('주문 금액이 허용 범위를 초과했습니다.');
  return { items, shippingFee, totalPrice: subtotal + shippingFee };
}

async function applyStock(items, session, restore = false) {
  for (const item of normalizeItems(items.map(row => ({
    productId: row.productId.toString(), variantId: row.variantId.toString(), size: row.size, quantity: row.quantity
  })))) {
    const filter = { variantId: item.variantId, size: item.size,
      stockQuantity: { $gte: restore ? 0 : item.quantity, $lte: Number.MAX_SAFE_INTEGER - (restore ? item.quantity : 0) } };
    if (!restore) {
      const product = await Product.findOne({ _id: item.productId, isDeleted: false, status: '판매중' }).session(session);
      const variant = await Variant.findOne({ _id: item.variantId, productId: item.productId }).session(session);
      if (!product || !variant) throw fail('판매 가능한 상품 옵션이 아닙니다.', 409);
    }
    const updated = await Inventory.updateOne(filter, { $inc: { stockQuantity: restore ? item.quantity : -item.quantity } }, { session, runValidators: true });
    if (updated.matchedCount !== 1) throw fail(restore ? '복구할 재고 항목을 찾을 수 없습니다.' : '상품 재고가 부족합니다.', 409);
  }
}

module.exports = { fail, validId, normalizeItems, shippingAddress, quoteItems, applyStock };
