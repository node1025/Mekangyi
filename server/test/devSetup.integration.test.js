const { test } = require('node:test');
const assert = require('node:assert/strict');

test('dev setup on an isolated MariaDB database', { skip: process.env.RUN_DEV_INTEGRATION !== '1', timeout: 240000 }, async t => {
  const maria = require('../src/config/maria');
  const Product = require('../src/models/product/product');
  const Variant = require('../src/models/product/productvariant');
  const Inventory = require('../src/models/product/inventory');
  const User = require('../src/models/user');
  const { seedProducts } = require('../scripts/seed-dev.cjs');
  const { createDevAdmin } = require('../scripts/create-dev-admin.cjs');
  t.after(() => maria.disconnect());
  await maria.connect(require('./mariaTestTarget.cjs')());
  for (const model of [Inventory, Variant, Product, User]) await model.deleteMany({});

  await t.test('first run creates the full catalog and correct price', async () => {
    assert.deepEqual(await seedProducts(), { products: 7, variants: 10, inventories: 16, skippedProducts: 0 });
    assert.equal(await Product.countDocuments(), 7);
    assert.equal(await Variant.countDocuments(), 10);
    assert.equal(await Inventory.countDocuments(), 16);
    assert.equal((await Product.findOne({ productCode: 'bukangi_plush_doll' })).finalPrice, 24900);
    const p = await Product.findOne({ productCode: 'bukangi_notebook' });
    const variant = await Variant.findOne({ productId: p._id });
    assert.equal((await Inventory.findOne({ variantId: variant._id, size: '프리' })).stockQuantity, 100);
    assert.equal(await User.countDocuments(), 0);
  });

  await t.test('rerun preserves edits and consumed stock', async () => {
    const row = await Inventory.findOne();
    await Inventory.updateOne({ _id: row._id }, { $set: { stockQuantity: 2 } });
    await Product.updateOne({ productCode: 'bukangi_plush_doll' }, { $set: { basePrice: 123400, priceMode: 'regular' } });
    assert.deepEqual(await seedProducts(), { products: 0, variants: 0, inventories: 0, skippedProducts: 7 });
    assert.equal((await Inventory.findById(row._id)).stockQuantity, 2);
    assert.equal((await Product.findOne({ productCode: 'bukangi_plush_doll' })).finalPrice, 123400);
    assert.equal(await Inventory.countDocuments(), 16);
  });

  await t.test('color update adds missing options and preserves prices, IDs and consumed stock on rerun', async () => {
    const { updateGoodsOptions } = require('../scripts/update-goods-options.cjs');
    const product = await Product.findOne({ productCode: 'bukangi_tshirt' });
    const white = await Variant.findOne({ variantCode: 'bukangi_tshirt-std' });
    const black = await Variant.findOne({ variantCode: 'bukangi_tshirt-black' });
    await Inventory.deleteMany({ variantId: black._id });
    await Variant.deleteOne({ _id: black._id });
    await Variant.updateOne({ _id: white._id }, { $set: { color: '오리지널' } });
    const stock = await Inventory.findOne({ variantId: white._id, size: 'S' });
    await Inventory.updateOne({ _id: stock._id }, { $set: { stockQuantity: 7 } });
    assert.deepEqual(await updateGoodsOptions(), { products: 3, createdVariants: 1, createdInventories: 4 });
    assert.equal((await Variant.findById(white._id)).color, '화이트');
    const added = await Variant.findOne({ variantCode: 'bukangi_tshirt-black' });
    assert.equal(added.color, '블랙');
    assert.ok(added.images.thumbnail.endsWith('bukangi_tshirt_2.png'));
    assert.equal((await Inventory.findById(stock._id)).stockQuantity, 7);
    assert.equal((await Product.findById(product._id)).finalPrice, product.finalPrice);
    assert.equal((await Product.findOne({ productCode: 'bukangi_plush_doll' })).basePrice, 123400);
    assert.deepEqual(await updateGoodsOptions(), { products: 3, createdVariants: 0, createdInventories: 0 });
    assert.equal((await Inventory.findById(stock._id)).stockQuantity, 7);
    assert.equal(await Inventory.countDocuments(), 16);
  });

  await t.test('a partial insertion failure rolls back the entire run', async t => {
    await Promise.all([Product, Variant, Inventory].map(model => model.deleteMany({})));
    const original = Inventory.insertMany.bind(Inventory);
    let calls = 0;
    t.mock.method(Inventory, 'insertMany', async (...args) => {
      if (++calls === 2) throw new Error('Simulated seed failure');
      return original(...args);
    });
    await assert.rejects(seedProducts(), /Simulated seed failure/);
    assert.equal(await Product.countDocuments(), 0);
    assert.equal(await Variant.countDocuments(), 0);
    assert.equal(await Inventory.countDocuments(), 0);
  });

  await t.test('admin uses a random hashed password and cannot reset or promote an existing account', async () => {
    const credentials = await createDevAdmin();
    const user = await User.findOne({ userId: credentials.userId });
    assert.equal(user.role, 'admin');
    assert.notEqual(user.password, credentials.password);
    assert.ok(await user.comparePassword(credentials.password));
    assert.ok(!(await user.comparePassword('wrong-password')));
    const hash = user.password;
    await User.updateOne({ _id: user._id }, { $set: { role: 'user' } });
    await assert.rejects(createDevAdmin(), /이미 존재/);
    const unchanged = await User.findById(user._id);
    assert.equal(unchanged.role, 'user');
    assert.equal(unchanged.password, hash);
    assert.equal(await User.countDocuments(), 1);
  });

  await t.test('documented CLI commands use only the explicit dev database', async () => {
    const { execFile } = require('node:child_process');
    const { promisify } = require('node:util');
    const path = require('node:path');
    const execute = promisify(execFile);
    const env = { ...process.env, NODE_ENV: 'development', DEV_MARIADB_URI: process.env.TEST_MARIADB_URI, MARIADB_URI: 'mariadb://127.0.0.1:1/never_connect_here' };
    const options = { cwd: path.join(__dirname, '..'), env, timeout: 30000 };
    const seeded = await execute(process.execPath, ['scripts/seed-dev.cjs'], options);
    assert.match(seeded.stdout, /상품 7개/);
    assert.equal(await Product.countDocuments(), 7);
    await User.deleteMany({});
    const created = await execute(process.execPath, ['scripts/create-dev-admin.cjs'], options);
    assert.match(created.stdout, /관리자 아이디: mekang1223/);
    const password = created.stdout.match(/로그인 비밀번호\(일회성\): (\S+)/)[1];
    assert.ok(await (await User.findOne({ userId: 'mekang1223' })).comparePassword(password));
    await assert.rejects(execute(process.execPath, ['scripts/seed-dev.cjs'], {
      ...options, env: { ...env, DEV_MARIADB_URI: 'mariadb://127.0.0.1/production' }
    }), error => error.code === 1 && /_dev/.test(error.stderr));
  });
});
