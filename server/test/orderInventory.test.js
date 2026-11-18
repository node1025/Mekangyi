const { test } = require('node:test');
const assert = require('node:assert/strict');
const { normalizeItems, shippingAddress } = require('../src/services/orderInventory');
const gateway = require('../src/services/paymentGateway');
const Inventory = require('../src/models/product/inventory');

const item = { productId: '507f1f77bcf86cd799439011', variantId: '507f1f77bcf86cd799439012', size: '프리', quantity: 1 };

test('order quantities are positive safe integers and duplicate options are summed', () => {
  assert.equal(normalizeItems([item, { ...item, quantity: 2 }])[0].quantity, 3);
  for (const quantity of [0, -1, 1.5, '1', Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => normalizeItems([{ ...item, quantity }]));
  }
  assert.throws(() => normalizeItems([]));
  assert.throws(() => normalizeItems([{ ...item, productId: { $ne: '' } }]));
  assert.throws(() => normalizeItems([{ ...item, quantity: Number.MAX_SAFE_INTEGER }, item]));
  assert.equal(normalizeItems([{ ...item, price: 1 }])[0].price, undefined);
});

test('shipping data only contains supported text fields', () => {
  assert.deepEqual(shippingAddress({ receiver: ' Test ', phone: '01012345678', address: 'Seoul', role: 'admin' }), {
    receiver: 'Test', phone: '01012345678', address: 'Seoul', detailAddress: '', zipCode: ''
  });
  assert.throws(() => shippingAddress({ receiver: 'Test', phone: '01012345678' }));
});

test('payment confirmation requires matching paid KRW amount and payment ID', () => {
  const order = { orderId: 'ord_test', totalPrice: 12800 };
  const payment = { id: order.orderId, status: 'PAID', currency: 'KRW', amount: { total: 12800 } };
  gateway.verifyPaid(payment, order);
  for (const change of [{ status: 'READY' }, { currency: 'USD' }, { id: 'other' }, { amount: { total: 1 } }]) {
    assert.throws(() => gateway.verifyPaid({ ...payment, ...change }, order));
  }
});

test('restocking paid orders requires full cancellation at the payment gateway', () => {
  const order = { orderId: 'ord_test', status: 'paid' };
  gateway.verifyCancellation({ id: 'ord_test', status: 'CANCELLED' }, order);
  assert.throws(() => gateway.verifyCancellation({ id: 'ord_test', status: 'PAID' }, order));
  assert.throws(() => gateway.verifyCancellation({ id: 'ord_test', status: 'PARTIAL_CANCELLED' }, order));
  gateway.verifyCancellation(null, { ...order, status: 'pending' });
});

test('inventory schema rejects fractional and unsafe stock counts', async () => {
  for (const stockQuantity of [1.5, -1, Number.MAX_SAFE_INTEGER + 1]) {
    const row = new Inventory({ variantId: item.variantId, sku: 'TEST-FREE', size: '프리', stockQuantity });
    await assert.rejects(() => row.validate(), error => Boolean(error.errors?.stockQuantity));
  }
});
