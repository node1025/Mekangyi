<script setup lang="ts">
import { ref, computed } from 'vue';              // Vue Composition API의 반응형 상태 관리 도구(ref, computed)
import axios from 'axios';                        // HTTP 요청 라이브러리
import { useRouter } from 'vue-router';           // 페이지 이동(라우팅)을 위한 Vue Router 훅
import { TERMS_DATA } from '../../member/terms';  // 약관 전문 데이터
import { fieldErrorsFromApi, validationSummary } from '../../utils/apiValidation';

// 회원가입 폼 데이터 타입 정의
interface RegisterFormData {
  userId: string;
  password: string;
  name: string;
  email: string;
  phone: string;
  gender: 'male' | 'female' | 'none';
  birthDate: string;
  address: {
    zipCode: string;
    basicAddress: string;
    detailAddress: string;
  };
  termsOfService: {
    agreeTermsOfService: boolean;
    agreePrivacyPolicy: boolean;
    agreeMarketing: boolean;
  };
}

// 회원가입 폼 상태 (초기값)
const formData = ref<RegisterFormData>({
  userId: '',
  password: '',
  name: '',
  email: '',
  phone: '',
  gender: 'none',
  birthDate: '',
  address: {
    zipCode: '',
    basicAddress: '',
    detailAddress: '',
  },
  termsOfService: {
    agreeTermsOfService: false,
    agreePrivacyPolicy: false,
    agreeMarketing: false,
  },
});

const BASE_URL = `${(import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '')}/api/auth`;
const router = useRouter();         // 회원가입 완료 후 로그인 페이지 이동

const isLoading = ref(false);       // 회원가입 진행 중 상태
const errorMessage = ref('');       // 에러 메시지 상태
const fieldErrors = ref<Record<string, string>>({});
const successMessage = ref('');     // 성공 메시지 상태

const isIdChecked = ref(false);     // 아이디 중복 확인 완료 여부
const idCheckMessage = ref('');     // 아이디 중복 확인 결과 메시지
const idValidationError = ref('');  // 아이디 형식 오류 메시지

const passwordConfirm = ref('');    // 비밀번호 확인용 상태

const emailUser = ref('');                // 이메일 아이디 부분
const emailDomain = ref('naver.com');     // 이메일 도메인
const selectedDomain = ref('naver.com');  // 선택된 도메인
const isCustomDomain = ref(false);        // 도메인 직접 입력 여부

const birthYear = ref('');          // 생년월일(연)
const birthMonth = ref('');         // 생년월일(월)
const birthDay = ref('');           // 생년월일(일)

const isModalOpen = ref(false);     // 약관 모달 상태
const modalContent = ref({ title: '', body: '' });  // 약관 모달 내용

// 아이디 입력 변경 시 중복 확인 상태 초기화
const resetIdCheck = () => {
  isIdChecked.value = false;
  idCheckMessage.value = '';
  
  const idValue = formData.value.userId;  // 입력된 아이디
  const idRegex = /^[a-zA-Z0-9]{4,16}$/;  // 영문자와 숫자 조합, 4~16자

  if (!idValue) {
    idValidationError.value = '';
  } else if (idValue.length < 4 || idValue.length > 16) {
    idValidationError.value = '아이디는 4자 이상 16자 이하로 입력해주세요.';
  } else if (!/^(?=.*[a-zA-Z])(?=.*[0-9]).+$/.test(idValue)) {
    idValidationError.value = '영문자와 숫자를 조합하여 입력해주세요.';
  } else if (!idRegex.test(idValue)) {
    idValidationError.value = '아이디는 영문자와 숫자만 사용 가능합니다.';
  } else {
    idValidationError.value = ''; // 유효함
  }
};

