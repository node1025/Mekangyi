<script setup lang="ts">
import { ref } from 'vue';              // Vue Composition API의 반응형 상태 관리 도구(ref)
import axios from 'axios';              // HTTP 요청 라이브러리
import { useRouter } from 'vue-router'; // 페이지 이동(라우팅)을 위한 Vue Router 훅

// 아이디 찾기 방식 타입 정의
type FindMethod = 'email' | 'phone';

// 폼 상태 (초기값)
const formData = ref({
  name: '',
  email: '',
  phone: ''
});

const BASE_URL = `${(import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '')}/api/auth`;
const router = useRouter();

const findMethod = ref<FindMethod>('email');  // 현재 선택된 아이디 찾기 방식 (기본값: 이메일)

const searchResult = ref<{ userId: string; joinDate: string } | null>(null); // 아이디 찾기 성공 시 서버에서 받은 결과

const emailUser = ref('');                // 이메일 아이디 부분
const emailDomain = ref('naver.com');     // 이메일 도메인
const selectedDomain = ref('naver.com');  // 선택된 도메인
const isCustomDomain = ref(false);        // 도메인 직접 입력 여부

const isLoading = ref(false); // 로딩 상태
const errorMessage = ref(''); // 에러 메시지 상태

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

// 아이디 찾기 방식 변경
const setMethod = (method: FindMethod) => {
  findMethod.value = method;      // 방식 변경
  searchResult.value = null;      // 이전 결과 초기화
  errorMessage.value = '';        // 에러 메시지 초기화
  formData.value.email = '';      // 이메일 초기화
  formData.value.phone = '';      // 휴대폰 초기화
};

// 아이디 찾기 요청 처리
const handleFindId = async () => {
  isLoading.value = true;          // 로딩 시작
  errorMessage.value = '';         // 에러 초기화
  searchResult.value = null;       // 결과 초기화

  try {
    // 서버로 보낼 데이터 구성
    const payload = {
      name: formData.value.name,
      // 선택된 방식에 따라 email 또는 phone 동적 설정
      [findMethod.value]: findMethod.value === 'email' 
        ? formData.value.email 
        : formData.value.phone.replace(/-/g, '') // 하이픈 제거
    };

    // 아이디 찾기 API 호출
    const response = await axios.post(`${BASE_URL}/find-id`, payload);

    // 성공 시 결과 저장
    searchResult.value = response.data;
  } catch (error: any) {
    if (axios.isAxiosError(error) && error.response) {
      errorMessage.value = error.response.data.message || '일치하는 정보가 없습니다.';
    } else {
      errorMessage.value = '서버와 통신 중 오류가 발생했습니다.';
    }
  } finally {
    // 로딩 상태 비활성화
    isLoading.value = false;
  }
};

// 날짜 포맷 변환 (YYYY.MM.DD)
const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
};
</script>

<template>
  <div class="find-wrapper">
    <div class="find-container">
      <h2 class="title">아이디 찾기</h2>

      <div class="tab-group">
        <button type="button" :class="{ active: findMethod === 'email' }" @click="setMethod('email')">이메일로 찾기</button>
        <button type="button" :class="{ active: findMethod === 'phone' }" @click="setMethod('phone')">휴대폰 번호로 찾기</button>
      </div>
      
      <form v-if="!searchResult" @submit.prevent="handleFindId" class="find-form">
        <div class="input-group-stack">
          <div class="field-wrap">
            <label>이름</label>
            <input type="text" v-model="formData.name" placeholder="이름을 입력해주세요" required />
          </div>

          <div v-if="findMethod === 'email'" class="field-wrap">
            <label>이메일</label>
            <div class="email-input-wrap">
              <input type="text" v-model="emailUser" @input="updateEmail" placeholder="이메일 아이디" required />
              <span class="at">@</span>
              <input type="text" v-model="emailDomain" @input="updateEmail" :readonly="!isCustomDomain" placeholder="도메인" required />
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

          <div v-else class="field-wrap">
            <label>휴대폰 번호</label>
            <input type="tel" :value="formData.phone" @input="handlePhoneInput" @keydown="onlyNumberKey" placeholder="숫자만 입력해주세요" required maxlength="13" />
          </div>
        </div>

        <div class="message-container">
          <p v-if="errorMessage" class="error-message">{{ errorMessage }}</p>
        </div>

        <button type="submit" class="submit-btn" :disabled="isLoading">
          {{ isLoading ? '찾는 중...' : '확인' }}
        </button>
        <button type="button" class="outline-btn" @click="router.push('/login')">로그인</button>
      </form>

      <div v-else class="result-box">
        <div class="result-info">
          <p class="user-id">아이디: <strong>{{ searchResult.userId }}</strong></p>
          <p class="join-date">가입일: {{ formatDate(searchResult.joinDate) }}</p>
        </div>
        
        <div class="result-btns">
          <button class="submit-btn" @click="router.push('/login')"> 로그인 </button>
          <button class="outline-btn" @click="router.push('/reset-password')"> 비밀번호 찾기 </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 레이아웃 */
