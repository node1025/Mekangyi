const fs = require('node:fs');
const fsp = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { Transform, pipeline } = require('node:stream');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { declaredFormat, normalizeImage, failure, MAX_FILE_BYTES, MAX_TOTAL_BYTES } = require('../services/imageValidation');

cloudinary.config({ cloud_name: process.env.CLOUDINARY_CLOUD_NAME, api_key: process.env.CLOUDINARY_API_KEY, api_secret: process.env.CLOUDINARY_API_SECRET });
const temporary = Symbol('temporary');
const byteCount = Symbol('byteCount');
const fieldCounts = Symbol('fieldCounts');

function createUploads({ uploadImage, deleteImage, tempRoot = os.tmpdir(), maxConcurrent = 4 } = {}) {
  let active = 0;
  tempRoot = path.resolve(tempRoot);
  const sendImage = uploadImage || (file => cloudinary.uploader.upload(file.path, {
    resource_type: 'image', folder: 'bukang-shop', public_id: randomUUID(), format: 'webp', overwrite: false, timeout: 15000
  }));
  const removeImage = deleteImage || (id => cloudinary.uploader.destroy(id, { resource_type: 'image', timeout: 15000 }));
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
          if (!result.public_id || !/^https:\/\//.test(result.secure_url || '')) throw failure('이미지 저장에 실패했습니다.', 502);
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
