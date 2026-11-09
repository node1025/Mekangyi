'use strict';

const path = require('node:path');
const crypto = require('node:crypto');

require('dotenv').config({ path: path.join(__dirname, '../.env'), quiet: true });
require('./models.cjs');

const connect = require('../src/config/db');
const maria = require('../src/config/maria');
const User = require('../src/models/user');
const AdminSession = require('../src/models/adminSession');

function pickPasswords() {
  const suppliedLogin = process.env.ADMIN_NEW_PASSWORD?.trim();
  const suppliedReauth = process.env.ADMIN_NEW_REAUTH_PASSWORD?.trim();
  let login = suppliedLogin || `Aa1!${crypto.randomBytes(10).toString('base64url')}`;
  let reauth = suppliedReauth || `Bb2!${crypto.randomBytes(10).toString('base64url')}`;
  while (login === reauth) {
    reauth = `Bb2!${crypto.randomBytes(10).toString('base64url')}`;
  }
  return {
    login,
    reauth,
    generatedLogin: !suppliedLogin,
    generatedReauth: !suppliedReauth
  };
}

async function main() {
  await connect();

  const userId = (process.env.ADMIN_USER_ID || 'demoAdmin').trim();
  const { login, reauth, generatedLogin, generatedReauth } = pickPasswords();

  const user = await User.findOne({ userId, role: 'admin' });
  if (!user) {
    console.error(
      `관리자 계정 "${userId}"을(를) 찾을 수 없습니다.\n` +
      '  · 최초 생성: npm run admin:demo\n' +
      '  · 다른 아이디: ADMIN_USER_ID=아이디 npm run admin:reset-password'
    );
    process.exitCode = 1;
    return;
  }

  user.password = login;
  user.adminReauthPassword = reauth;
  await user.save();
  await AdminSession.deleteMany({ userId: user._id });

  console.log(`관리자 "${userId}" 1·2차 비밀번호를 설정했습니다. (재인증 세션 종료)`);
  console.log('  · 1차 = 관리자 로그인 (STEP 01)');
  console.log('  · 2차 = 재인증 화면 (STEP 02)');
  if (generatedLogin) {
    console.log(`1차 비밀번호(한 번만 표시): ${login}`);
  } else {
    console.log('1차: ADMIN_NEW_PASSWORD 값이 적용되었습니다.');
  }
  if (generatedReauth) {
    console.log(`2차 비밀번호(한 번만 표시): ${reauth}`);
  } else {
    console.log('2차: ADMIN_NEW_REAUTH_PASSWORD 값이 적용되었습니다.');
  }
  if (generatedLogin || generatedReauth) {
    console.log('관리자 페이지 → 계정 설정에서 각각 다시 변경할 수 있습니다.');
  }
}

main()
  .catch((error) => {
    console.error(error.code || error.message || error);
    process.exitCode = 1;
  })
  .finally(() => maria.disconnect());
