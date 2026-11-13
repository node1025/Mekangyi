const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { devTarget } = require('../scripts/dev-db.cjs');
const catalog = require('../data/dev-products.json');
const Product = require('../src/models/product/product');
const Variant = require('../src/models/product/productvariant');
const Inventory = require('../src/models/product/inventory');
const { ObjectId } = require('../src/models/mariaSchema');
const { salePriceFromProduct } = require('../src/utils/productPricing');

test('dev setup requires an explicitly named non-production database', () => {
  for (const env of [
    {}, { LEGACY_DB_URI: 'mariadb://127.0.0.1/live' },
    { DEV_MARIADB_URI: 'mariadb://127.0.0.1/live' },
    { DEV_MARIADB_URI: 'mariadb://127.0.0.1/' },
    { DEV_MARIADB_URI: 'https://example.com/shop_dev' },
    { NODE_ENV: 'production', DEV_MARIADB_URI: 'mariadb://127.0.0.1/shop_dev' },
    { DEV_MARIADB_URI: 'mariadb://127.0.0.1/bukang_shop_test_dev' },
  ]) assert.throws(() => devTarget(env));
  assert.equal(devTarget({ DEV_MARIADB_URI: 'mariadb://127.0.0.1/shop_dev?replicaSet=rs0' }).database, 'shop_dev');
  assert.equal(devTarget({ DEV_MARIADB_URI: 'mariadb://cluster.example.com/bukang_shop_dev' }).database, 'bukang_shop_dev');
});

test('dev catalog matches requested prices, sizes and stock and references packaged images', async () => {
  const expected = [
    ['bukangi_plush_doll', 24900, 2, ['프리'], 100],
    ['bukangi_doll_keyring', 12900, 2, ['프리'], 100],
    ['bukangi_mood_light', 22000, 1, ['프리'], 100],
    ['bukangi_bowl', 14000, 1, ['프리'], 100],
    ['bukangi_tshirt', 42000, 2, ['S', 'M', 'L', 'XL'], 100],
    ['bukangi_mousepad', 16000, 1, ['프리'], 100],
    ['bukangi_notebook', 3000, 1, ['프리'], 100]
  ];
  assert.equal(catalog.length, 7);
  let inventoryCount = 0;
  const codes = new Set();
  for (const [code, price, colors, sizes, stock] of expected) {
    const item = catalog.find(row => row.product.productCode === code);
    assert.equal(item.product.finalPrice, price);
    assert.equal(salePriceFromProduct(item.product), price);
    assert.equal(item.variants.length, colors);
    assert.deepEqual(item.sizes, sizes);
    assert.equal(item.stockQuantity, stock);
    await new Product(item.product).validate();
    for (const image of [item.images.thumbnail, ...item.images.gallery]) {
      assert.ok(image.startsWith('uploads/'));
      assert.ok(fs.existsSync(path.join(__dirname, '..', image)), image);
    }
    const productId = new ObjectId().toString();
    for (const variant of item.variants) {
      assert.ok(!codes.has(variant.variantCode));
      codes.add(variant.variantCode);
      await new Variant({ ...variant, productId, images: variant.images || item.images }).validate();
      for (const size of item.sizes) {
        await new Inventory({ variantId: new ObjectId().toString(), sku: `${variant.variantCode}-${size}`, size: String(size), stockQuantity: stock }).validate();
        inventoryCount++;
      }
    }
  }
  assert.equal(codes.size, 10);
  assert.equal(inventoryCount, 16);
});
