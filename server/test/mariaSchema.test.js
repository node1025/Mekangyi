const { test } = require('node:test');
const assert = require('node:assert/strict');
const User = require('../src/models/user');
const Product = require('../src/models/product/product');
test('SQL schemas include stable primary keys, timestamps and declared unique indexes', () => {
  for (const model of [User, Product]) {
    assert.equal(model.schema.path('_id').instance, 'ObjectId');
    assert.equal(model.schema.path('updatedAt').instance, 'Date');
  }
  assert.ok(User.schema.indexes().some(([keys, opts]) => keys.userId && opts.unique));
  assert.ok(Product.schema.indexes().some(([keys, opts]) => keys.productCode && opts.unique));
});
test('document methods and password hooks see proxy fields, and sessions round trip', async () => {
  const user = new User({ password: 'Secret1234!' });
  await User.schema.hooks.execPre('save', user);
  assert.notEqual(user.password, 'Secret1234!');
  assert.ok(await user.comparePassword('Secret1234!'));
  const session = { marker: 'transaction' };
  user.$session(session);
  assert.equal(user.$session(), session);
  const product = new Product({ name: { ko: '부캉이' }, productCode: 'PROXY', basePrice: 10000, material: 'cotton' });
  assert.equal(product.rating.avg, 0);
  assert.equal(product.metrics.salesCount, 0);
});
