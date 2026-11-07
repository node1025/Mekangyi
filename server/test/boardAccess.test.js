const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const Board = require('../src/models/board');

process.env.JWT_SECRET = 'board-route-test-key';
const routes = require('../src/routes/board');

test('member board access over HTTP', async t => {
  const rows = new Map();
  t.mock.method(Board, 'create', async data => {
    const doc = new Board(data);
    await doc.validate();
    rows.set(doc.id, doc);
    return doc;
  });
  t.mock.method(Board, 'findById', async id => rows.get(String(id)) || null);
  t.mock.method(Board, 'updateOne', async () => ({ matchedCount: 1 }));
  t.mock.method(Board.prototype, 'populate', async function () { return this; });
  t.mock.method(Board.prototype, 'save', async function () {
    await this.validate();
    rows.set(this.id, this);
    return this;
  });
  t.mock.method(Board, 'findByIdAndDelete', async id => rows.delete(String(id)));
  t.mock.method(Board, 'find', () => {
    let selection;
    const chain = {
      select(value) { selection = value; return chain; },
      populate() { return chain; }, sort() { return chain; }, limit() { return chain; },
      skip() {
        assert.ok(!selection.split(' ').includes('content'));
        assert.ok(!selection.split(' ').includes('imageUrl'));
        return Promise.resolve([...rows.values()].map(doc => Object.fromEntries(
          ['_id', ...selection.split(' ')].map(key => [key, doc[key]])
        )));
      }
    };
    return chain;
  });
  t.mock.method(Board, 'countDocuments', async () => rows.size);
  const app = express();
  app.use(express.json());
  app.use(require('cookie-parser')());
  app.use('/board', routes);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}/board`;
  const ids = { owner: '507f1f77bcf86cd799439011', other: '507f1f77bcf86cd799439012', admin: '507f1f77bcf86cd799439013' };
  const token = who => jwt.sign({ id: ids[who], role: who === 'admin' ? 'admin' : 'user' }, process.env.JWT_SECRET);
  const fixedAdminToken = token('admin');
  const hash = value => require('node:crypto').createHash('sha256').update(value).digest('hex');
  t.mock.method(require('../src/models/user'), 'findById', async () => ({ role: 'admin', isActivated: true, password: 'test-hash' }));
  t.mock.method(require('../src/models/adminSession'), 'findOne', async () => ({ accessTokenHash: hash(fixedAdminToken), passwordFingerprint: hash('test-hash') }));
  async function request(method, route = '', who, body) {
    const headers = { 'Content-Type': 'application/json' };
    if (who) headers.Authorization = `Bearer ${who === 'admin' ? fixedAdminToken : token(who)}`;
    if (who === 'admin') headers.Cookie = 'bukang_admin_session=' + 'a'.repeat(64);
    const res = await fetch(url + route, { method, headers, body: body ? JSON.stringify(body) : undefined });
    return { status: res.status, body: await res.json(), headers: res.headers };
  }
  const input = { title: '회원 질문', content: '재고 문의입니다.', category: 'qna', isPrivate: true };
  let postId;
  await t.test('guest cannot create, member authorship comes from the token', async () => {
    assert.equal((await request('POST', '', undefined, input)).status, 401);
    const created = await request('POST', '', 'owner', { ...input, author: ids.admin });
    assert.equal(created.status, 201);
    assert.equal(created.body.post.author, ids.owner);
    postId = created.body.post._id;
  });
  await t.test('private contents and attachments never leak through public list or detail', async () => {
    const listing = await request('GET');
    assert.equal(listing.status, 200);
    assert.equal(listing.body.posts[0].content, undefined);
    assert.equal(listing.body.posts[0].imageUrl, undefined);
    assert.equal((await request('GET', `/${postId}`)).status, 403);
    assert.equal((await request('GET', `/${postId}`, 'other')).status, 403);
    const own = await request('GET', `/${postId}`, 'owner');
    assert.equal(own.status, 200);
    assert.equal(own.headers.get('cache-control'), 'no-store');
    assert.equal((await request('GET', `/${postId}`, 'admin')).status, 200);
    assert.equal((await request('POST', `/${postId}/comments`, 'other', { content: '댓글' })).status, 403);
  });
  await t.test('member can edit own post but cannot edit another or promote it to notice/event', async () => {
    assert.equal((await request('PATCH', `/${postId}`, 'other', { title: '변조' })).status, 403);
    for (const category of ['notice', 'event']) {
      assert.equal((await request('POST', '', 'owner', { ...input, category })).status, 403);
      assert.equal((await request('PATCH', `/${postId}`, 'owner', { category })).status, 403);
    }
    const edited = await request('PATCH', `/${postId}`, 'owner', { title: '수정된 문의' });
    assert.equal(edited.status, 200);
    assert.equal(edited.body.post.isPrivate, true);
    assert.equal(edited.body.post.title, '수정된 문의');
    assert.equal((await request('PATCH', `/${postId}`, 'admin', { content: '관리자 수정' })).status, 200);
  });
  await t.test('author may delete own post, another member may not', async () => {
    assert.equal((await request('DELETE', `/${postId}`, 'other')).status, 403);
    assert.equal((await request('DELETE', `/${postId}`, 'owner')).status, 200);
    assert.equal((await request('GET', `/${postId}`)).status, 404);
  });
  await t.test('public free posts and admin notices remain available', async () => {
    const free = await request('POST', '', 'owner', { title: '회원 글', content: '공개 글' });
    assert.equal(free.status, 201);
    assert.equal(free.body.post.category, 'free');
    assert.equal((await request('GET', `/${free.body.post._id}`)).status, 200);
    const notice = await request('POST', '', 'admin', { ...input, category: 'notice', isPrivate: false });
    assert.equal(notice.status, 201);
    assert.equal((await request('DELETE', `/${notice.body.post._id}`, 'admin')).status, 200);
    assert.equal((await request('POST', '', 'owner', { ...input, title: ' ' })).status, 400);
    assert.equal((await request('POST', '', 'owner', { ...input, content: { $ne: '' } })).status, 400);
    assert.equal((await request('GET', '/?page=-1')).status, 400);
    assert.equal((await request('GET', '/bad-id')).status, 400);
  });
});

