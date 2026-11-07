const { test } = require('node:test');
const assert = require('node:assert/strict');
test('administrator reauthentication is enforced by MariaDB-backed APIs', { skip: process.env.RUN_MARIA_HTTP !== '1' }, async t => {
  process.env.JWT_SECRET = 'admin-integration-access-key';
  process.env.JWT_REFRESH_SECRET = 'admin-integration-refresh-key';
  const models = require('../scripts/models.cjs');
  const [User, Product] = models;
  const AdminSession = require('../src/models/adminSession');
  const maria = require('../src/config/maria');
  const jwt = require('jsonwebtoken');
  await maria.connect(require('./mariaTestTarget.cjs')());
  t.after(() => maria.disconnect());
  for (const model of models) await model.deleteMany({});
  const password = 'AdminSecret123!';
  const input = { password, name: 'Admin fixture', phone: '00000000000', birthDate: '2000-01-01', address: { zipCode: '00000', basicAddress: 'Test', detailAddress: 'Test' }, termsOfService: { agreeTermsOfService: true, agreePrivacyPolicy: true } };
  const admin = await User.create({ ...input, userId: 'adminTest', email: 'admin@example.com', role: 'admin' });
  const member = await User.create({ ...input, userId: 'memberTest', email: 'member@example.com' });
  const product = await Product.create({ name: { ko: '보호 상품' }, productCode: 'ADMIN-TEST', basePrice: 10000, material: 'test' });
  const token = (user, jwtid) => jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1h', jwtid });
  const adminToken = token(admin, 'first');
  const otherToken = token(admin, 'another-login');
  const memberToken = token(member, 'member');
  const app = require('../src/app');
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  async function request(url, method='GET', data, access=adminToken, cookie='') {
    const response = await fetch(base+url, { method, headers: { 'Content-Type':'application/json', ...(access?{Authorization:`Bearer ${access}`} : {}), ...(cookie?{Cookie:cookie}: {}) }, body:data?JSON.stringify(data):undefined });
    return { status:response.status, data:await response.json(), cookie:response.headers.get('set-cookie') };
  }
  async function login() {
    const result = await request('/api/admin/session','POST',{userId:admin.userId,password});
    assert.equal(result.status,200,JSON.stringify(result.data));
    assert.match(result.cookie,/HttpOnly/i); assert.match(result.cookie,/SameSite=Strict/i); assert.match(result.cookie,/Path=\/api/i);
    return result.cookie.split(';')[0];
  }
  let cookie;
  await t.test('a regular member login cannot directly access admin APIs', async () => {
    assert.equal((await request('/api/admin/session','GET',undefined,'')).status,401);
    const denied=await request(`/api/products/${product.id}`,'PATCH',{productData:{basePrice:50000}});
    assert.equal(denied.status,403); assert.equal(denied.data.code,'ADMIN_REAUTH_REQUIRED');
    assert.equal((await Product.findById(product.id)).basePrice,10000);
  });
  await t.test('non-admins and wrong passwords cannot obtain a privileged session', async () => {
    assert.equal((await request('/api/admin/session','POST',{userId:member.userId,password},memberToken)).status,403);
    assert.equal((await request('/api/admin/session','POST',{userId:admin.userId,password:'wrong'})).status,403);
    assert.equal(await AdminSession.countDocuments(),0);
  });
  await t.test('reauthentication permits admin APIs and stores only an opaque token hash', async () => {
    cookie=await login();
    const row=await AdminSession.findOne();
    assert.notEqual(row.tokenHash,cookie.split('=')[1]);
    assert.equal((await request('/api/admin/session','GET',undefined,adminToken,cookie)).status,200);
    assert.equal((await request(`/api/products/${product.id}`,'PATCH',{productData:{basePrice:20000}},adminToken,cookie)).status,200);
  });
  await t.test('sessions are bound to the exact first login token and account', async () => {
    assert.equal((await request('/api/admin/session','GET',undefined,otherToken,cookie)).status,403);
    assert.equal((await request('/api/admin/session','GET',undefined,memberToken,cookie)).status,403);
    assert.equal((await request('/api/admin/session','POST',{userId:member.userId,password})).status,403);
  });
  await t.test('account demotion, deactivation and password changes revoke access immediately', async () => {
    const original=await User.findById(admin.id);
    await User.updateOne({_id:admin.id},{$set:{role:'user'}});
    assert.equal((await request('/api/admin/session','GET',undefined,adminToken,cookie)).status,403);
    await User.updateOne({_id:admin.id},{$set:{role:'admin',isActivated:false}});
    assert.equal((await request('/api/admin/session','GET',undefined,adminToken,cookie)).status,403);
    await User.updateOne({_id:admin.id},{$set:{isActivated:true}});
    const doc=await User.findById(admin.id); doc.password='NewSecret123!'; await doc.save();
    assert.equal((await request('/api/admin/session','GET',undefined,adminToken,cookie)).status,403);
    // Restore the fixture through the migration path so the original bcrypt hash is preserved.
    await User.deleteOne({_id:admin.id}); await maria.transaction(session=>User.importRows([original.toObject()],session));
  });
  await t.test('expired sessions and previous sessions after rotation are rejected', async () => {
    cookie=await login();
    await AdminSession.updateOne({userId:admin.id},{$set:{expiresAt:new Date(Date.now()-1000)}});
    assert.equal((await request('/api/admin/session','GET',undefined,adminToken,cookie)).status,403);
    const old=await login(); cookie=await login();
    assert.equal((await request('/api/admin/session','GET',undefined,adminToken,old)).status,403);
    assert.equal(await AdminSession.countDocuments(),1);
  });
  await t.test('notice publishing and private-post admin override require the second login', async () => {
    const data={title:'Protected notice',content:'Test only',category:'notice'};
    assert.equal((await request('/api/board','POST',data)).status,403);
    assert.equal((await request('/api/board','POST',data,adminToken,cookie)).status,201);
    const Board=require('../src/models/board');
    const privatePost=await Board.create({title:'Private',content:'secret',author:member.id,category:'qna',isPrivate:true});
    assert.equal((await request(`/api/board/${privatePost.id}`)).status,403);
    assert.equal((await request(`/api/board/${privatePost.id}`,'GET',undefined,adminToken,cookie)).status,200);
  });
  await t.test('logout invalidates the server record as well as clearing the cookie', async () => {
    const result=await request('/api/admin/session','DELETE',undefined,adminToken,cookie);
    assert.equal(result.status,200); assert.match(result.cookie,/Expires=Thu, 01 Jan 1970/i);
    assert.equal((await request('/api/admin/session','GET',undefined,adminToken,cookie)).status,403);
  });
  await t.test('parallel and repeated password guesses are rate limited', async () => {
    const results=await Promise.all(Array.from({length:8},()=>request('/api/admin/session','POST',{userId:admin.userId,password:'incorrect'})));
    assert.ok(results.some(result=>result.status===429));
    assert.equal(await AdminSession.countDocuments(),0);
  });
});
