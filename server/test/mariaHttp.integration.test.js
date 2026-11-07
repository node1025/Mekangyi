const { test } = require('node:test');
const assert = require('node:assert/strict');
test('MariaDB HTTP product, account, cart, board and password reset', { skip: process.env.RUN_MARIA_HTTP !== '1' }, async t => {
  process.env.JWT_SECRET = 'integration-access-key';
  process.env.JWT_REFRESH_SECRET = 'integration-refresh-key';
  const models = require('../scripts/models.cjs');
  const [User, Product, Variant, Inventory, Cart, Order, Review, Board, Comment, PasswordReset] = models;
  const maria = require('../src/config/maria');
  await maria.connect(require('./mariaTestTarget.cjs')());
  t.after(() => maria.disconnect());
  for (const model of models) await model.deleteMany({});
  const app = require('../src/app');
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  let token;
  let adminCookie = '';
  async function request(url, method = 'GET', data, authorized = true) {
    const response = await fetch(base + url, { method, headers: { 'Content-Type': 'application/json', ...(adminCookie ? { Cookie: adminCookie } : {}), ...(authorized && token ? { Authorization: `Bearer ${token}` } : {}) }, body: data ? JSON.stringify(data) : undefined });
    return { status: response.status, data: await response.json() };
  }
  const userData = { userId: 'mariatest', password: 'Secret1234!', name: 'Maria Tester', email: 'maria@example.com', phone: '01012345678', birthDate: '2000-01-01', address: { zipCode: '12345', basicAddress: 'Seoul', detailAddress: '1' }, termsOfService: { agreeTermsOfService: true, agreePrivacyPolicy: true } };
  await t.test('registration hashes passwords, uniqueness persists, login works', async () => {
    const result = await request('/api/auth/register', 'POST', userData);
    assert.equal(result.status, 201, JSON.stringify(result.data));
    assert.equal(result.data.user.password, undefined);
    assert.equal((await request('/api/auth/register', 'POST', userData)).status, 400);
    const user = await User.findOne({ userId: userData.userId });
    assert.ok(await user.comparePassword(userData.password));
    await User.updateOne({ _id: user._id }, { $set: { role: 'admin' } });
    const login = await request('/api/auth/login', 'POST', { userId: userData.userId, password: userData.password });
    assert.equal(login.status, 200, JSON.stringify(login.data)); token = login.data.accessToken;
    const sessionResponse = await fetch(base + '/api/admin/session', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ userId: userData.userId, password: userData.password }) });
    assert.equal(sessionResponse.status, 200);
    adminCookie = sessionResponse.headers.get('set-cookie').split(';')[0];
  });
  let product, variant;
  await t.test('administrator price update is identical in list and detail, zero discount is preserved', async () => {
    product = await Product.create({ name: { ko: '테스트 굿즈', en: 'TEST GOODS' }, productCode: 'PRICE-TEST', basePrice: 100000, discountRate: 20, priceMode: 'always', material: 'polyester' });
    variant = await Variant.create({ productId: product._id, variantCode: 'PRICE-TEST-STD', color: 'Default', images: { thumbnail: 'uploads/test.png' } });
    await Inventory.create({ variantId: variant._id, sku: 'PRICE-TEST-FREE', size: '프리', stockQuantity: 5 });
    for (const [basePrice, discountRate, expected] of [[139000, 15, 118100], [150000, 0, 150000]]) {
      const updated = await request(`/api/products/${product.id}`, 'PATCH', { productData: { basePrice, discountRate } });
      assert.equal(updated.status, 200, JSON.stringify(updated.data));
      const listed = await request('/api/products');
      const detail = await request(`/api/products/${product.productCode}`);
      assert.equal(listed.data.products[0].finalPrice, expected);
      assert.equal(detail.data.product.finalPrice, expected);
    }
    const invalid = await request(`/api/products/${product.id}`, 'PATCH', { productData: { basePrice: -1 } });
    assert.ok(invalid.status >= 400);
    assert.equal((await Product.findById(product.id)).basePrice, 150000);
    assert.equal((await request('/api/products?search=test')).data.products.length, 1);
    assert.equal((await request('/api/products?search=%27%20OR%201%3D1')).data.products.length, 0);
  });
  await t.test('cart references populate and positional updates persist', async () => {
    const result = await request('/api/cart', 'POST', { productId: product.id, variantId: variant.id, size: '프리', quantity: 1, price: 1 });
    assert.equal(result.status, 201, JSON.stringify(result.data));
    const cart = await request('/api/cart');
    assert.equal(cart.data.items[0].productId.finalPrice, 150000);
    assert.equal(cart.data.items[0].variantId.color, 'Default');
    const item = cart.data.items[0];
    const changed = await request('/api/cart', 'PATCH', { itemId: item._id, quantity: 2 });
    assert.equal(changed.status, 200, JSON.stringify(changed.data));
    assert.equal((await request('/api/cart')).data.items[0].quantity, 2);
  });
  await t.test('shipping address is owned by the logged-in user and does not overwrite member identity', async () => {
    const owner = await User.findOne({ userId: userData.userId });
    const victim = await User.create({ ...userData, userId: 'victimtest', email: 'victim@example.com', name: 'Other user' });
    const before = await User.findById(victim._id);
    const address = { receiver:'배송 받는 분', phone:'010-9876-5432', zipCode:'12345', basicAddress:'테스트 배송 주소', detailAddress:'201호' };
    const saved = await request('/api/auth/shipping-address', 'PATCH', { ...address, userId: victim.id, role:'admin' });
    assert.equal(saved.status, 200, JSON.stringify(saved.data));
    assert.equal(saved.data.shippingAddress.receiver, address.receiver);
    assert.equal(saved.data.shippingAddress.phone, '01098765432');
    const profile = (await request('/api/auth/profile')).data.user;
    assert.equal(profile.name, owner.name);
    assert.equal(profile.phone, owner.phone);
    assert.equal(profile.address.basicAddress, owner.address.basicAddress);
    assert.equal(profile.shippingAddress.basicAddress, address.basicAddress);
    assert.deepEqual((await User.findById(victim._id)).toObject(), before.toObject());
    assert.equal((await request('/api/auth/shipping-address', 'PATCH', { ...address, zipCode:'x' })).status, 400);
    assert.equal((await request('/api/auth/shipping-address', 'PATCH', { ...address, receiver:{ $ne:null } })).status, 400);
    assert.equal((await User.findById(owner._id)).shippingAddress.zipCode, '12345');
  });
  await t.test('priceMode regular vs event window affects listed finalPrice', async () => {
    const pastStart = new Date('2020-01-01T00:00:00.000Z').toISOString();
    const pastEnd = new Date('2020-06-01T00:00:00.000Z').toISOString();
    await request(`/api/products/${product.id}`, 'PATCH', { productData: { priceMode: 'regular', basePrice: 100000, discountRate: 50 } });
    let listed = await request('/api/products');
    assert.equal(listed.data.products[0].finalPrice, 100000);
    assert.equal(listed.data.products[0].isDiscountActive, false);
    await request(`/api/products/${product.id}`, 'PATCH', { productData: { priceMode: 'event', discountRate: 10, eventDiscountStart: pastStart, eventDiscountEnd: pastEnd } });
    listed = await request('/api/products');
    assert.equal(listed.data.products[0].finalPrice, 100000);
    const futureEnd = new Date(Date.now() + 86400000).toISOString();
    await request(`/api/products/${product.id}`, 'PATCH', { productData: { eventDiscountStart: pastStart, eventDiscountEnd: futureEnd } });
    listed = await request('/api/products');
    assert.equal(listed.data.products[0].finalPrice, 90000);
    assert.equal(listed.data.products[0].isDiscountActive, true);
  });
  await t.test('board selected author population and detail serialization work', async () => {
    const user = await User.findOne({ userId: userData.userId });
    const board = await Board.create({ author: user._id, title: 'Test post', content: 'Test body' });
    const detail = await request(`/api/board/${board.id}`);
    assert.equal(detail.status, 200, JSON.stringify(detail.data));
    assert.equal(detail.data.post.author.name, userData.name);
    assert.equal(detail.data.post.author.password, undefined);
    const list = await request('/api/board');
    assert.equal(list.status, 200);
    assert.equal(list.data.posts[0].content, undefined);
  });
  await t.test('real reset token consumption rolls back on failure and works only once', async t => {
    const mailer = require('../src/services/resetMailer');
    let tokenValue;
    t.mock.method(mailer, 'getSettings', () => ({}));
    t.mock.method(mailer, 'sendResetLink', async ({ token }) => { tokenValue = token; });
    const reset = require('../src/controllers/passwordResetController');
    const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; }, json(data) { this.data = data; return this; }, clearCookie() {} });
    await reset.requestReset({ body: { name: userData.name, email: userData.email } }, response());
    assert.equal(tokenValue.length, 64);
    const before = await User.findOne({ userId: userData.userId });
    const failure = t.mock.method(User.prototype, 'save', async () => { throw new Error('Simulated failure'); });
    const failed = response();
    await reset.resetPassword({ body: { token: tokenValue, newPassword: 'Changed1234!' } }, failed);
    assert.equal(failed.statusCode, 503);
    failure.mock.restore();
    assert.equal(await PasswordReset.countDocuments(), 1);
    assert.equal((await User.findById(before.id)).password, before.password);
    const success = response();
    await reset.resetPassword({ body: { token: tokenValue, newPassword: 'Changed1234!' } }, success);
    assert.equal(success.statusCode, 200);
    assert.ok(await (await User.findById(before.id)).comparePassword('Changed1234!'));
    assert.equal(await PasswordReset.countDocuments(), 0);
    const reused = response();
    await reset.resetPassword({ body: { token: tokenValue, newPassword: 'Changed5678!' } }, reused);
    assert.equal(reused.statusCode, 400);
  });
  await t.test('migration import preserves source IDs, bcrypt hashes and timestamps', async () => {
    const original = await User.findOne({ userId: userData.userId });
    const row = original.toObject();
    const { ObjectId } = require('../src/models/mariaSchema');
    row._id = new ObjectId().toString();
    row.userId = 'importeduser'; row.email = 'imported@example.com';
    row.createdAt = new Date('2024-01-01T00:00:00.000Z');
    row.updatedAt = new Date('2024-02-01T00:00:00.000Z');
    await maria.transaction(session => User.importRows([row], session));
    const imported = await User.findById(row._id);
    assert.equal(imported.password, original.password);
    assert.ok(await imported.comparePassword('Changed1234!'));
    assert.equal(imported.createdAt.toISOString(), row.createdAt.toISOString());
    assert.equal(imported.updatedAt.toISOString(), row.updatedAt.toISOString());
  });
  await t.test('local reset mail completes the real HTTP request, reset and login flow without leaking a link', async t => {
    const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
    const localMail = require('../src/services/localMail');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bukangi-reset-http-'));
    t.after(() => fs.rmSync(dir, { recursive:true, force:true }));
    const store = localMail.createStore(dir);
    t.mock.method(localMail, 'createStore', () => store);
    for (const [key, value] of Object.entries({NODE_ENV:'development',RESET_MAIL_MODE:'local',FRONTEND_URL:'http://127.0.0.1:8082'})) {
      const previous = process.env[key]; process.env[key] = value;
      t.after(() => { if(previous===undefined)delete process.env[key];else process.env[key]=previous; });
    }
    const requested = await request('/api/auth/verify-for-password', 'POST', {name:'Other user',email:'victim@example.com'}, false);
    assert.equal(requested.status, 202);
    assert.equal(store.list().length, 1);
    const mail = store.list()[0];
    const resetToken = new URLSearchParams(new URL(mail.link).hash.slice(1)).get('token');
    assert.ok(!JSON.stringify(requested.data).includes(resetToken));
    assert.equal((await request('/api/auth/reset-password-unauthenticated','PATCH',{token:resetToken,newPassword:'MailFlow!56789'},false)).status,200);
    assert.equal((await request('/api/auth/login','POST',{userId:'victimtest',password:'MailFlow!56789'},false)).status,200);
    assert.equal((await request('/api/auth/reset-password-unauthenticated','PATCH',{token:resetToken,newPassword:'MailFlow!11111'},false)).status,400);
    assert.equal((await request('/api/auth/verify-for-password','POST',{name:'Unknown user',email:'unknown@example.com'},false)).status,202);
    assert.equal(store.list().length,1);
  });
  await t.test('board categories, literal title search and pagination return consistent totals', async () => {
    const user = await User.findOne({ userId: userData.userId });
    await Board.deleteMany({});
    for (let i = 0; i < 23; i++) await Board.create({ author: user.id, title: i === 0 ? '배송 [guide]' : `이야기 ${i}`, content: '본문은 목록에 보이지 않습니다.', category: i < 12 ? 'qna' : 'free', isPrivate: i === 2 });
    const first = await request('/api/board?category=qna&page=1&limit=10');
    const second = await request('/api/board?category=qna&page=2&limit=10');
    assert.equal(first.data.total, 12); assert.equal(first.data.totalPages, 2);
    assert.equal(first.data.posts.length, 10); assert.equal(second.data.posts.length, 2);
    const ids = new Set([...first.data.posts, ...second.data.posts].map(post => post._id));
    assert.equal(ids.size, 12);
    assert.ok(first.data.posts.every(post => post.content === undefined && post.category === 'qna'));
    const searched = await request('/api/board?search=%5Bguide%5D');
    assert.equal(searched.data.total, 1);
    assert.equal(searched.data.posts[0].title, '배송 [guide]');
    assert.equal((await request('/api/board?page=-1')).status, 400);
  });
});


