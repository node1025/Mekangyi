const crypto = require('node:crypto');
const User = require('../src/models/user');
const { runDev } = require('./dev-db.cjs');
const { DEFAULT_ADMIN_USER_ID } = require('./default-admin-user.cjs');

async function createDevAdmin() {
  await User.init();
  const userId = (process.env.ADMIN_USER_ID || DEFAULT_ADMIN_USER_ID).trim();
  const email = `${userId}@example.com`;
  if (await User.exists({ $or: [{ userId }, { email }] })) {
    throw new Error('이미 존재하는 개발용 관리자입니다. 기존 계정의 권한·비밀번호는 변경하지 않았습니다.');
  }
  const password = `Aa1!${crypto.randomBytes(18).toString('base64url')}`;
  await User.create({
    userId,
    email,
    password,
    role: 'admin',
    name: '테스트 관리자',
    phone: '00000000000',
    address: { zipCode: '00000', basicAddress: '테스트용 주소', detailAddress: '실제 배송 불가' },
    gender: 'none',
    birthDate: new Date('2000-01-01T00:00:00Z'),
    termsOfService: { agreeTermsOfService: true, agreePrivacyPolicy: true, agreeMarketing: false },
  });
  return { userId, password };
}

if (require.main === module) {
  runDev(async () => {
    const { userId, password } = await createDevAdmin();
    console.log(`관리자 아이디: ${userId}`);
    console.log(`로그인 비밀번호(일회성): ${password}`);
    console.log('안전히 보관 후 관리자 로그인에 입력하세요. 파일에는 저장되지 않습니다.');
  });
}

module.exports = { createDevAdmin };
