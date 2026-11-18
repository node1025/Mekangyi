'use strict';

const crypto = require('node:crypto');
const path = require('node:path');
const fs = require('node:fs');

const slug = `bk-ops-${crypto.randomBytes(4).toString('hex')}`;
const root = `/${slug}`;
const adminEnv = path.join(__dirname, '..', 'admin', '.env');
const line = `VITE_ADMIN_ROUTE_ROOT=${root}`;

console.log('=== 관리자 URL 경로 (추측 방지) ===');
console.log(`접두 경로: ${root}`);
console.log(`1차 로그인: ${root}/sign-in`);
console.log(`2차 재인증: ${root}/verify`);
console.log(`콘솔:       ${root}/desk`);
console.log('');
console.log('운영 도메인 예 (DNS는 별도):');
console.log(`  https://ops-${slug.split('-').pop()}.your-company.internal${root}/sign-in`);
console.log('');
console.log('admin/.env 에 아래 한 줄을 넣고 admin을 다시 빌드하세요.');
console.log(line);

if (process.argv.includes('--write')) {
  let body = '';
  if (fs.existsSync(adminEnv)) {
    body = fs.readFileSync(adminEnv, 'utf8');
    body = body
      .split('\n')
      .filter((row) => !row.startsWith('VITE_ADMIN_ROUTE_ROOT='))
      .join('\n')
      .trimEnd();
    if (body) body += '\n';
  }
  body += `${line}\n`;
  fs.writeFileSync(adminEnv, body);
  console.log(`\n저장됨: ${adminEnv}`);
}
