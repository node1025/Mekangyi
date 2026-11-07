const fs = require('node:fs/promises');
const path = require('node:path');
const sharp = require('sharp');

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_TOTAL_BYTES = 25 * 1024 * 1024;
const MAX_PIXELS = 20_000_000;
const declaredTypes = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };
const failure = (message, status = 400) => Object.assign(new Error(message), { status, uploadValidation: true });

function declaredFormat(file) {
  const expected = declaredTypes[path.extname(file.originalname).toLowerCase()];
  if (!expected || file.mimetype !== expected) throw failure('JPEG·PNG·WebP 이미지만 첨부할 수 있습니다. 확장자와 파일 형식을 확인해주세요.');
  return expected === 'image/jpeg' ? 'jpeg' : expected.slice(6);
}

function signature(buffer) {
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'png';
  if (buffer.length >= 3 && buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255) return 'jpeg';
  if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  return null;
}

async function normalizeImage(file) {
  const expected = declaredFormat(file);
  const input = await fs.readFile(file.path);
  if (input.length > MAX_FILE_BYTES) throw failure('이미지는 파일당 5MB 이하로 첨부해주세요.', 413);
  if (signature(input) !== expected) throw failure('파일 내용이 확장자·MIME 형식과 일치하지 않습니다.');
  try {
    const options = { failOn: 'warning', limitInputPixels: MAX_PIXELS };
    const metadata = await sharp(input, options).metadata();
    if (metadata.format !== expected || !metadata.width || !metadata.height || metadata.width > 10000 || metadata.height > 10000 || (metadata.pages || 1) > 1) {
      throw failure('애니메이션 또는 허용 크기를 초과한 이미지는 첨부할 수 없습니다.');
    }
    // Fully decode and re-encode; never send the original bytes to public storage.
    const output = await sharp(input, options).rotate()
      .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 85 }).timeout({ seconds: 5 }).toBuffer();
    if (output.length > MAX_FILE_BYTES) throw failure('변환된 이미지가 허용 용량을 초과했습니다.', 413);
    await fs.writeFile(file.path, output);
    file.size = output.length;
    file.mimetype = 'image/webp';
  } catch (error) {
    if (error.uploadValidation) throw error;
    throw failure('손상되었거나 처리할 수 없는 이미지입니다. 정적 이미지와 2,000만 화소 이하의 파일을 사용해주세요.');
  }
}

module.exports = { declaredFormat, normalizeImage, failure, MAX_FILE_BYTES, MAX_TOTAL_BYTES };