// 아이디 중복 확인 요청
const checkDuplicateId = async () => {
  if (!formData.value.userId) {
    idCheckMessage.value = '아이디를 입력해주세요.';
    return;
  }

  if (idValidationError.value) {
    idCheckMessage.value = '형식에 맞는 아이디를 입력한 후 중복확인을 해주세요.';
    return;
  }

  try {
    const response = await axios.post(`${BASE_URL}/check-id`, {
      userId: formData.value.userId 
    });

    if (response.data.isAvailable) {
      isIdChecked.value = true;
      idCheckMessage.value = '사용 가능한 아이디입니다.';
    } else {
      isIdChecked.value = false;
      idCheckMessage.value = '이미 사용 중인 아이디입니다.';
    }
  } catch (error) {
    idCheckMessage.value = '확인 중 오류가 발생했습니다.';
  }
};

const passwordValidationError = ref('');  // 비밀번호 유효성 에러 메시지

// 비밀번호 유효성 검사
const validatePassword = () => {
  const pw = formData.value.password;
  const pwRegex = /^(?=.*[a-zA-Z])(?=.*[0-9])(?=.*[!@#$%^&*()_+|~={}\[\]:";'<>?,.\/]).{10,}$/;  // 영문자, 숫자, 특수문자 조합 (10자 이상)

  if (!pw) {
    passwordValidationError.value = '';
  } else if (!pwRegex.test(pw)) {
    passwordValidationError.value = '비밀번호는 최소 10자 이상 영문, 숫자, 특수문자를 포함해야 합니다.';
  } else {
    passwordValidationError.value = ''; // 유효함
  }
};

// 비밀번호 일치 여부 계산
const isPasswordMatched = computed(() => {
  if (!passwordConfirm.value) return null; // 아무것도 입력 안 했을 때
  return formData.value.password === passwordConfirm.value;
});

// 휴대폰 번호 입력 처리(숫자만 허용, 하이픈(-) 자동 삽입)
const handlePhoneInput = (e: Event) => {
  const target = e.target as HTMLInputElement;
  
  let value = target.value.replace(/[^0-9]/g, '');  // 숫자 제외한 문자 제거
  
  // 길이에 따라 하이픈 삽입
  if (value.length < 4) {
    formData.value.phone = value;
  } else if (value.length < 8) {
    formData.value.phone = `${value.slice(0, 3)}-${value.slice(3)}`;
  } else if (value.length < 12) {
    formData.value.phone = `${value.slice(0, 3)}-${value.slice(3, 7)}-${value.slice(7)}`;
  } else {
    // 최대 11자리 제한
    value = value.slice(0, 11);
    formData.value.phone = `${value.slice(0, 3)}-${value.slice(3, 7)}-${value.slice(7)}`;
  }
};

// 키보드 입력 단계에서 숫자와 기능키 제외하고 차단
const onlyNumberKey = (e: KeyboardEvent) => {
  const allowedKeys = ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab', 'Home', 'End'];
  // 숫자가 아니면서 허용된 기능키도 아닌 경우 차단
  if (!/[0-9]/.test(e.key) && !allowedKeys.includes(e.key)) {
    e.preventDefault();
  }
};

// 이메일 도메인 선택 변경
const handleDomainChange = () => {
  if (selectedDomain.value === 'custom') {
    isCustomDomain.value = true;
    emailDomain.value = ''; // 직접 입력을 위해 비움
  } else {
    isCustomDomain.value = false;
    emailDomain.value = selectedDomain.value;
  }
  updateEmail();
};

// 분리된 이메일 값을 formData.email로 합치기
const updateEmail = () => {
  if (emailUser.value && emailDomain.value) {
    formData.value.email = `${emailUser.value}@${emailDomain.value}`;
  } else {
    formData.value.email = '';
  }
};

// 다음(카카오) 주소 검색 스크립트 로드
const loadDaumPostcode = () => {
  return new Promise<void>((resolve) => {
    if (window.daum && window.daum.Postcode) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = '//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js';
    script.onload = () => resolve();
    document.head.appendChild(script);
  });
};

// 주소 검색 팝업 실행 및 선택된 주소 매핑
const openPostcode = async () => {
  await loadDaumPostcode();
  
  new window.daum.Postcode({
    oncomplete: (data: any) => {
      let fullAddress = data.address;
      let extraAddress = '';

      // 도로명 주소 선택 시 추가 정보 처리
      if (data.userSelectedType === 'R') {
        if (data.bname !== '' && /[동|로|가]$/g.test(data.bname)) {
          extraAddress += data.bname;
        }
        if (data.buildingName !== '' && data.apartment === 'Y') {
          extraAddress += (extraAddress !== '' ? `, ${data.buildingName}` : data.buildingName);
        }
        fullAddress += (extraAddress !== '' ? ` (${extraAddress})` : '');
      }

      formData.value.address.zipCode = data.zonecode;
      formData.value.address.basicAddress = fullAddress;
      
      // 상세 주소 입력 칸으로 포커스 이동
      const detailInput = document.querySelector('input[placeholder="상세 주소를 입력해주세요"]') as HTMLInputElement;
      if (detailInput) detailInput.focus();
    },
  }).open();
};

// 생년월일 (연도) 옵션 생성
const years = computed(() => {
  const currentYear = new Date().getFullYear();
  return Array.from({ length: currentYear - 1926 + 1 }, (_, i) => currentYear - i);
});

// 생년월일 (월) 옵션 생성
const months = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));

