<script setup lang="ts">
import { reactive, ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import axios from 'axios';
import { fieldErrorsFromApi, validationSummary } from '../../utils/apiValidation';

// 부모로부터 받은 초기 유저 데이터
const props = defineProps<{
  initialData: any
}>();

const router = useRouter();
const fieldErrors = ref<Record<string, string>>({});
const formError = ref('');

const emailUser = ref('');                // 이메일 아이디 부분
const emailDomain = ref('naver.com');     // 이메일 도메인
const selectedDomain = ref('naver.com');  // 선택된 도메인
const isCustomDomain = ref(false);        // 도메인 직접 입력 여부

const birthYear = ref('');          // 생년월일(연)
const birthMonth = ref('');         // 생년월일(월)
const birthDay = ref('');           // 생년월일(일)

const form = reactive({
  userId: props.initialData.userId || '',
  userName: props.initialData.userName || '',
  email: props.initialData.email || '',
  phone: props.initialData.phone || '',
  gender: props.initialData.gender || 'none',
  birthDate: props.initialData.birthDate ? props.initialData.birthDate.split('T')[0] : '',
  address: {
    zipCode: props.initialData.address?.zipCode || '',
    basicAddress: props.initialData.address?.basicAddress || '',
    detailAddress: props.initialData.address?.detailAddress || '',
  }
});

onMounted(() => {
  // 이메일 분리
  if (form.email && form.email.includes('@')) {
    const [user, domain] = form.email.split('@');
    emailUser.value = user;
    emailDomain.value = domain;
    // 기존 도메인이 목록에 없으면 '직접 입력'으로 설정
    const commonDomains = ['naver.com', 'gmail.com', 'daum.net', 'hanmail.net', 'nate.com'];
    if (commonDomains.includes(domain)) {
      selectedDomain.value = domain;
    } else {
      selectedDomain.value = 'custom';
      isCustomDomain.value = true;
    }
  }

  // 생년월일 분리 (YYYY-MM-DD 형식 가정)
  if (form.birthDate) {
    const [y, m, d] = form.birthDate.split('-');
    birthYear.value = y;
    birthMonth.value = m;
    birthDay.value = d;
  }
});

// 이메일 함수
const handleDomainChange = () => {
  if (selectedDomain.value === 'custom') {
    isCustomDomain.value = true;
    emailDomain.value = '';
  } else {
    isCustomDomain.value = false;
    emailDomain.value = selectedDomain.value;
  }
  updateEmail();
};

const updateEmail = () => {
  form.email = emailUser.value && emailDomain.value ? `${emailUser.value}@${emailDomain.value}` : '';
};

const updateBirthDate = () => {
  if (birthYear.value && birthMonth.value && birthDay.value) {
    form.birthDate = `${birthYear.value}-${birthMonth.value}-${birthDay.value}`;
  }
};

const years = computed(() => {
  const currentYear = new Date().getFullYear();
  return Array.from({ length: currentYear - 1926 + 1 }, (_, i) => currentYear - i);
});
const months = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
const days = computed(() => {
  if (!birthYear.value || !birthMonth.value) return [];
  const lastDay = new Date(Number(birthYear.value), Number(birthMonth.value), 0).getDate();
  return Array.from({ length: lastDay }, (_, i) => String(i + 1).padStart(2, '0'));
});

// 주소 검색 로직
const loadDaumPostcode = () => {
  return new Promise<void>((resolve) => {
    if (window.daum && window.daum.Postcode) { resolve(); return; }
    const script = document.createElement('script');
    script.src = '//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js';
    script.onload = () => resolve();
    document.head.appendChild(script);
  });
};

const openPostcode = async () => {
  await loadDaumPostcode();
  new window.daum.Postcode({
    oncomplete: (data: any) => {
      let fullAddress = data.address;
      let extraAddress = '';
      if (data.userSelectedType === 'R') {
        if (data.bname !== '' && /[동|로|가]$/g.test(data.bname)) extraAddress += data.bname;
        if (data.buildingName !== '' && data.apartment === 'Y') {
          extraAddress += (extraAddress !== '' ? `, ${data.buildingName}` : data.buildingName);
        }
        fullAddress += (extraAddress !== '' ? ` (${extraAddress})` : '');
      }
      form.address.zipCode = data.zonecode;
      form.address.basicAddress = fullAddress;
    },
  }).open();
};

const handlePhoneInput = (e: Event) => {
  const target = e.target as HTMLInputElement;
  let value = target.value.replace(/[^0-9]/g, '');
  if (value.length < 4) form.phone = value;
  else if (value.length < 8) form.phone = `${value.slice(0, 3)}-${value.slice(3)}`;
  else {
    value = value.slice(0, 11);
    form.phone = `${value.slice(0, 3)}-${value.slice(3, 7)}-${value.slice(7)}`;
  }
};

const handleUpdate = async () => {
  fieldErrors.value = {};
  formError.value = '';
  try {
    const token = localStorage.getItem('accessToken'); // 로그인 시 저장한 토큰 가져오기
    
  if (!token) {
    alert('로그인 세션이 만료되었습니다. 다시 로그인해주세요.');
    return;
  }

  // 전송할 데이터 가공
  const updateData = {
    email: form.email,
    phone: form.phone.replace(/-/g, ''),
    gender: form.gender,
    birthDate: form.birthDate,
    address: {
      zipCode: form.address.zipCode,
      basicAddress: form.address.basicAddress,
      detailAddress: form.address.detailAddress,
    }
  };

const response = await axios.patch(
      `${(import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '')}/api/auth/profile`,
      updateData,
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );

    if (response.status === 200) {
      alert('회원 정보가 성공적으로 수정되었습니다.');
      
      // 서버에서 반환한 최신 데이터로 로컬 폼 데이터 동기화
      const user = response.data.user;
      form.email = user.email;
      form.gender = user.gender;
      form.birthDate = user.birthDate ? user.birthDate.split('T')[0] : '';
      
      // 주소 업데이트
      if (user.address) {
        form.address.zipCode = user.address.zipCode;
        form.address.basicAddress = user.address.basicAddress;
        form.address.detailAddress = user.address.detailAddress;
      }

      // 전화번호는 하이픈 포맷팅 로직을 거쳐서 다시 표시
      formatPhone(user.phone);

      router.push('/');
    }
  } catch (error: any) {
    const data = error.response?.data;
    fieldErrors.value = fieldErrorsFromApi(data?.errors);
    formError.value = validationSummary(data, '정보 수정 중 오류가 발생했습니다.');
  }
};

// 전화번호 포맷팅 보조 함수 (동기화용)
const formatPhone = (rawPhone: string) => {
  if (rawPhone.length === 11) {
    form.phone = `${rawPhone.slice(0, 3)}-${rawPhone.slice(3, 7)}-${rawPhone.slice(7)}`;
  } else {
    form.phone = rawPhone;
  }
};

const isPasswordModalOpen = ref(false); // 모달 표시 여부
const passwordForm = reactive({
  currentPassword: '',
  newPassword: '',
  confirmPassword: ''
});

// 모달 열기/닫기
const togglePasswordModal = () => {
  isPasswordModalOpen.value = !isPasswordModalOpen.value;
  // 모달 닫을 때 필드 초기화
  if (!isPasswordModalOpen.value) {
    passwordForm.currentPassword = '';
    passwordForm.newPassword = '';
    passwordForm.confirmPassword = '';
  }
};

// 비밀번호 변경 실행
const handleChangePassword = async () => {
  if (passwordForm.newPassword !== passwordForm.confirmPassword) {
    alert('새 비밀번호와 확인 비밀번호가 일치하지 않습니다.');
    return;
  }
  if (passwordForm.newPassword.length < 10) {
    alert('비밀번호는 10자 이상이어야 합니다.');
    return;
  }

  try {
    const token = localStorage.getItem('accessToken');
    const response = await axios.patch(`${(import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '')}/api/auth/password`,
      {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword
      },
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );

    alert(response.data.message);
    localStorage.removeItem('accessToken');
    window.location.href = '/login';
  } catch (error: any) {
    alert(error.response?.data?.message || '비밀번호 변경 중 오류가 발생했습니다.');
  }
};

</script>

<template>
  <form @submit.prevent="handleUpdate" class="form-body">
    <div class="input-group">
      <label>아이디</label>
      <input type="text" v-model="form.userId" readonly class="readonly-input" />
    </div>
    
    <div class="input-group">
      <label>이름</label>
      <input type="text" v-model="form.userName" readonly class="readonly-input" />
    </div>
    
    <div class="input-group">
      <label>이메일<span class="asterisk">*</span></label>
      <div class="email-input-wrap">
        <input type="text" v-model="emailUser" @input="updateEmail" placeholder="이메일 아이디" required />
        <span class="at">@</span>
        <input type="text" v-model="emailDomain" @input="updateEmail" :readonly="!isCustomDomain" required />
        <select v-model="selectedDomain" @change="handleDomainChange" class="domain-select">
          <option value="naver.com">naver.com</option>
          <option value="gmail.com">gmail.com</option>
          <option value="daum.net">daum.net</option>
          <option value="hanmail.net">hanmail.net</option>
          <option value="nate.com">nate.com</option>
          <option value="custom">직접 입력</option>
        </select>
      </div>
    </div>
    
    <div class="input-group">
      <label>휴대폰<span class="asterisk">*</span></label>
      <input type="tel" :value="form.phone" @input="handlePhoneInput" placeholder="숫자만 입력해주세요" required maxlength="13" />
    </div>

    <div class="input-group">
      <label>주소</label>
      <div class="address-box">
        <div class="input-with-btn">
          <input type="text" v-model="form.address.zipCode" placeholder="우편번호" readonly />
          <button type="button" class="outline-btn" @click="openPostcode">주소검색</button>
        </div>
        <input type="text" v-model="form.address.basicAddress" placeholder="기본 주소" readonly />
        <p v-if="fieldErrors.basicAddress || fieldErrors.zipCode" class="field-error" role="alert">
          {{ fieldErrors.basicAddress || fieldErrors.zipCode }}
        </p>
        <input type="text" v-model="form.address.detailAddress" placeholder="상세 주소" required />
        <p v-if="fieldErrors.detailAddress" class="field-error" role="alert">{{ fieldErrors.detailAddress }}</p>
      </div>
    </div>

    <p v-if="formError" class="field-error form-error" role="alert">{{ formError }}</p>

    <div class="input-group">
      <label>성별</label>
      <div class="radio-group">
        <label class="radio-label"><input type="radio" value="male" v-model="form.gender"> 남자 </label>
        <label class="radio-label"><input type="radio" value="female" v-model="form.gender"> 여자 </label>
        <label class="radio-label"><input type="radio" value="none" v-model="form.gender"> 선택안함 </label>
      </div>
    </div>
    
    <div class="input-group">
      <label>생년월일<span class="asterisk">*</span></label>
      <div class="birth-input-wrap">
        <select v-model="birthYear" @change="updateBirthDate" required>
          <option v-for="year in years" :key="year" :value="year">{{ year }}</option>
        </select>
        <select v-model="birthMonth" @change="updateBirthDate" required>
          <option v-for="month in months" :key="month" :value="month">{{ month }}</option>
        </select>
        <select v-model="birthDay" @change="updateBirthDate" required>
          <option v-for="day in days" :key="day" :value="day">{{ day }}</option>
        </select>
      </div>
    </div>

    <div class="form-actions">
      <button type="button" class="change-pw-btn" @click="togglePasswordModal">비밀번호 변경</button>
      <button type="submit" class="submit-btn">회원정보수정</button>
    </div>
  </form>

  <Teleport to="body">
    <div v-if="isPasswordModalOpen" class="modal-overlay" @click.self="togglePasswordModal">
      <div class="modal-content">
        <h3>비밀번호 변경</h3>
      
        <div class="modal-input-group">
          <label>현재 비밀번호</label>
          <input type="password" v-model="passwordForm.currentPassword" placeholder="현재 비밀번호 입력해주세요." />
        </div>
      
        <div class="modal-input-group">
          <label>새 비밀번호</label>
          <input type="password" v-model="passwordForm.newPassword" placeholder="비밀번호: 10자 이상, 영문/숫자/특수문자 각 1개 이상 포함" />
        </div>
      
        <div class="modal-input-group">
          <label>새 비밀번호 확인</label>
          <input type="password" v-model="passwordForm.confirmPassword" placeholder="새 비밀번호 다시 입력해주세요." />
        </div>

        <div class="modal-actions">
          <button type="button" class="confirm-btn" @click="handleChangePassword">변경하기</button>
          <button type="button" class="cancel-btn" @click="togglePasswordModal">취소</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
/* 폼 전체 영역 */
.form-body {
  padding: 20px 0;
}

/* 입력 그룹 스타일 */
.input-group {
  display: flex;
  align-items: flex-start;
  padding: 15px 0;
  border-bottom: 1px solid #f5f5f5;
}

.input-group label {
  width: 140px;
  min-width: 140px;
  height: 52px;
  display: flex;
  align-items: center;
  font-size:18px;
  font-weight: 700;
  color: #333;
}

/* 주소 입력 스타일 */
.address-box {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.input-with-btn {
  display: flex;
  gap: 8px;
}

/* 라디오 버튼 스타일 */
.radio-group {
  flex: 1;
  display: flex;
  align-items: center;
  height: 52px;
  gap: 40px;
}

.radio-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size:18px;
  cursor: pointer;
}

/* 필수 입력 표시용 별표 */
.asterisk { color: #ee6a7b; }

/* 공통 입력 필드 스타일 */
input[type="text"],
input[type="password"],
input[type="tel"],
select {
  width: 100%;
  height: 52px;
  padding: 0 16px;
  background-color: #fff;
  border: 1.5px solid #eee;
  border-radius: 8px;
  font-size:18px;
  color: #000;
  outline: none;
  transition: all 0.2s;
}

input:focus, select:focus {
  border-color: #074CA1;
  box-shadow: 0 0 0 3px rgba(7, 76, 161, 0.05);
}

/* 라디오 버튼 전용 스타일 */
input[type="radio"] {
  width: auto;
  height: auto;
  margin: 10ㅔㅌ;
  cursor: pointer;
  accent-color: #074CA1;
  transform: scale(1.2);
}

/* 읽기 전용 입력 필드 */
.readonly-input {
  background-color: #f2f2f2 !important;
  color: #666 !important;
  border: 1px solid #eee;
  cursor: default;  
}

/* 이메일 입력 스타일 */
.email-input-wrap {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
}

.email-input-wrap input {
  flex: 1;
}

.at {
  font-size:19px;
  color: #999;
}

.domain-select {
  width: 150px;
}

.birth-input-wrap {
  flex: 1;
  display: flex;
  gap: 10px;
}

.birth-input-wrap select {
  flex: 1;
}

/* 폼 하단 버튼 스타일 */
.form-actions {
  display: flex;
  justify-content: center;
  gap: 12px;
  margin-top: 40px;
}

.button-wrapper {
  margin-top: 40px;
  display: flex;
  justify-content: center;
}

.submit-btn {
  width: 200px;
  height: 56px;
  background-color: #074CA1;
  color: #fff;
  border: none;
  border-radius: 4px;
  font-size:19px;
  font-weight: 700;
  margin: 0;
  display: block;
  cursor: pointer;
  transition: background-color 0.2s;
}

.submit-btn:hover {
  background-color: #063d82;
}

/* 비밀번호 변경 버튼 */
.change-pw-btn {
  width: 200px;
  height: 56px;
  background: #eff6ff;
  color: #666;
  border: 1px solid #333;
  border-radius: 4px;
  font-size:19px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
}

.change-pw-btn:hover {
  background-color: #e9e9e9;
  border-color: #333;
}

/* 외곽선 버튼 */
.outline-btn {
  width: 120px;
  height: 52px;
  border: 1.5px solid #074CA1;
  background: #eff6ff;
  color: #2563eb;
  border-radius: 8px;
  font-weight: 700;
  cursor: pointer;
}

.outline-btn:hover {
  background: #dbeafe;
}

/* 모달 스타일 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%; height: 100%;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  padding: 40px;
  border-radius: 12px;
  width: 100%;
  max-width: 450px;
  box-shadow: 0 10px 25px rgba(0,0,0,0.1);
}

.modal-content h3 {
  margin-bottom: 10px;
  font-size: 20px;
  font-weight: 700;
}

.modal-input-group {
  margin-bottom: 15px;
}

.modal-input-group label {
  display: block;
  font-size:17px;
  font-weight: 600;
  margin-bottom: 8px;
  color: #333;
}

.modal-actions {
  display: flex;
  gap: 10px;
  margin-top: 30px;
}

.modal-actions button {
  flex: 1;
  height: 50px;
  border-radius: 8px;
  font-weight: 700;
  cursor: pointer;
}

.cancel-btn {
  background: #eee;
  border: none;
  color: #666;
}

.confirm-btn {
  background: #074CA1;
  border: none;
  color: white;
}

.confirm-btn:hover {
  background: #153666;
}

/* 애니메이션 */
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.field-error {
  margin: 6px 0 0;
  font-size: 14px;
  color: #c62828;
  line-height: 1.5;
}
.form-error { margin-top: 12px; }
</style>