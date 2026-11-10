const FIELD_LABELS = {
  userId: '아이디',
  password: '비밀번호',
  name: '이름',
  email: '이메일',
  phone: '휴대폰 번호',
  'address.zipCode': '우편번호',
  'address.basicAddress': '기본 주소',
  'address.detailAddress': '상세 주소',
  birthDate: '생년월일',
  receiver: '받는 분',
  zipCode: '우편번호',
  basicAddress: '기본 주소',
  detailAddress: '상세 주소',
  address: '기본 주소',
};

function fieldLabel(path) {
  return FIELD_LABELS[path] || path.split('.').pop();
}

/** API 응답용 한 줄·여러 줄 요약 (클라이언트 alert 등) */
function summarizeErrors(errors) {
  if (!errors || typeof errors !== 'object') return '';
  return Object.entries(errors)
    .map(([path, detail]) => {
      const msg = (detail && detail.message) || String(detail || '');
      if (!msg) return '';
      const label = fieldLabel(path);
      if (/[가-힣]/.test(msg)) return msg;
      return `${label}: ${msg}`;
    })
    .filter(Boolean)
    .join(' ');
}

function respondValidation(res, error, status = 400) {
  const errors = error.errors || {};
  const message = summarizeErrors(errors) || (error.message && !error.message.includes(':') ? error.message : '') || '입력값을 확인해주세요.';
  return res.status(status).json({ message, errors });
}

/** 마이페이지 배송지·주문 배송 정보 공통 검증 */
function validateShippingAddressFields(address) {
  const errors = {};
  const set = (field, message) => {
    errors[field] = { message };
  };
  if (!address.receiver) set('receiver', '받는 분을 입력해주세요.');
  else if (address.receiver.length > 50) set('receiver', '받는 분은 50자 이내로 입력해주세요.');
  if (!address.phone) set('phone', '연락처를 입력해주세요.');
  else if (!/^\d{10,11}$/.test(address.phone)) set('phone', '연락처는 숫자 10~11자리로 입력해주세요.');
  if (!address.zipCode) set('zipCode', '우편번호를 입력해주세요.');
  else if (!/^\d{5}$/.test(address.zipCode)) set('zipCode', '우편번호는 5자리 숫자여야 합니다.');
  const usesOrderField = typeof address.address === 'string';
  const basicKey = usesOrderField ? 'address' : 'basicAddress';
  const basic = (usesOrderField ? address.address : address.basicAddress) || '';
  if (!basic) set(basicKey, '기본 주소를 입력해주세요. 주소 검색을 이용해주세요.');
  else if (basic.length > 200) set(basicKey, '기본 주소는 200자 이내로 입력해주세요.');
  if (!address.detailAddress) set('detailAddress', '상세 주소를 입력해주세요.');
  else if (address.detailAddress.length > 200) set('detailAddress', '상세 주소는 200자 이내로 입력해주세요.');
  if (!Object.keys(errors).length) return null;
  return { message: summarizeErrors(errors), errors };
}

module.exports = { summarizeErrors, respondValidation, validateShippingAddressFields, fieldLabel };
