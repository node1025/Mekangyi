const { test } = require('node:test');
const assert = require('node:assert/strict');
const User = require('../src/models/user');
const Cart = require('../src/models/cart');
const Product = require('../src/models/product/product');
const Variant = require('../src/models/product/productvariant');
const Inventory = require('../src/models/product/inventory');
const Order = require('../src/models/order');
const Review = require('../src/models/review');
const auth = require('../src/controllers/authController');
const cart = require('../src/controllers/cartController');
const wishlist = require('../src/controllers/wishlistController');
const Wishlist = require('../src/models/wishlist');
const products = require('../src/controllers/productController');
const reviews = require('../src/controllers/reviewController');
const { literalSearch } = require('../src/utils/input');

const id = '507f1f77bcf86cd799439011';
const variantId = '507f1f77bcf86cd799439012';
const response = () => ({
  statusCode: 200,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; }
});

test('registration cannot set role, points or refreshToken', async t => {
  t.mock.method(User.prototype, 'save', async function () { await this.validate(); return this; });
  const res = response();
  await auth.register({ body: {
    userId: 'tester', password: 'Secret1234!', name: 'Test', email: 'test@example.com', phone: '01012345678',
    birthDate: '2000-01-01', address: { zipCode: '12345', basicAddress: 'Seoul', detailAddress: '1' },
    termsOfService: { agreeTermsOfService: true, agreePrivacyPolicy: true, agreeMarketing: false },
    role: 'admin', points: 9999, refreshToken: 'attacker'
  } }, res);
  assert.equal(res.statusCode, 201);
  assert.equal(res.body.user.role, 'user');
  assert.equal(res.body.user.points, 0);
  assert.equal(res.body.user.termsOfService.agreeTermsOfService, true);
  assert.equal(res.body.user.password, undefined);
  assert.equal(res.body.user.refreshToken, undefined);
});

test('profile update only writes permitted fields and excludes secrets', async t => {
  let written;
  t.mock.method(User, 'findByIdAndUpdate', (userId, update, options) => {
    written = update.$set;
    assert.equal(options.runValidators, true);
    return { select(fields) {
      assert.ok(fields.includes('-refreshToken'));
      return Promise.resolve({ name: 'Updated' });
    } };
  });
  const res = response();
  await auth.updateProfile({ user: { id }, body: {
    name: 'Updated', role: 'admin', points: 100, password: 'Plaintext',
    'address.zipCode': 'operator', address: { zipCode: '12345', basicAddress: 'Seoul', detailAddress: '1', role: 'admin' }
  } }, res);
  assert.deepEqual(written, { name: 'Updated', address: { zipCode: '12345', basicAddress: 'Seoul', detailAddress: '1' } });
  assert.equal(res.statusCode, 200);
});

test('profile rejects requests containing only protected fields', async () => {
  const res = response();
  await auth.updateProfile({ user: { id }, body: { role: 'admin' } }, res);
  assert.equal(res.statusCode, 400);
});

test('missing profile returns 404', async t => {
  t.mock.method(User, 'findByIdAndUpdate', () => ({ select: async () => null }));
  const res = response();
  await auth.updateProfile({ user: { id }, body: { name: 'Updated' } }, res);
  assert.equal(res.statusCode, 404);
});

test('invalid cart quantities never reach database writes', async t => {
  const write = t.mock.method(Cart, 'findOneAndUpdate', () => { throw new Error('must not write'); });
  for (const quantity of [-1, 0, 1.5, '2', null, Number.MAX_SAFE_INTEGER + 1]) {
    const res = response();
    await cart.updateQuantity({ user: { id }, body: { itemId: id, quantity } }, res);
    assert.equal(res.statusCode, 400);
  }
  assert.equal(write.mock.callCount(), 0);
});

function mockProduct(t, stock = 5) {
  t.mock.method(Product, 'findOne', async () => ({ basePrice: 12000, discountRate: 0, priceMode: 'regular', finalPrice: 12000 }));
  t.mock.method(Variant, 'findOne', async () => ({ _id: variantId }));
  t.mock.method(Inventory, 'findOne', async () => ({ stockQuantity: stock }));
}