.find-wrapper {     /* 페이지 중앙에 아이디 찾기 영역을 배치 */
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 80vh;
  padding: 20px;
}

.find-container {   /* 아이디 찾기 컨텐츠의 최대 너비 제한 */
  width: 100%;
  max-width: 400px;
}

.title {            /* 페이지 상단 제목 스타일 */
  text-align: center;
  font-size: 26px;
  font-weight: 800;
  margin-bottom: 30px;
  color: #333;
}

/* 탭 메뉴 */
.tab-group {        /* 탭 버튼을 가로로 배치하고 하단 경계선 표시 */
  display: flex;
  margin-bottom: 24px;
  border-bottom: 1.5px solid #eee;
}
.tab-group button { /* 탭 버튼 기본 스타일 */
  flex: 1;
  padding: 14px 0;
  background: none;
  border: none;
  font-size:18px;
  font-weight: 500;
  color: #888;
  cursor: pointer;
  position: relative;
  transition: all 0.2s;
}
.tab-group button.active {        /* 선택된 탭 강조 스타일 */
  color: #074CA1;
  font-weight: 700;
}
.tab-group button.active::after { /* 선택된 탭 하단에 파란 라인 표시 */
  content: "";
  position: absolute;
  left: 0; right: 0;
  bottom: -1.5px;
  height: 3px;
  background-color: #074CA1;
}

/* 입력 필드 공통 스타일 */
.input-group-stack {  /* 여러 입력 필드를 세로로 정렬 */
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-bottom: 20px;
}

.field-wrap {        /* 각 입력 필드 묶음 */
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.field-wrap label {   /* 입력 필드 라벨 스타일 */
  font-size:18px;
  font-weight: 600;
  color: #333;
}

/* input, select 스타일 */
input, .domain-select {
  width: 100%;
  height: 52px;
  padding: 0 16px;
  border: 1.5px solid #eee;
  border-radius: 8px;
  font-size:18px;
  font-weight: 500;
  color: #000;
  background-color: #fff;
  box-sizing: border-box;
  outline: none;
  transition: all 0.2s ease-in-out;
}
input:focus, .domain-select:focus {
  border-color: #074CA1;
  box-shadow: 0 0 0 3px rgba(7, 76, 161, 0.1);
}

/* 이메일 전용 레이아웃 */
.email-input-wrap {
  display: flex;
  align-items: center;
  gap: 6px;
}
.email-input-wrap input { flex: 1; }
.domain-select { width: 110px; padding: 0 5px; } /* select 너비만 별도 지정 */
.at { color: #888; }

/* 버튼 공통 스타일 */
.submit-btn, .outline-btn {
  width: 100%;
  height: 52px;
  border-radius: 8px;
  font-size:19px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
  margin-bottom: 12px;
  box-sizing: border-box;
  display: flex;
  justify-content: center;
  align-items: center;
}

/* 버튼 개별 색상 */
.submit-btn {
  background-color: #074CA1;
  color: #fff;
  border: none;
}
.submit-btn:hover:not(:disabled) { background-color: #063d82; }
.submit-btn:disabled { background-color: #ccc; cursor: not-allowed; }

.outline-btn {
  background-color: #eff6ff;
  color: #2563eb;
  border: 1.5px solid #074CA1;
}
.outline-btn:hover { 
  background: #dbeafe;
  transform: translateY(-2px);
}

/* 결과 및 에러 메시지 */
.result-box { text-align: center; }
.result-info {
  background-color: #f8f9fb;
  padding: 30px 20px;
  border-radius: 12px;
  margin-bottom: 24px;
}

.user-id { font-size: 17px; margin-bottom: 8px; color: #333; }
.user-id strong { color: #074CA1; font-size: 20px; }
.join-date { font-size:17px; color: #888; }

.message-container { min-height: 24px; margin-bottom: 10px; }
.error-message {
  text-align: center;
  font-size:18px;
  font-weight: bold;
  color: #e74c3c;
}
</style>