// 생년월일 (일) 옵션 생성, 선택된 연도와 월에 따라 유동적으로 변함
const days = computed(() => {
  if (!birthYear.value || !birthMonth.value) return [];
  // 해당 월의 마지막 날짜 구하기
  const lastDay = new Date(Number(birthYear.value), Number(birthMonth.value), 0).getDate();
  return Array.from({ length: lastDay }, (_, i) => String(i + 1).padStart(2, '0'));
});

// 생년월일을 formData.birthDate에 반영 ('YYYY-MM-DD' 형식)
const updateBirthDate = () => {
  if (birthYear.value && birthMonth.value && birthDay.value) {
    formData.value.birthDate = `${birthYear.value}-${birthMonth.value}-${birthDay.value}`;
  } else {
    formData.value.birthDate = '';
  }
};

// 전체 약관 동의 체크박스(개별 약관과 양방향 연동)
const isAllAgreed = computed({
  get() {
    return (
      formData.value.termsOfService.agreeTermsOfService &&
      formData.value.termsOfService.agreePrivacyPolicy &&
      formData.value.termsOfService.agreeMarketing
    );
  },
  
  set(value: boolean) {
    formData.value.termsOfService.agreeTermsOfService = value;
    formData.value.termsOfService.agreePrivacyPolicy = value;
    formData.value.termsOfService.agreeMarketing = value;
  }
});

// 약관 모달 열기
const openModal = (type: keyof typeof TERMS_DATA) => {
  const content = TERMS_DATA[type];
  
  if (content) {
    modalContent.value = content;
    isModalOpen.value = true;
    document.body.style.overflow = 'hidden'; 
  } else {
    console.error(`해당 약관 데이터를 찾을 수 없습니다: ${type}`);
  }
};

// 약관 모달 닫기
const closeModal = () => {
  isModalOpen.value = false;
  document.body.style.overflow = '';
};

