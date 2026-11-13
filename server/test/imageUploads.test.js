const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const express = require('express');
const sharp = require('sharp');
const { createUploads } = require('../src/middleware/multerConfig');

async function fixture(t, overrides = {}) {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'bukang-upload-tests-'));
  const uploaded = [];
  const removed = [];
  const upload = createUploads({ tempRoot,
    uploadImage: async file => {
      const data = await fs.readFile(file.path);
      uploaded.push({ data, mimetype: file.mimetype });
      return { public_id: `created-${uploaded.length}`, secure_url: `https://example.com/created-${uploaded.length}.webp` };
    }, deleteImage: async id => { removed.push(id); }, ...overrides
  });
  const app = express();
  app.use(express.json());
  app.post('/board', upload.single('image'), (req, res) => res.json({ path: req.file?.path || null }));
  app.post('/review', upload.array('images', 3), (req, res) => res.json({ paths: (req.files || []).map(file => file.path) }));
  app.post('/product', upload.product(), (req, res) => res.json({ count: req.files.length }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(async () => {
    await new Promise(resolve => server.close(resolve));
    // This exact test-owned directory was created above, never supplied by a request.
    assert.equal(path.dirname(path.resolve(tempRoot)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(tempRoot).startsWith('bukang-upload-tests-'));
    await fs.rm(tempRoot, { recursive: true, force: true });
  });
  async function send(route, files) {
    const body = new FormData();
    for (const file of files) body.append(file.field || 'image', new Blob([file.data], { type: file.type || 'image/png' }), file.name || 'image.png');
    const result = await fetch(`http://127.0.0.1:${server.address().port}/${route}`, { method: 'POST', body });
    const json = await result.json();
    assert.deepEqual(await fs.readdir(tempRoot), [], 'temporary files must be removed after every request');
    return { status: result.status, body: json };
  }
  return { send, uploaded, removed, base: `http://127.0.0.1:${server.address().port}` };
}

const image = format => sharp({ create: { width: 24, height: 24, channels: 3, background: '#ccddee' } }).toFormat(format).toBuffer();

test('JPEG, PNG and WebP are fully decoded, re-encoded and metadata is removed', async t => {
  const api = await fixture(t);
  for (const format of ['jpeg', 'png', 'webp']) {
    const data = await sharp(await image(format)).withExif({ IFD0: { Artist: 'private-metadata' } }).toFormat(format).toBuffer();
    assert.equal((await api.send('board', [{ data, name: `photo.${format}`, type: `image/${format}` }])).status, 200);
    const output = api.uploaded.at(-1);
    assert.equal(output.mimetype, 'image/webp');
    const metadata = await sharp(output.data).metadata();
    assert.equal(metadata.format, 'webp');
    assert.equal(metadata.exif, undefined);
    assert.equal(metadata.xmp, undefined);
    assert.ok(!output.data.includes(Buffer.from('private-metadata')));
  }
});

test('spoofed MIME, double extensions, SVG, HTML and corrupt images never reach storage', async t => {
  const api = await fixture(t);
  const png = await image('png');
  const attempts = [
    { data: png, name: 'photo.png', type: 'image/jpeg' },
    { data: png, name: 'photo.jpg.php', type: 'image/jpeg' },
    { data: png, name: 'photo.jpg', type: 'image/jpeg' },
    { data: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'), name: 'photo.png' },
    { data: Buffer.from('<html>payload</html>'), name: 'photo.png' },
    { data: png.subarray(0, 40), name: 'photo.png' }
  ];
  for (const file of attempts) assert.equal((await api.send('board', [file])).status, 400);
  assert.equal(api.uploaded.length, 0);
});

test('file size, pixel count, count and field-name limits reject before storage', async t => {
  const api = await fixture(t);
  const png = await image('png');
  assert.equal((await api.send('board', [{ data: Buffer.alloc(5 * 1024 * 1024 + 1), name: 'huge.png' }])).status, 413);
  const large = await sharp({ create: { width: 5001, height: 4000, channels: 3, background: '#ffffff' } }).png().toBuffer();
  assert.equal((await api.send('board', [{ data: large }])).status, 400);
  assert.equal((await api.send('review', Array.from({ length: 4 }, () => ({ field: 'images', data: png })))).status, 400);
  assert.equal((await api.send('board', [{ field: 'unrecognized', data: png }])).status, 400);
  assert.equal((await api.send('product', [{ field: 'unrecognized', data: png }])).status, 400);
  assert.equal((await api.send('product', [{ field: 'common_thumb', data: png }, { field: 'common_thumb', data: png }])).status, 400);
  assert.equal(api.uploaded.length, 0);
});

test('batch validation precedes all uploads and total input bytes are bounded', async t => {
  const api = await fixture(t);
  const png = await image('png');
  assert.equal((await api.send('review', [{ field: 'images', data: png }, { field: 'images', data: Buffer.from('not an image') }])).status, 400);
  const padded = Buffer.concat([png, Buffer.alloc(4500000)]);
  const oversized = Array.from({ length: 6 }, () => ({ field: 'common_gallery', data: padded }));
  assert.equal((await api.send('product', oversized)).status, 413);
  assert.equal(api.uploaded.length, 0);
});

test('valid dynamic product fields and JSON edits remain supported', async t => {
  const api = await fixture(t);
  const png = await image('png');
  const result = await api.send('product', [
    { field: 'common_thumb', data: png }, { field: 'common_gallery', data: png },
    { field: 'variant_0_thumb', data: png }, { field: 'variant_0_gallery', data: png }
  ]);
  assert.equal(result.status, 200);
  assert.equal(result.body.count, 4);
  const edited = await fetch(`${api.base}/product`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ productData: { description: 'text only' } }) });
  assert.equal(edited.status, 200);
  assert.equal((await edited.json()).count, 0);
});

