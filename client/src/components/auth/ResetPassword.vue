<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue';
import axios from 'axios';
import { useRouter } from 'vue-router';
import { useUserStore } from '../../utils/userStore';
const router = useRouter();
const userStore = useUserStore();
const base = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '') + '/api/auth';
const identity = ref({ userId: '', birthDate: '', email: '' });
const code = ref('');
const challenge = ref('');
const token = ref('');
const password = ref('');
const confirmation = ref('');
const step = ref(1);
const busy = ref(false);
const error = ref('');
const message = ref('');
const now = ref(Date.now());
const resendAt = ref(0);
const expiresAt = ref(0);
const cooldown = computed(() => Math.max(0, Math.ceil((resendAt.value - now.value) / 1000)));
const remaining = computed(() => Math.max(0, Math.ceil((expiresAt.value - now.value) / 1000)));
const clock = setInterval(() => { now.value = Date.now(); }, 1000);
onUnmounted(() => clearInterval(clock));
async function perform(action: () => Promise<void>) {
  if (busy.value) return;
  busy.value = true; error.value = '';
  try { await action(); }
  catch (e) { error.value = axios.isAxiosError(e) ? e.response?.data?.message || '요청을 완료하지 못했습니다. 다시 시도해주세요.' : '요청을 완료하지 못했습니다.'; }
  finally { busy.value = false; }
}
function requestCode() {
  if (cooldown.value) return;
  return perform(async () => {
    const { data } = await axios.post(base + '/verify-for-password', identity.value);
    challenge.value = data.challenge; code.value = ''; token.value = '';
    message.value = data.message;
    now.value = Date.now(); resendAt.value = now.value + 60000; expiresAt.value = now.value + 15 * 60000;
    step.value = 2;
  });
}
function verifyCode() {
  return perform(async () => {
    const { data } = await axios.post(base + '/verify-reset-code', { challenge: challenge.value, code: code.value });
    token.value = data.token; challenge.value = ''; code.value = ''; step.value = 3;
  });
}
function resetPassword() {
  if (password.value !== confirmation.value) { error.value = '비밀번호가 서로 일치하지 않습니다.'; return; }
  if (!/^(?=.*[A-Za-z])(?=.*\d)(?=.*[!@#$%^&*]).{10,}$/.test(password.value) || new TextEncoder().encode(password.value).length > 72) {
    error.value = '영문, 숫자, 특수문자(!@#$%^&*)를 포함하여 10자 이상, 72바이트 이하로 입력해주세요.'; return;
  }
  return perform(async () => {
    await axios.patch(base + '/reset-password-unauthenticated', { token: token.value, newPassword: password.value });
    token.value = ''; password.value = ''; confirmation.value = ''; userStore.logout(); step.value = 4;
  });
}
function restart() {
  step.value = 1; challenge.value = ''; token.value = ''; code.value = ''; password.value = ''; confirmation.value = ''; error.value = '';
}
</script>
<template>
  <div class="find-wrapper"><div class="find-container">
    <h2 class="title">비밀번호 찾기</h2>
    <form v-if="step === 1" class="find-form" @submit.prevent="requestCode">
      <p class="info-msg">아이디, 생년월일, 가입 이메일이 모두 일치하면 등록된 이메일로 6자리 인증번호를 보내드립니다.</p>
      <div class="input-group-stack">
        <div class="field-wrap"><label for="recovery-id">아이디</label><input id="recovery-id" v-model.trim="identity.userId" autocomplete="username" maxlength="100" required :disabled="busy" /></div>
        <div class="field-wrap"><label for="recovery-birth">생년월일</label><input id="recovery-birth" v-model="identity.birthDate" type="date" required :disabled="busy" /></div>
        <div class="field-wrap"><label for="recovery-email">가입 이메일</label><input id="recovery-email" v-model.trim="identity.email" type="email" autocomplete="email" maxlength="254" required :disabled="busy" /></div>
      </div>
      <button class="submit-btn" :disabled="busy || cooldown > 0">{{ busy ? '요청 중…' : cooldown > 0 ? cooldown + '초 후 요청 가능' : '인증번호 받기' }}</button>
    </form>
    <form v-else-if="step === 2" class="find-form" @submit.prevent="verifyCode">
      <p class="info-msg" role="status">{{ message }}</p>
      <p class="info-msg">남은 시간 {{ Math.floor(remaining / 60) }}분 {{ remaining % 60 }}초 · 5회 실패 시 다시 요청해주세요.</p>
      <div class="field-wrap"><label for="recovery-code">인증번호</label><input id="recovery-code" v-model.trim="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" minlength="6" maxlength="6" placeholder="6자리 숫자" required :disabled="busy" /></div>
      <button class="submit-btn" :disabled="busy || remaining === 0">인증번호 확인</button>
      <button type="button" class="outline-btn" :disabled="busy || cooldown > 0" @click="requestCode">{{ cooldown > 0 ? cooldown + '초 후 재발송 가능' : '인증번호 다시 받기' }}</button>
      <button type="button" class="outline-btn" :disabled="busy" @click="restart">회원정보 다시 입력</button>
    </form>
    <form v-else-if="step === 3" class="find-form" @submit.prevent="resetPassword">
      <p class="info-msg">이메일 인증이 완료되었습니다. 영문, 숫자, 특수문자(!@#$%^&amp;*)를 포함한 10자 이상의 새 비밀번호를 입력해주세요.</p>
      <div class="input-group-stack">
        <div class="field-wrap"><label for="recovery-password">새 비밀번호</label><input id="recovery-password" v-model="password" type="password" autocomplete="new-password" minlength="10" maxlength="72" required :disabled="busy" /></div>
        <div class="field-wrap"><label for="recovery-confirm">새 비밀번호 확인</label><input id="recovery-confirm" v-model="confirmation" type="password" autocomplete="new-password" minlength="10" maxlength="72" required :disabled="busy" /></div>
      </div>
      <button class="submit-btn" :disabled="busy">{{ busy ? '변경 중…' : '비밀번호 변경' }}</button>
      <button type="button" class="outline-btn" :disabled="busy" @click="restart">인증 다시 시작</button>
    </form>
    <p v-else class="info-msg" role="status">비밀번호가 변경되었습니다. 새 비밀번호로 로그인해주세요.</p>
    <p v-if="error" class="error-message" role="alert">{{ error }}</p>
    <button type="button" class="outline-btn" :disabled="busy" @click="router.push('/login')">로그인으로 이동</button>
  </div></div>
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

.info-msg {
  text-align: center;
  margin-bottom: 20px;
  font-weight: 600;
  color: #555;
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

.error-message { color: #b42318; overflow-wrap: anywhere; }
@media (max-width: 480px) {
  .email-input-wrap { flex-wrap: wrap; }
  .email-input-wrap input { min-width: 0; }
  .domain-select { width: 100%; }
}
</style>