// 회원 가입 처리 함수
const handleRegister = async () => {
  // 아이디 중복 확인 여부 체크
  if (!isIdChecked.value) {
    errorMessage.value = '아이디 중복 확인을 진행해주세요.';
    return;
  }

  // 비밀번호 형식 체크 추가
  if (passwordValidationError.value || !formData.value.password) {
    errorMessage.value = '비밀번호 형식을 다시 확인해주세요.';
    return;
  }

  // 비밀번호 확인
  if (!formData.value.password || !passwordConfirm.value) {
    errorMessage.value = '비밀번호를 입력해주세요.';
    return;
  }
  
  if (!isPasswordMatched.value) {
    errorMessage.value = '비밀번호가 서로 일치하지 않습니다.';
    return;
  }

  // 필수 약관 동의 확인
  if (!formData.value.termsOfService.agreeTermsOfService || !formData.value.termsOfService.agreePrivacyPolicy) {
    errorMessage.value = '필수 약관(서비스 이용 및 개인정보 처리)에 동의해야 합니다.';
    return;
  }

  // 로딩 상태 활성화 및 메시지 초기화
  isLoading.value = true;
  errorMessage.value = '';
  fieldErrors.value = {};
  successMessage.value = '';
  
  try {
    // 하이픈 제거 후 서버 전송
    const payload = {
      ...formData.value,
      phone: formData.value.phone.replace(/-/g, '') 
    };
    
    const response = await axios.post(`${BASE_URL}/register`, payload);
    // 성공 처리
    successMessage.value = response.data.message || '회원가입이 성공적으로 완료되었습니다.';

    alert('회원가입이 완료되었습니다.');
    router.push('/login');
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      const errorData = error.response.data;
      fieldErrors.value = fieldErrorsFromApi(errorData.errors);
      errorMessage.value = validationSummary(errorData, '회원가입 중 오류가 발생했습니다.');
    } else {
      errorMessage.value = '서버와 통신하는 데 실패했습니다.';
    }
  } finally {
    // 로딩 상태 비활성화
    isLoading.value = false;
  }
};
</script>

