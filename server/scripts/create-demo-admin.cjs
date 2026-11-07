const crypto = require('node:crypto');
const User = require('../src/models/user');
const { runDemo } = require('./demo-db.cjs');

async function createDemoAdmin() {
  await User.init();
  const userId = 'demoAdmin';
  const email = 'demo-admin@example.com';
  if (await User.exists({ $or: [{ userId }, { email }] })) {
    throw new Error('이미 존재하는 데모 관리자입니다. 기존 계정의 권한·비밀번호는 변경하지 않았습니다.');
  }
  const password = `Aa1!${crypto.randomBytes(18).toString('base64url')}`;
  await User.create({
    userId, email, password, role: 'admin', name: '테스트 관리자', phone: '00000000000',
    address: { zipCode: '00000', basicAddress: '테스트용 주소', detailAddress: '실제 배송 불가' },
    gender: 'none', birthDate: new Date('2000-01-01T00:00:00Z'),
    termsOfService: { agreeTermsOfService: true, agreePrivacyPolicy: true, agreeMarketing: false }
  });
  return { userId, password };
}

if (require.main === module) runDemo(async () => {
  const { userId, password } = await createDemoAdmin();
  console.log(`관리자 아이디: ${userId}`);
  console.log(`일회성 표시 비밀번호: ${password}`);
  console.log('비밀번호를 별도로 보관한 뒤 로그인해주세요. 이 값은 파일에 저장되지 않습니다.');
});

module.exports = { createDemoAdmin };
