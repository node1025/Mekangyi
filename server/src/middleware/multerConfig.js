const fs = require('node:fs');
const fsp = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { Transform, pipeline } = require('node:stream');
const multer = require('multer');
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { declaredFormat, normalizeImage, failure, MAX_FILE_BYTES, MAX_TOTAL_BYTES } = require('../services/imageValidation');

// Uploaded images are private S3 objects. Both CloudFront sites read /uploads/* through OAC.
// Development mode defaults to local storage. Production must set IMAGE_STORAGE=s3 explicitly.
const storageMode = () => process.env.IMAGE_STORAGE || (process.env.NODE_ENV === 'production' ? 'unconfigured' : 'local');
const localImageUploads = () => storageMode() === 'local';
const uploadsRoot = path.resolve(__dirname, '../../uploads');
const dynamicDir = path.join(uploadsRoot, 'dynamic');
const s3 = new S3Client({ region: process.env.AWS_REGION || 'ap-northeast-2' });
const newKey = () => `uploads/dynamic/${randomUUID()}.webp`;
const validS3Key = key => /^uploads\/dynamic\/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.webp$/i.test(key);

function storedPathOk(url) {
  if (storageMode() === 's3') return validS3Key(url || '');
  // HTTPS allows tests to inject an external upload result; no production service uses it.
  return /^https:\/\//.test(url || '') || (localImageUploads() && /^uploads\/dynamic\//.test(url || ''));
}

async function uploadToDisk(file) {
  await fsp.mkdir(dynamicDir, { recursive: true });
  const name = `${randomUUID()}.webp`;
  const dest = path.join(dynamicDir, name);
  await fsp.rename(file.path, dest);
  const relative = `uploads/dynamic/${name}`;
  return { public_id: relative, secure_url: relative };
}

async function removeFromDisk(id) {
  const relative = String(id || '').replace(/^uploads[\\/]/, '');
  if (!relative.startsWith('dynamic/')) return;
  const file = path.resolve(dynamicDir, path.basename(relative));
  if (!file.startsWith(dynamicDir + path.sep)) return;
  await fsp.unlink(file).catch(() => {});
}

async function uploadToS3(file) {
  const Bucket = process.env.S3_IMAGE_BUCKET;
  if (!Bucket) throw new Error('S3_IMAGE_BUCKET가 설정되지 않았습니다.');
  const Key = newKey();
  await s3.send(new PutObjectCommand({
    Bucket, Key,
    Body: await fsp.readFile(file.path), // Already decoded/converted by normalizeImage()
    ContentType: 'image/webp',
    CacheControl: 'public,max-age=31536000,immutable'
  }));
  // Preserve the API contract: controller stores relative path in MariaDB.
  return { public_id: Key, secure_url: Key };
}

async function removeFromS3(key) {
  if (!validS3Key(key)) throw new Error('Invalid S3 object key');
  const Bucket = process.env.S3_IMAGE_BUCKET;
  if (!Bucket) throw new Error('S3_IMAGE_BUCKET가 설정되지 않았습니다.');
  await s3.send(new DeleteObjectCommand({ Bucket, Key: key }));
}

function defaultSendImage(file) {
  if (storageMode() === 's3') return uploadToS3(file);
  if (localImageUploads()) return uploadToDisk(file);
  throw new Error('Production image storage requires IMAGE_STORAGE=s3');
}

function defaultRemoveImage(id) {
  if (storageMode() === 's3') return removeFromS3(id);
  if (localImageUploads()) return removeFromDisk(id);
  throw new Error('Production image storage requires IMAGE_STORAGE=s3');
}

const temporary = Symbol('temporary');
const byteCount = Symbol('byteCount');
const fieldCounts = Symbol('fieldCounts');