<template>
  <div class="register-wrapper">
    <div class="register-container">
      <h2 class="title">회원가입</h2>
      
      <p class="required-info"><span class="asterisk">*</span> 필수입력사항 </p>
      
      <form @submit.prevent="handleRegister" class="form-body">
        <div class="input-group">
          <label>아이디<span class="asterisk">*</span></label>
          <div class="input-column">
            <div class="input-with-btn">
              <input type="text" v-model="formData.userId" @input="resetIdCheck" placeholder="영문/숫자 조합 4~16자" required maxlength="16" />
              <button type="button" class="outline-btn" @click="checkDuplicateId" :disabled="!!idValidationError"> 중복확인 </button>
            </div>
            
            <p v-if="idValidationError" class="helper-msg error-text"> {{ idValidationError }} </p>
            <p v-if="idCheckMessage" class="helper-msg" :class="{ 'success-text': isIdChecked, 'error-text': !isIdChecked }"> {{ idCheckMessage }} </p>
          </div>
        </div>
        
        <div class="input-group">
          <label>비밀번호<span class="asterisk">*</span></label>
          <div class="input-column">
            <input type="password" v-model="formData.password" @input="validatePassword" placeholder="비밀번호를 입력해주세요" required />
            <p v-if="passwordValidationError" class="helper-msg error-text"> {{ passwordValidationError }} </p>
          </div>
        </div>
        
        <div class="input-group">
          <label>비밀번호 확인<span class="asterisk">*</span></label>
          <div class="input-column">
            <input type="password" v-model="passwordConfirm" placeholder="비밀번호를 다시 입력해주세요" required />
            <p v-if="passwordConfirm" class="helper-msg" :class="{ 'success-text': isPasswordMatched, 'error-text': !isPasswordMatched }">
              {{ isPasswordMatched ? '비밀번호가 일치합니다.' : '비밀번호가 일치하지 않습니다.' }}
            </p>
          </div>
        </div>

        <div class="input-group">
          <label>이름<span class="asterisk">*</span></label>
          <input type="text" v-model="formData.name" placeholder="이름을 입력해주세요" required />
        </div>
        
        <div class="input-group">
          <label>이메일<span class="asterisk">*</span></label>
          <div class="email-input-wrap">
            <input type="text" v-model="emailUser" @input="updateEmail" placeholder="이메일 아이디" required />
            <span class="at">@</span>
            <input type="text" v-model="emailDomain" @input="updateEmail" :placeholder="isCustomDomain ? '도메인 입력' : ''" :readonly="!isCustomDomain" required />
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
          <input type="tel" :value="formData.phone" @input="handlePhoneInput" @keydown="onlyNumberKey" placeholder="숫자만 입력해주세요" required maxlength="13" inputmode="numeric" />
        </div>

        <div class="input-group">
          <label>주소<span class="asterisk">*</span></label>
          <div class="address-box">
            <div class="input-with-btn">
              <input type="text" v-model="formData.address.zipCode" placeholder="우편번호" readonly />
              <button type="button" class="outline-btn" @click="openPostcode"> 주소검색 </button>
            </div>
            <input type="text" v-model="formData.address.basicAddress" placeholder="기본 주소" readonly />
            <p v-if="fieldErrors.basicAddress || fieldErrors.zipCode" class="helper-msg error-text">
              {{ fieldErrors.basicAddress || fieldErrors.zipCode }}
            </p>
            <input type="text" v-model="formData.address.detailAddress" placeholder="상세 주소를 입력해주세요" required />
            <p v-if="fieldErrors.detailAddress" class="helper-msg error-text">{{ fieldErrors.detailAddress }}</p>
          </div>
        </div>

        <div class="input-group">
          <label>성별</label>
          <div class="radio-group gender-group">
            <label class="radio-label"><input type="radio" value="male" v-model="formData.gender"> 남자 </label>
            <label class="radio-label"><input type="radio" value="female" v-model="formData.gender"> 여자 </label>
            <label class="radio-label"><input type="radio" value="none" v-model="formData.gender"> 선택안함 </label>
          </div>
        </div>
        
        <div class="input-group">
          <label>생년월일<span class="asterisk">*</span></label>
          <div class="birth-input-wrap">
            <select v-model="birthYear" @change="updateBirthDate" required>
              <option value="" disabled selected>년</option>
              <option v-for="year in years" :key="year" :value="year">{{ year }}</option>
            </select>
            <select v-model="birthMonth" @change="updateBirthDate" required>
              <option value="" disabled selected>월</option>
              <option v-for="month in months" :key="month" :value="month">{{ month }}</option>
            </select>
            <select v-model="birthDay" @change="updateBirthDate" required>
              <option value="" disabled selected>일</option>
              <option v-for="day in days" :key="day" :value="day">{{ day }}</option>
            </select>
          </div>
        </div>
        
        <div class="terms-list">
          <label class="check-label all-agree">
            <input type="checkbox" v-model="isAllAgreed">
            <strong>전체 동의합니다.</strong>
          </label>
          
          <div class="terms-item">
            <label class="check-label">
              <input type="checkbox" v-model="formData.termsOfService.agreeTermsOfService" required> 이용약관 동의 <span>(필수)</span>
            </label>
            <button type="button" class="view-btn" @click="openModal('service')">약관보기 ></button>
          </div>
          
          <div class="terms-item">
            <label class="check-label">
              <input type="checkbox" v-model="formData.termsOfService.agreePrivacyPolicy" required> 개인정보 수집·이용 동의 <span>(필수)</span>
            </label>
            <button type="button" class="view-btn" @click="openModal('privacy')">약관보기 ></button>
          </div>
          
          <div class="terms-item">
            <label class="check-label">
              <input type="checkbox" v-model="formData.termsOfService.agreeMarketing"> 마케팅 광고 활용을 위한 수집 및 이용동의 <span>(선택)</span>
            </label>
            <button type="button" class="view-btn" @click="openModal('marketing')">약관보기 ></button>
          </div>
        </div>
        
        <Teleport to="body">
          <div v-if="isModalOpen" class="modal-overlay" @click.self="closeModal">
            <div class="modal-content">
              <div class="modal-header">
                <h3 class="modal-title">{{ modalContent.title }}</h3>
              </div>

              <div class="modal-body" v-html="modalContent.body"></div>

              <div class="modal-footer">
                <button type="button" class="modal-close-btn" @click="closeModal"> 확인 </button>
              </div>
            </div>
          </div>
        </Teleport>

        <p v-if="errorMessage" class="error-msg"> {{ errorMessage }} </p>

        <button type="submit" class="submit-btn" :disabled="isLoading">
          {{ isLoading ? '가입 진행 중...' : '가입하기' }}
        </button>
      </form>
    </div>
  </div>
