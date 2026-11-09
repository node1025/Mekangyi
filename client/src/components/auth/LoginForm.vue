<script setup lang="ts">
import { ref, onUnmounted } from 'vue';              // Vue Composition API의 반응형 상태 관리 도구(ref)
import axios from 'axios';              // HTTP 요청 라이브러리
import { useRouter, useRoute } from 'vue-router'; // 페이지 이동(라우팅)을 위한 Vue Router 훅
import { useUserStore } from '../../utils/userStore';

// 폼 데이터 타입 정의
interface LoginFormData {
  userId: string;
  password: string;
}

// Vue Router 인스턴스
const router = useRouter();
const route = useRoute();

const userStore = useUserStore();

// 폼 상태 (초기값)
const formData = ref<LoginFormData>({
  userId: '',
  password: '',
});

const BASE_URL = `${(import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '')}/api/auth`;
const errorMessage = ref('');       // 에러 메시지 상태
const successMessage = ref('');     // 성공 메시지 상태
const cooldownSeconds = ref(0);
let cooldownTimer: ReturnType<typeof setInterval> | undefined;
onUnmounted(() => { if (cooldownTimer) clearInterval(cooldownTimer); });
const startCooldown = (seconds: number) => {
  if (cooldownTimer) clearInterval(cooldownTimer);
  const until = Date.now() + seconds * 1000;
  cooldownSeconds.value = seconds;
  cooldownTimer = setInterval(() => {
    cooldownSeconds.value = Math.max(0, Math.ceil((until - Date.now()) / 1000));
    if (!cooldownSeconds.value) clearInterval(cooldownTimer);
  }, 1000);
};
const isLoading = ref(false);       // 로딩 상태

const userIdError = ref('');        // 아이디 유효성 검사 에러 메시지
const passwordError = ref('');      // 비밀번호 유효성 검사 에러 메시지

// 아이디 유효성 검사 (영문자와 숫자 조합, 4~16자)
const validateUserId = () => {
  const idValue = formData.value.userId;
  const idRegex = /^[a-zA-Z0-9]{4,16}$/;
  
  if (!idValue) {
    userIdError.value = '';
  } else if (idValue.length < 4 || idValue.length > 16) {
    userIdError.value = '아이디는 4자 이상 16자 이하로 입력해주세요.';
  } else if (!idRegex.test(idValue)) {
    userIdError.value = '아이디는 영문자와 숫자만 사용 가능합니다.';
  } else {
    userIdError.value = ''; // 유효함
  }
};

