'use strict';

const path = require('node:path');
const crypto = require('node:crypto');

require('dotenv').config({ path: path.join(__dirname, '../.env'), quiet: true });
require('./models.cjs');

const connect = require('../src/config/db');
const maria = require('../src/config/maria');
const User = require('../src/models/user');
const AdminSession = require('../src/models/adminSession');
const { DEFAULT_ADMIN_USER_ID } = require('./default-admin-user.cjs');

async function main() {
  await connect();

  const userId = (process.env.ADMIN_USER_ID || DEFAULT_ADMIN_USER_ID).trim();
  const supplied = process.env.ADMIN_NEW_PASSWORD?.trim();
  const generated = !supplied;
  const login = supplied || `Aa1!${crypto.randomBytes(10).toString('base64url')}`;

  const user = await User.findOne({ userId, role: 'admin' });
  if (!user) {
    console.error(
      `관리자 계정 "${userId}"을(를) 찾을 수 없습니다.\n` +
      '  · 최초 생성: npm run admin:dev\n' +
      '  · 다른 아이디: ADMIN_USER_ID=아이디 npm run admin:reset-password'
    );
    process.exitCode = 1;
    return;
  }

  user.password = login;
  await user.save();
  await AdminSession.deleteMany({ userId: user._id });

  console.log(`관리자 "${userId}" 로그인 비밀번호를 설정했습니다. (보호 세션 종료)`);
  if (generated) {
    console.log(`비밀번호(한 번만 표시): ${login}`);
  } else {
    console.log('ADMIN_NEW_PASSWORD 값이 적용되었습니다.');
  }
  console.log('관리자 페이지 → 계정 설정에서 다시 변경할 수 있습니다.');
}

main()
  .catch((error) => {
    console.error(error.code || error.message || error);
    process.exitCode = 1;
  })
  .finally(() => maria.disconnect());