</template>

<style scoped>
/* 전체 컨테이너 중앙 정렬 및 박스 설정 */
.register-wrapper {
  display: flex;            /* 자식 요소를 플렉스 박스로 배치 */
  justify-content: center;  /* 가로 중앙 정렬 */
  padding: 60px 20px;       /* 모바일 환경 여백 확보 */
}

.register-container {
  width: 100%;
  max-width: 640px;         /* 폼 최대 너비 제한 */
}

.title {
  text-align: center;
  font-size: 26px;
  font-weight: 800;
  margin-bottom: 30px;
  color: #333;
}

/* 필수 입력 안내 문구 */
.required-info {
  font-size:16px;
  text-align: right;
  padding-bottom: 10px;
  border-bottom: 2px solid #333;
}

/* 필수 항목 표시용 별표(*) */
.asterisk {
  color: #ee6a7b;
}

/* 폼 내부 전체 영역 */
.form-body {
  padding: 30px 0;
}

/* 라벨 + 입력 요소가 한 줄로 배치되는 영역 */
.input-group {
  display: flex;
  align-items: flex-start;  /* 에러 메시지로 높이 늘어나도 라벨 고정 */
  padding: 12px 0;
}

/* 좌측 라벨 영역 (항목명) */
  .input-group label {
  width: 139px;
  min-width: 139px;         /* 줄바꿈 방지 */
  height: 52px;
  display: flex;
  align-items: center;
  font-weight: 500;
  font-size:18px;
  color: #333;
}