// 비밀번호 유효성 검사 (영문/숫자/특문 포함, 10자 이상)
const validatePassword = () => {
  const pw = formData.value.password;
  const pwRegex = /^(?=.*[a-zA-Z])(?=.*[0-9])(?=.*[!@#$%^&*()_+|~={}\[\]:";'<>?,.\/]).{10,}$/;

  if (!pw) {
    passwordError.value = '';
  } else if (!pwRegex.test(pw)) {
    passwordError.value = '비밀번호는 최소 10자 이상 영문, 숫자, 특수문자를 포함해야 합니다.';
  } else {
    passwordError.value = ''; // 유효함
  }
};

// 로그인 처리 함수
const handleLogin = async () => {
  if (isLoading.value || cooldownSeconds.value > 0) return;
  validateUserId();
  validatePassword();

  if (userIdError.value || passwordError.value) {
    errorMessage.value = '입력 형식을 다시 확인해주세요.';
    return;
  }

  // 로딩 상태 활성화 및 메시지 초기화
  isLoading.value = true;
  errorMessage.value = '';
  
  try {
    // 백엔드 API에 POST 요청
    const response = await axios.post(`${BASE_URL}/login`, formData.value);
    
    const { accessToken, user, message } = response.data;
    userStore.login(user, accessToken);

    successMessage.value = message || '로그인 성공!';
    
    const redirect =
      typeof route.query.redirect === 'string' && route.query.redirect.startsWith('/')
        ? route.query.redirect
        : '/';
    router.push(redirect);
          
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      // 백엔드에서 보낸 에러 응답 처리
      const errorData = error.response.data;
      if (error.response.status === 429) {
        const wait = Number(error.response.headers['retry-after']);
        startCooldown(Number.isFinite(wait) && wait > 0 ? Math.ceil(wait) : 60);
      }
      if (errorData.message) {
        errorMessage.value = errorData.message;  
      } else {
        errorMessage.value = '로그인 중 알 수 없는 오류가 발생했습니다.';
      }
      console.error('로그인 API 에러:', errorData);
    } else {
      errorMessage.value = '서버와 통신하는 데 실패했습니다. 서버가 실행 중인지 확인하세요.';
      console.error('네트워크 또는 예상치 못한 에러:', error);
    }
  } finally {
    // 로딩 상태 비활성화
    isLoading.value = false;
  }
};
</script>

<template>
  <div class="login-wrapper">
    <div class="login-container">
      <h2 class="title">로그인</h2>
      
      <div class="message-container">
        <p v-if="errorMessage" class="error-message" role="alert">{{ errorMessage }}</p>
      </div>
        
      <form @submit.prevent="handleLogin" class="login-form">
        <div class="input-group">
          <div class="field-wrap">
            <input type="text" v-model="formData.userId" @input="validateUserId" placeholder="아이디를 입력해주세요" required />
            <p v-if="userIdError" class="helper-text">{{ userIdError }}</p>
          </div>
          <div class="field-wrap">
            <input type="password" v-model="formData.password" @input="validatePassword" placeholder="비밀번호를 입력해주세요" required />
            <p v-if="passwordError" class="helper-text">{{ passwordError }}</p>
          </div>
        </div>
    
        <div class="find-links">
          <RouterLink to="/find-id" class="find-link">아이디 찾기</RouterLink>
          <span class="divider">|</span>
          <RouterLink to="/reset-password" class="find-link">비밀번호 찾기</RouterLink>
        </div>
        
        <button type="submit" class="login-btn" :disabled="isLoading || cooldownSeconds > 0">
          {{ cooldownSeconds > 0 ? `${cooldownSeconds}초 후 다시 시도` : isLoading ? '로그인 중...' : '로그인' }}
        </button>

        <RouterLink to="/register" class="signup-btn"> 회원가입 </RouterLink>
      </form>
    </div>
  </div>
</template>

<style scoped>
/* 레이아웃 영역 */
.login-wrapper {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 80vh; /* 화면 중앙 배치 유도 */
  padding: 20px;
}
.login-container {
  width: 100%;
  max-width: 400px; /* 전체적인 너비 조절 */
}

/* 타이포그래피 */
.title {
  text-align: center;
  font-size: 26px;
  font-weight: 800;
  margin-bottom: 30px;
  color: #333;
}

/* 폼 구조 영역 */
.field-wrap {
  margin-bottom: 12px;
  display: flex;
  flex-direction: column;
}
/* 입력창(Input) 스타일 */
.login-form {
  display: flex;
  flex-direction: column;
  width: 100%;
}

/* 입력 요소 */
input {
  width: 100%;
  box-sizing: border-box; /* 패딩을 포함한 너비 계산 */
  height: 52px;
  padding: 0 16px;
  background-color: #ffffff;
  border: 1.5px solid #eee;
  border-radius: 8px;
  font-size:18px;
  color: #000000 !important; 
  font-weight: 500;
  transition: all 0.2s ease-in-out;
  outline: none;
}
/* hover 상태 */
input:hover {
  border-color: #ccc;
}
input:focus {
  border-color: #074CA1;
  box-shadow: 0 0 0 3px rgba(7, 76, 161, 0.1); /* 은은한 후광 효과 */
}

/* 검증 / 메시지 영역 */
.helper-text {
  font-size:16px;
  color: #ee6a7b;
  margin: 4px 0 0 4px;
  font-weight: bold;
}
.message-container {
  min-height: 24px; /* 메시지가 없을 때도 높이 유지하여 레이아웃 흔들림 방지 */
  margin-bottom: 10px;
}
.error-message, .success-message {
  text-align: center;
  font-size:18px;
  margin: 0;
}
.error-message { color: #e74c3c; }

/* 링크 영역 */
.find-links {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  margin-bottom: 24px;
}
.find-link {
  font-size:17px;
  color: #888;
  text-decoration: none;
}
.find-link:hover {
  color: #074CA1;
  text-decoration: underline;
}
.divider {
  margin: 0 8px;
  color: #eee;
  font-size:14px;
}

/* 버튼(Button) 스타일 */
.login-btn {
  width: 100%;
  box-sizing: border-box;
  height: 52px;
  background-color: #074CA1;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size:19px;
  font-weight: 700;
  cursor: pointer;
  transition: background-color 0.2s;
  margin-bottom: 12px;
}
.login-btn:hover:not(:disabled) {
  background-color: #063d82;
}
.login-btn:disabled {
  background-color: #ccc;
  cursor: not-allowed;
}

/* 회원가입 버튼 스타일 */
.signup-btn {
  width: 100%;
  box-sizing: border-box;
  display: block;
  text-align: center;
  height: 52px;
  line-height: 50px;
  border: 1.5px solid #074CA1;
  border-radius: 8px;
  color: #074CA1;
  font-weight: 700;
  text-decoration: none;
  font-size:19px;
  background-color: #fff;
  transition: all 0.2s;
}
.signup-btn:hover {
  background: #dbeafe;
  transform: translateY(-2px);
}

</style>
