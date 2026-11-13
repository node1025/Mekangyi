const { test } = require('node:test');
const assert = require('node:assert/strict');

test('real MariaDB inventory transactions', { skip: process.env.RUN_INVENTORY_INTEGRATION !== '1', timeout: 240000 }, async t => {
  const maria = require('../src/config/maria');
  const { ObjectId } = require('../src/models/mariaSchema');
  const Product = require('../src/models/product/product');
  const Variant = require('../src/models/product/productvariant');
  const Inventory = require('../src/models/product/inventory');
  const Order = require('../src/models/order');
  const Cart = require('../src/models/cart');
  const controller = require('../src/controllers/orderController');
  const productController = require('../src/controllers/productController');
  const gateway = require('../src/services/paymentGateway');
  t.after(() => maria.disconnect());
  await maria.connect(require('./mariaTestTarget.cjs')());
  await Promise.all([Product, Variant, Inventory, Order, Cart].map(model => model.init()));

  const buyer = new ObjectId().toString();
  const payments = new Map();
  t.mock.method(gateway, 'getPayment', async paymentId => {
    if (!payments.has(paymentId)) throw new Error('Unexpected gateway request');
    return payments.get(paymentId);
  });
  const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });
  const request = body => ({ body, user: { id: buyer }, params: {} });

  async function seed(stock = 5) {
    for (const model of [Cart, Order, Inventory, Variant, Product]) await model.deleteMany({});
    payments.clear();
    const product = await Product.create({ name: { ko: 'Test goods' }, productCode: 'TEST', basePrice: 10000, material: 'cotton' });
    const variant = await Variant.create({ productId: product._id, variantCode: 'TEST-STD', color: 'Default', images: { thumbnail: 'uploads/test.png' } });
    const row = await Inventory.create({ variantId: variant._id, sku: 'TEST-STD-FREE', size: '프리', stockQuantity: stock });
    const item = { productId: product.id, variantId: variant.id, size: '프리', quantity: 1, price: 1 };
    return { product, variant, row, item };
  }
  async function prepare(items) {
    const res = response();
    await controller.prepareOrder(request({
      items,
      shippingAddress: { receiver: 'Tester', phone: '01012345678', zipCode: '12345', address: 'Seoul', detailAddress: '101호' },
    }), res);
    assert.equal(res.statusCode, 201, JSON.stringify(res.body));
    const prepared = res.body;
    payments.set(prepared.paymentId, { id: prepared.paymentId, status: 'PAID', currency: 'KRW', amount: { total: prepared.totalPrice } });
    return prepared;
  }
  async function confirm(prepared, userId = buyer) {
    const res = response();
    await controller.createOrder({ body: { paymentId: prepared.paymentId, totalPrice: 1, items: [] }, user: { id: userId } }, res);
    return res;
  }
  async function cancel(orderId, viaDelete = false) {
    const res = response();
    const req = { params: { orderId }, body: { status: 'cancelled' } };
    await (viaDelete ? controller.cancelOrder : controller.updateOrderStatus)(req, res);
    return res;
  }

  await t.test('server prices a prepared order and confirmation changes size stock once', async () => {
    const { row, item } = await seed();
    const prepared = await prepare([{ ...item, quantity: 2 }]);
    assert.equal(prepared.totalPrice, 22800);
    assert.equal((await Inventory.findById(row._id)).stockQuantity, 5);
    const result = await confirm(prepared);
    assert.equal(result.statusCode, 201);
    assert.equal((await Inventory.findById(row._id)).stockQuantity, 3);
    assert.equal((await Order.findOne({ orderId: prepared.paymentId })).inventoryApplied, true);
    assert.equal((await confirm(prepared)).statusCode, 200);
    assert.equal((await Inventory.findById(row._id)).stockQuantity, 3);
  });

  await t.test('two paid buyers competing for the last unit cannot oversell', async () => {
    const { row, item } = await seed(1);
    const first = await prepare([item]);
    const second = await prepare([item]);
    const results = await Promise.all([confirm(first), confirm(second)]);
    assert.deepEqual(results.map(res => res.statusCode).sort(), [201, 409]);
    assert.equal((await Inventory.findById(row._id)).stockQuantity, 0);
    assert.equal(await Order.countDocuments({ status: 'paid' }), 1);
    assert.equal(results.find(res => res.statusCode === 409).body.requiresReconciliation, true);
  });

  await t.test('simultaneous confirmations of one payment deduct once', async () => {
    const { row, item } = await seed(2);
    const prepared = await prepare([item]);
    const results = await Promise.all([confirm(prepared), confirm(prepared)]);
    assert.deepEqual(results.map(res => res.statusCode).sort(), [200, 201]);
    assert.equal((await Inventory.findById(row._id)).stockQuantity, 1);
    assert.equal(await Order.countDocuments({ status: 'paid' }), 1);
  });

  await t.test('a shortage in a later item rolls back earlier deductions and order state', async () => {
    const { row, item, variant } = await seed();
    const other = await Inventory.create({ variantId: variant._id, sku: 'TEST-BLACK-260', size: '260', stockQuantity: 3 });
    const prepared = await prepare([item, { ...item, size: '260' }]);
    await Inventory.updateOne({ _id: other._id }, { $set: { stockQuantity: 0 } });
    assert.equal((await confirm(prepared)).statusCode, 409);
    assert.equal((await Inventory.findById(row._id)).stockQuantity, 5);
    assert.equal((await Order.findOne({ orderId: prepared.paymentId })).status, 'pending');
  });

  await t.test('cart failure rolls back stock, then same payment can be retried without another charge', async st => {
    const { row, item } = await seed();
    const prepared = await prepare([item]);
    const original = Cart.updateOne;
    const mock = st.mock.method(Cart, 'updateOne', async () => { throw new Error('simulated cart failure'); });
    st.mock.method(console, 'error', () => {});
    assert.equal((await confirm(prepared)).statusCode, 503);
    assert.equal((await Inventory.findById(row._id)).stockQuantity, 5);
    assert.equal((await Order.findOne({ orderId: prepared.paymentId })).inventoryApplied, false);
    mock.mock.restore();
    assert.equal(Cart.updateOne, original);
    assert.equal((await confirm(prepared)).statusCode, 201);
    assert.equal((await Inventory.findById(row._id)).stockQuantity, 4);
  });

  await t.test('wrong payment amount and another account cannot confirm an order', async () => {
    const { row, item } = await seed();
    const prepared = await prepare([item]);
    assert.equal((await confirm(prepared, new ObjectId().toString())).statusCode, 404);
    payments.get(prepared.paymentId).amount.total = 1;
    assert.equal((await confirm(prepared)).statusCode, 409);
    assert.equal((await Inventory.findById(row._id)).stockQuantity, 5);
  });

  await t.test('refund is required; concurrent cancellations restore once and retain order history', async () => {
    const { row, item } = await seed();
    const prepared = await prepare([item]);
    const paid = await confirm(prepared);
    assert.equal((await cancel(paid.body.order.id)).statusCode, 409);
    assert.equal((await Inventory.findById(row._id)).stockQuantity, 4);
    payments.get(prepared.paymentId).status = 'CANCELLED';
    const cancelled = await Promise.all([cancel(paid.body.order.id), cancel(paid.body.order.id, true)]);
    assert.ok(cancelled.every(res => res.statusCode === 200));
    assert.equal((await Inventory.findById(row._id)).stockQuantity, 5);
    assert.equal((await Order.findById(paid.body.order.id)).status, 'cancelled');
    assert.equal((await confirm(prepared)).statusCode, 409);
    assert.equal((await Inventory.findById(row._id)).stockQuantity, 5);
  });

  await t.test('legacy orders without the stock marker are cancelled without inventing inventory', async () => {
    const { row, item } = await seed();
    const legacy = await Order.create({ userId: buyer, items: [{ ...item, price: 10000 }], totalPrice: 12800, orderId: 'legacy-payment', status: 'paid' });
    await Order.updateOne({ _id: legacy._id }, { $unset: { inventoryApplied: '' } });
    payments.set('legacy-payment', { id: 'legacy-payment', status: 'CANCELLED' });
    assert.equal((await cancel(legacy.id)).statusCode, 200);
    assert.equal((await Inventory.findById(row._id)).stockQuantity, 5);
  });

  await t.test('pending orders cannot be marked paid through administrator status updates', async () => {
    const { item } = await seed();
    const prepared = await prepare([item]);
    const order = await Order.findOne({ orderId: prepared.paymentId });
    const res = response();
    await controller.updateOrderStatus({ params: { orderId: order.id }, body: { status: 'paid' } }, res);
    assert.equal(res.statusCode, 409);
  });

  await t.test('cart rows changed after checkout preparation are preserved', async () => {
    const { item } = await seed();
    await Cart.create({ userId: buyer, items: [{ ...item, price: 10000, quantity: 2 }] });
    const prepared = await prepare([item]);
    assert.equal((await confirm(prepared)).statusCode, 201);
    assert.equal((await Cart.findOne({ userId: buyer })).items[0].quantity, 2);
  });

  await t.test('stale admin inventory edit cannot overwrite a completed sale', async () => {
    const { item, row, variant, product } = await seed();
    await confirm(await prepare([item]));
    const res = response();
    const oldLog = console.error;
    console.error = () => {};
    try {
      await productController.updateProduct({ params: { id: product.id }, body: {
        productData: { material: 'changed' }, variants: [{ _id: variant.id, inventories: [{ _id: row.id, size: '프리', stockQuantity: 99, expectedUpdatedAt: row.updatedAt.toISOString() }] }]
      } }, res);
    } finally { console.error = oldLog; }
    assert.equal(res.statusCode, 409);
    assert.equal((await Inventory.findById(row.id)).stockQuantity, 4);
    assert.equal((await Product.findById(product.id)).material, 'cotton');
  });
});