/* 입력창 + 메시지를 세로로 쌓는 컬럼 */
.input-column {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

/* 입력창 옆에 버튼이 붙는 경우 */
.input-with-btn {
  flex: 1;
  display: flex;
  gap: 8px;
}

/* 공통 입력 필드 스타일 */
.input-group input[type="text"],
.input-group input[type="password"],
.input-group input[type="email"],
.input-group input[type="tel"],
.input-group input[type="date"],
.address-box input {
  width: 100%;
  height: 52px;
  padding: 0 16px;
  background-color: #fff;
  border: 1.5px solid #eee;
  border-radius: 8px;
  font-size:18px;
  color: #000;
  box-sizing: border-box;
  outline: none;
}

/* 이메일 입력 레이아웃 */
.email-input-wrap {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
}

.email-input-wrap input {
  flex: 1;      /* 아이디와 도메인 입력창이 동일한 비율로 확장 */
  min-width: 0; /* flex 안에서 input이 삐져나가는 현상 방지 */
}

.at {
  font-size:19px;
  color: #666;
}

.domain-select {
  width: 140px;
  height: 52px;
  padding: 0 10px;
  border: 1.5px solid #eee;
  border-radius: 8px;
  font-size:18px;
  background-color: #fff;
  cursor: pointer;
  outline: none;
}

.domain-select:focus {
  border-color: #074CA1;
}

/* 날짜 입력 필드 전용 커서 설정 */
.input-group input[type="date"] {
  cursor: pointer;
}

/* 날짜 선택 아이콘 및 스핀 버튼 커서 */
.input-group input[type="date"]::-webkit-inner-spin-button,
.input-group input[type="date"]::-webkit-calendar-picker-indicator {
  cursor: pointer;
}

/* 입력창 포커스 시 강조 효과 */
.input-group input:focus {
  border-color: #074CA1;
  box-shadow: 0 0 0 3px rgba(7, 76, 161, 0.1);
}

/* 버튼(Button) 스타일 */
.outline-btn {
  width: 120px;
  height: 52px;
  border: 1.5px solid #074CA1;
  background: #eff6ff;
  color: #2563eb;
  border-radius: 8px;
  font-weight: 700;
  cursor: pointer;
  flex-shrink: 0;     /* 버튼 크기 고정 */
}

/* 보조 버튼 호버 효과 */
.outline-btn:hover {
  background: #dbeafe;
  transform: translateY(-2px);
}

/* 주소 입력 묶음 */
.address-box {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* 성별 라디오 버튼 그룹 */
.radio-group.gender-group {
  flex: 1;
  display: flex;
  align-items: center;
  height: 52px;
  gap: 24px;
}

/* 라디오/체크박스 + 텍스트 라벨 */
.radio-label {
  display: flex;
  align-items: center;
  gap: 6px;             /* 아이콘과 글자 사이 간격 */
  font-size:18px;
  cursor: pointer;
  white-space: nowrap;  /* 글자 줄바꿈 방지 */
  user-select: none;    /* 텍스트 선택 방지 */
}

/* 라디오/체크박스 공통 스타일 */
input[type="radio"],
input[type="checkbox"] {
  accent-color: #074CA1;
  width: 18px;
  height: 18px;
  margin: 0;
  cursor: pointer;
}

/* 생년월일 레이아웃 */
.birth-input-wrap {
  flex: 1;
  display: flex;
  gap: 10px;
}

.birth-input-wrap select {
  flex: 1;
  height: 52px;
  padding: 0 12px;
  border: 1.5px solid #eee;
  border-radius: 8px;
  font-size:18px;
  background-color: #fff;
  cursor: pointer;
  outline: none;
}

.birth-input-wrap select:focus {
  border-color: #074CA1;
}

/* 값이 선택되지 않았을 때(placeholder 역할)의 글자색 */
.birth-input-wrap select:invalid {
  color: #999;
}

/* 약관 전체 컨테이너 */
.terms-container {
  display: flex;
  align-items: flex-start;
  padding: 12px 0;
}

/* 약관 제목 영역 */
.terms-title {
  width: 139px;
  min-width: 139px;
  height: 52px;
  display: flex;
  align-items: center;
  font-weight: 500;
  font-size:18px;
  color: #333;
}

/* 약관 체크박스 리스트 */
.terms-list {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 15px;
  padding-top: 16px;
}

/* 전체 동의 영역 */
.all-agree {
  margin-bottom: 5px;
}

.all-agree strong {
  font-size:19px;
  color: #333;
}

/* 체크박스 라벨 */
.check-label {
  font-size:18px;
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 24px;
}

.check-label span {
  color: #999;  /* 선택 설명 텍스트 */
}

/* 약관 항목 한 줄 레이아웃 */
.terms-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

/* 약관 보기 버튼(Button) 스타일 */
.view-btn {
  background: #fff;
  border: none;
  color: #074CA1;
  font-size:17px;
  cursor: pointer;
  padding: 0;
  text-decoration: none;
  outline: none;
}

/* 모달 배경 오버레이 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;             /* 너비를 화면 가득 */
  height: 100vh;            /* 높이를 화면 가득 */
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;  /* 가로 중앙 */
  align-items: center;      /* 세로 중앙 */
  z-index: 9999;            /* 다른 요소보다 항상 위에 배치 */
}

/* 모달 본문 컨테이너 */
.modal-content {
  background: #fff;
  width: 90%;
  max-width: 440px;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.15);
  display: flex;
  flex-direction: column;
  margin: auto;
}

/* 모달 헤더 */
.modal-header {
  padding: 30px 20px 15px;  /* 상단 여백 확대 */
  text-align: center;
  border-bottom: none;      /* 구분선 제거 */
}