test('cart uses database price instead of client price', async t => {
  mockProduct(t);
  t.mock.method(Cart, 'findOne', async () => null);
  let stored;
  t.mock.method(Cart, 'create', async data => { stored = data; return data; });
  const res = response();
  await cart.addToCart({ user: { id }, body: { productId: id, variantId, size: '프리', quantity: 2, price: 1 } }, res);
  assert.equal(res.statusCode, 201);
  assert.equal(stored.items[0].price, 12000);
});

test('cart rejects missing product/variant relationships', async t => {
  mockProduct(t);
  t.mock.method(Variant, 'findOne', async () => null);
  const res = response();
  await cart.addToCart({ user: { id }, body: { productId: id, variantId, size: '프리', quantity: 1 } }, res);
  assert.equal(res.statusCode, 400);
});

test('adding existing cart item cannot exceed combined stock', async t => {
  mockProduct(t, 3);
  let saved = false;
  t.mock.method(Cart, 'findOne', async () => ({ items: [{ variantId, size: '프리', quantity: 2 }], save() { saved = true; } }));
  const res = response();
  await cart.addToCart({ user: { id }, body: { productId: id, variantId, size: '프리', quantity: 2 } }, res);
  assert.equal(res.statusCode, 400);
  assert.equal(saved, false);
});

test('cart quantity change rejects stock shortage', async t => {
  t.mock.method(Cart, 'findOne', async () => ({ items: [{ _id: id, variantId, size: '프리' }] }));
  t.mock.method(Inventory, 'findOne', async () => ({ stockQuantity: 1 }));
  const res = response();
  await cart.updateQuantity({ user: { id }, body: { itemId: id, quantity: 2 } }, res);
  assert.equal(res.statusCode, 400);
});

test('cart quantity change preserves owner filter and schema validation', async t => {
  t.mock.method(Cart, 'findOne', async () => ({ items: [{ _id: id, variantId, size: '프리' }] }));
  t.mock.method(Inventory, 'findOne', async () => ({ stockQuantity: 5 }));
  t.mock.method(Cart, 'findOneAndUpdate', async (filter, update, options) => {
    assert.deepEqual(filter, { userId: id, 'items._id': id });
    assert.equal(update.$set['items.$.quantity'], 3);
    assert.equal(options.runValidators, true);
    return { items: [] };
  });
  const res = response();
  await cart.updateQuantity({ user: { id }, body: { itemId: id, quantity: 3 } }, res);
  assert.equal(res.statusCode, 200);
});

test('search treats regex metacharacters as literal text', () => {
  const text = '(a+)+$[shoe].*';
  const regex = new RegExp(literalSearch(text));
  assert.ok(regex.test(text));
  assert.ok(!regex.test('aaaaaaaaaa'));
  assert.equal(literalSearch({ $ne: '' }), null);
  assert.equal(literalSearch('a'.repeat(101)), null);
});

test('product search rejects object queries before reading database', async () => {
  const res = response();
  await products.getAllProducts({ query: { search: { $ne: '' } } }, res);
  assert.equal(res.statusCode, 400);
});

test('delivered order cannot authorize review of unrelated product', async t => {
  t.mock.method(Order, 'findOne', async () => ({ items: [{ productId: variantId }] }));
  const write = t.mock.method(Review, 'create', async () => { throw new Error('must not write'); });
  const res = response();
  await reviews.createReview({ user: { id }, body: { orderId: id, productId: id, rating: 5, content: 'Example review content' } }, res);
  assert.equal(res.statusCode, 400);
  assert.equal(write.mock.callCount(), 0);
});

test('invalid wishlist product ids never reach database writes', async t => {
  const write = t.mock.method(Wishlist, 'create', () => { throw new Error('must not write'); });
  for (const productId of ['bad', null, {}, 1.5]) {
    const res = response();
    await wishlist.toggleWishlist({ user: { id }, body: { productId } }, res);
    assert.equal(res.statusCode, 400);
  }
  assert.equal(write.mock.callCount(), 0);
});

test('wishlist toggle rejects missing products', async t => {
  t.mock.method(Product, 'findOne', async () => null);
  const write = t.mock.method(Wishlist, 'create', () => { throw new Error('must not write'); });
  const res = response();
  await wishlist.toggleWishlist({ user: { id }, body: { productId: id } }, res);
  assert.equal(res.statusCode, 404);
  assert.equal(write.mock.callCount(), 0);
});