function createUploads({ uploadImage, deleteImage, tempRoot = os.tmpdir(), maxConcurrent = 4 } = {}) {
  let active = 0;
  tempRoot = path.resolve(tempRoot);
  const sendImage = uploadImage || defaultSendImage;
  const removeImage = deleteImage || defaultRemoveImage;
  const directory = req => req[temporary] ||= fsp.mkdtemp(path.join(tempRoot, 'bukang-upload-'));
  const clean = async req => {
    if (!req[temporary]) return;
    const folder = path.resolve(await req[temporary]);
    if (path.dirname(folder) !== tempRoot || !path.basename(folder).startsWith('bukang-upload-')) throw new Error('Invalid upload cleanup path');
    await fsp.rm(folder, { recursive: true, force: true });
  };
  const storage = {
    _handleFile(req, file, callback) {
      directory(req).then(folder => {
        const filename = randomUUID();
        const destination = path.join(folder, filename);
        const writer = fs.createWriteStream(destination, { flags: 'wx' });
        const counter = new Transform({ transform(chunk, _encoding, done) {
          req[byteCount] = (req[byteCount] || 0) + chunk.length;
          done(req[byteCount] > MAX_TOTAL_BYTES ? failure('첨부파일은 요청당 합계 25MB 이하로 첨부해주세요.', 413) : null, chunk);
        } });
        pipeline(file.stream, counter, writer, error => callback(error, error ? undefined : {
          destination: folder, filename, path: destination, size: writer.bytesWritten
        }));
      }).catch(callback);
    },
    _removeFile(_req, file, callback) { fsp.unlink(file.path).then(() => callback(null), callback); }
  };

  function middleware(mode, field, maximum) {
    const parser = multer({
      storage,
      limits: { fileSize: MAX_FILE_BYTES, files: maximum, fields: 12, fieldSize: 256 * 1024, fieldNameSize: 100, parts: maximum + 12 },
      fileFilter(req, file, callback) {
        try {
          declaredFormat(file);
          if (mode === 'product') {
            const valid = /^(common_(thumb|gallery)|variant_(0|[1-9]\d?)_(thumb|gallery))$/.test(file.fieldname);
            if (!valid) throw failure('허용되지 않은 상품 이미지 필드입니다.');
            const counts = req[fieldCounts] ||= new Map();
            const count = (counts.get(file.fieldname) || 0) + 1;
            counts.set(file.fieldname, count);
            if (count > (file.fieldname.endsWith('_thumb') ? 1 : 8)) throw failure('썸네일은 1장, 각 갤러리는 8장까지 첨부할 수 있습니다.');
          }
          callback(null, true);
        } catch (error) { callback(error); }
      }
    });
    const parse = mode === 'product' ? parser.any() : mode === 'single' ? parser.single(field) : parser.array(field, maximum);
    return async (req, res, next) => {
      if (!req.is('multipart/form-data')) {
        if (mode === 'product') req.files = [];
        return next();
      }
      if (active >= maxConcurrent) {
        res.set('Retry-After', '5');
        return res.status(429).json({ message: '이미지 처리 요청이 많습니다. 잠시 후 다시 시도해주세요.' });
      }
      active++;
      const uploadedIds = [];
      let error;
      try {
        await new Promise((resolve, reject) => parse(req, res, err => err ? reject(err) : resolve()));
        const files = req.file ? [req.file] : req.files || [];
        // Validate the entire batch before the first external upload.
        for (const file of files) await normalizeImage(file);
        for (const file of files) {
          if (req.aborted || res.destroyed) throw failure('업로드 요청이 중단되었습니다.');
          let result;
          try { result = await sendImage(file); }
          catch { throw failure('이미지 저장 서비스에 연결하지 못했습니다. 잠시 후 다시 시도해주세요.', 502); }
          if (result.public_id) uploadedIds.push(result.public_id);
          if (!result.public_id || !storedPathOk(result.secure_url)) throw failure('이미지 저장에 실패했습니다.', 502);
          file.path = result.secure_url;
          file.filename = result.public_id;
          delete file.destination;
        }
        if (req.aborted || res.destroyed) throw failure('업로드 요청이 중단되었습니다.');
      } catch (caught) {
        error = caught;
        await Promise.allSettled(uploadedIds.map(id => removeImage(id)));
      } finally {
        try { await clean(req); } catch { console.error('Upload temporary-file cleanup failed.'); }
        active--;
      }
      if (error) {
        if (req.aborted || res.destroyed) return;
        const status = error.code === 'LIMIT_FILE_SIZE' ? 413 : error instanceof multer.MulterError ? 400 : error.status || 400;
        const message = error.code === 'LIMIT_FILE_SIZE' ? '이미지는 파일당 5MB 이하로 첨부해주세요.'
          : error instanceof multer.MulterError ? '첨부파일 개수·용량·전송 필드를 확인해주세요.'
          : error.uploadValidation ? error.message : '첨부파일을 처리하지 못했습니다.';
        return res.status(status).json({ message });
      }
      next();
    };
  }
  return {
    single: field => middleware('single', field, 1),
    array: (field, count) => middleware('array', field, count),
    product: () => middleware('product', null, 20)
  };
}

module.exports = { ...createUploads(), createUploads };