.modal-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #333;
  width: 100%;
}

/* 모달 본문 (약관 내용) */
.modal-body {
  padding: 10px 24px;
  max-height: 450px;
  overflow-y: auto;
  font-size:18px;
  line-height: 1.6;
  color: #666;            /* 본문은 약간 흐리게 */
  white-space: pre-line;
  text-align: left;
}

/* 스크롤바 커스텀 */
.modal-body::-webkit-scrollbar {
  width: 4px;
}
.modal-body::-webkit-scrollbar-thumb {
  background-color: #ddd;
  border-radius: 10px;
}

/* 모달 하단 버튼 영역 */
.modal-footer {
  padding: 10px 0 20px;   /* 하단 여백 */
  border-top: none;       /* 구분선 제거 */
  display: flex;
  justify-content: center;
}

.modal-close-btn {
  width: auto;
  min-width: 100px;
  height: auto;
  background: none;
  color: #074CA1;
  border: none;
  font-size:19px;
  font-weight: 600;
  cursor: pointer;
  padding: 10px 20px;
  outline: none;
}

/* 모달 내부 테이블 스타일 */
:deep(.terms-table) {
  width: 100%;
  border-collapse: collapse;
  margin-top: 8px;
  font-size:16px;
  border-top: 1px solid #ccc;
}

:deep(.terms-table th), 
:deep(.terms-table td) {
  border: 1px solid #eee;
  padding: 10px 5px;
  text-align: center;
  vertical-align: middle;
  line-height: 1.4;
}

:deep(.terms-table th) {
  background-color: #f9f9f9;
  font-weight: 600;
  color: #333;
}

:deep(.terms-table td) {
  color: #666;
}

/* 테이블 위 제목 및 아래 안내 문구 */
:deep(.table-title) {
  font-size:18px;
  font-weight: bold;
  margin-top: 20px;
  margin-bottom: 8px;
  color: #333;
}

:deep(.table-notice) {
  font-size:15px;
  color: #888;
  margin-top: 8px;
  line-height: 1.4;
}

/* 입력 안내 / 에러 메시지 */
.helper-msg {
  font-size:16px;
  font-weight: bold;
}

.success-text {
  color: #074CA1;
}

.error-text {
  color: #ee6a7b;
}

.error-msg {
  margin-top: 20px;
  text-align: center;
  font-size:18px;
  color: #ee6a7b;
}

/* 회원가입 제출 버튼(Button) 스타일 */
.submit-btn {
  width: 240px;
  height: 56px;
  background-color: #074CA1;
  color: #fff;
  border: none;
  border-radius: 4px;
  font-size:19px;
  font-weight: 700;
  margin: 40px auto 0;
  display: block;
  cursor: pointer;
  transition: background-color 0.2s;
}

.submit-btn:hover:not(:disabled) {
  background-color: #063d82;
}

.submit-btn:disabled {
  background-color: #ddd;
  cursor: not-allowed;
}

/* 모바일 (통합 미디어 쿼리) */
@media (max-width: 480px) {
  .email-input-wrap {     /* 이메일 입력 */
    flex-wrap: wrap;
    gap: 6px;
  }
  
  .domain-select {
    width: 100%;
    height: 48px;
  }

  .input-group {          /* 라벨 영역 */
    flex-direction: column;
    padding: 8px 0;
  }

  .input-group label, .terms-title {
    width: 100%;
    min-width: 100%;
    height: auto;
    padding-bottom: 8px;
  }

  .radio-group.gender-group {   /* 성별 선택 영역 */
    gap: 0;
    height: auto;
    padding: 5px 0;
  }
  
  .radio-label {
    font-size:17px;
    gap: 4px;
  }

  .birth-input-wrap {   /* 생년월일 선택 영역 */
    gap: 5px;
  }

  .submit-btn {         /* 회원가입 버튼 영역 */
    width: 100%;
    margin-top: 30px;
  }
}

</style>