test('failed external upload rolls back only files created by this batch', async t => {
  const removed = [];
  let calls = 0;
  const api = await fixture(t, {
    uploadImage: async () => {
      if (++calls === 2) throw new Error('private service credentials must not leak');
      return { public_id: 'new-image-only', secure_url: 'https://example.com/new.webp' };
    }, deleteImage: async id => { removed.push(id); }
  });
  const png = await image('png');
  const result = await api.send('review', [{ field: 'images', data: png }, { field: 'images', data: png }]);
  assert.equal(result.status, 502);
  assert.deepEqual(removed, ['new-image-only']);
  assert.ok(!JSON.stringify(result.body).includes('private service credentials'));
});

test('concurrent image processing is bounded and the slot is released after completion', async t => {
  let release;
  let started;
  const entered = new Promise(resolve => { started = resolve; });
  const gate = new Promise(resolve => { release = resolve; });
  const api = await fixture(t, { maxConcurrent: 1, uploadImage: async () => {
    started();
    await gate;
    return { public_id: 'bounded-image', secure_url: 'https://example.com/bounded.webp' };
  } });
  const png = await image('png');
  const first = api.send('board', [{ data: png }]);
  await entered;
  try {
    // Don't use send(): the first request intentionally still owns its temporary directory.
    const body = new FormData(); body.append('image', new Blob([png], { type: 'image/png' }), 'photo.png');
    const blocked = await fetch(`${api.base}/board`, { method: 'POST', body });
    assert.equal(blocked.status, 429);
    assert.equal(blocked.headers.get('retry-after'), '5');
  } finally { release(); }
  assert.equal((await first).status, 200);
  assert.equal((await api.send('board', [{ data: png }])).status, 200);
});

test('authentication and admin authorization run before attachment processing', async t => {
  process.env.JWT_SECRET = 'upload-route-test-key';
  const jwt = require('jsonwebtoken');
  const cloudinary = require('cloudinary').v2;
  let outbound = 0;
  t.mock.method(cloudinary.uploader, 'upload', async () => { outbound++; throw new Error('must not be called'); });
  const app = express();
  app.use('/board', require('../src/routes/board'));
  app.use('/products', require('../src/routes/product'));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const memberToken = jwt.sign({ id: '507f1f77bcf86cd799439011', role: 'user' }, process.env.JWT_SECRET);
  for (const [route, token, expected] of [['board', null, 401], ['products/complex', memberToken, 403]]) {
    const body = new FormData(); body.append('image', new Blob([await image('png')], { type: 'image/png' }), 'photo.png');
    const result = await fetch(`http://127.0.0.1:${server.address().port}/${route}`, {
      method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {}, body
    });
    assert.equal(result.status, expected);
  }
  assert.equal(outbound, 0);
});
