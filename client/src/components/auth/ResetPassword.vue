<script setup lang="ts">
import { ref } from 'vue';
import axios from 'axios';
import { useRouter } from 'vue-router';
import { useUserStore } from '../../utils/userStore';

const router = useRouter();
const userStore = useUserStore();
const base = `${(import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '')}/api/auth`;
const userId = ref('');
const phone = ref('');
const password = ref('');
const confirmation = ref('');
const busy = ref(false);
const done = ref(false);
const modalOpen = ref(false);
const errorMessage = ref('');
const modalError = ref('');

function formatPhone(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length < 4) return digits;
  if (digits.length < 8) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

function onPhoneInput(event: Event) {
  phone.value = formatPhone((event.target as HTMLInputElement).value);
}

async function confirmAccount() {
  if (busy.value) return;
  errorMessage.value = '';
  busy.value = true;
  try {
    await axios.post(`${base}/verify-recovery`, {
      userId: userId.value.trim(),
      phone: phone.value.replace(/\D/g, '')
    });
    password.value = '';
    confirmation.value = '';
    modalError.value = '';
    modalOpen.value = true;
  } catch (error) {
    errorMessage.value = axios.isAxiosError(error)
      ? error.response?.data?.message || '일치하는 회원 정보가 없습니다.'
      : '서버와 통신 중 오류가 발생했습니다.';
  } finally {
    busy.value = false;
  }
}

function closeModal() {
  if (busy.value) return;
  modalOpen.value = false;
  modalError.value = '';
}

async function resetPassword() {
  if (busy.value) return;
  modalError.value = '';
  if (password.value !== confirmation.value) {
    modalError.value = '비밀번호가 서로 일치하지 않습니다.';
    return;
  }
  if (!/^(?=.*[A-Za-z])(?=.*\d)(?=.*[!@#$%^&*]).{10,}$/.test(password.value) || new TextEncoder().encode(password.value).length > 72) {
    modalError.value = '영문, 숫자, 특수문자(!@#$%^&*)를 포함하여 10자 이상, 72바이트 이하로 입력해주세요.';
    return;
  }
  busy.value = true;
  try {
    await axios.post(`${base}/reset-password-by-phone`, {
      userId: userId.value.trim(),
      phone: phone.value.replace(/\D/g, ''),
      newPassword: password.value
    });
    password.value = '';
    confirmation.value = '';
    modalOpen.value = false;
    userStore.logout();
    done.value = true;
  } catch (error) {
    modalError.value = axios.isAxiosError(error)
      ? error.response?.data?.message || '비밀번호 변경을 완료하지 못했습니다.'
      : '서버와 통신 중 오류가 발생했습니다.';
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="find-wrapper">
    <div class="find-container">
      <h2 class="title">비밀번호 찾기</h2>
      <form v-if="!done" class="find-form" @submit.prevent="confirmAccount">
        <p class="info-msg">아이디와 휴대폰 번호가 확인되면 비밀번호 변경 창이 열립니다.</p>
        <div class="input-group-stack">
          <div class="field-wrap">
            <label for="recovery-id">아이디</label>
            <input id="recovery-id" v-model.trim="userId" autocomplete="username" maxlength="16" required :disabled="busy" />
          </div>
          <div class="field-wrap">
            <label for="recovery-phone">휴대폰 번호</label>
            <input id="recovery-phone" :value="phone" type="tel" inputmode="numeric" maxlength="13" placeholder="숫자만 입력해주세요" required :disabled="busy" @input="onPhoneInput" />
          </div>
        </div>
        <p v-if="errorMessage" class="error-message" role="alert">{{ errorMessage }}</p>
        <button type="submit" class="submit-btn" :disabled="busy">{{ busy ? '확인 중...' : '확인' }}</button>
      </form>
      <p v-else class="info-msg" role="status">비밀번호가 변경되었습니다. 새 비밀번호로 로그인해주세요.</p>
      <button type="button" class="outline-btn" :disabled="busy" @click="router.push('/login')">로그인으로 이동</button>
      <button type="button" class="outline-btn" :disabled="busy" @click="router.push('/find-id')">아이디 찾기</button>

      <div v-if="modalOpen" class="modal-overlay" @click.self="closeModal">
        <form class="modal-card" @submit.prevent="resetPassword">
          <h3>비밀번호 변경</h3>
          <div class="field-wrap">
            <label for="recovery-password">새 비밀번호</label>
            <input id="recovery-password" v-model="password" type="password" autocomplete="new-password" minlength="10" maxlength="72" required :disabled="busy" />
          </div>
          <div class="field-wrap">
            <label for="recovery-confirm">새 비밀번호 확인</label>
            <input id="recovery-confirm" v-model="confirmation" type="password" autocomplete="new-password" minlength="10" maxlength="72" required :disabled="busy" />
          </div>
          <p v-if="modalError" class="error-message" role="alert">{{ modalError }}</p>
          <button type="submit" class="submit-btn" :disabled="busy">{{ busy ? '변경 중...' : '변경' }}</button>
          <button type="button" class="outline-btn" :disabled="busy" @click="closeModal">취소</button>
        </form>
      </div>
    </div>
  </div>
</template>

<style scoped>
.find-wrapper {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 80vh;
  padding: 20px;
}
.find-container { width: 100%; max-width: 400px; }
.title { text-align: center; font-size: 26px; font-weight: 800; margin-bottom: 16px; color: #333; }
.info-msg { text-align: center; margin-bottom: 24px; font-weight: 600; color: #555; line-height: 1.6; }
.input-group-stack { display: flex; flex-direction: column; gap: 16px; margin-bottom: 20px; }
.field-wrap { display: flex; flex-direction: column; gap: 8px; }
.field-wrap label { font-size: 18px; font-weight: 600; color: #333; }
input {
  width: 100%;
  height: 52px;
  padding: 0 16px;
  border: 1.5px solid #eee;
  border-radius: 8px;
  font-size: 18px;
  color: #000;
  background: #fff;
  box-sizing: border-box;
}
input:focus { border-color: #074CA1; box-shadow: 0 0 0 3px rgba(7, 76, 161, 0.1); outline: none; }
.submit-btn, .outline-btn {
  width: 100%;
  height: 52px;
  border-radius: 8px;
  font-size: 19px;
  font-weight: 700;
  cursor: pointer;
  margin-bottom: 12px;
}
.submit-btn { background: #074CA1; color: #fff; border: none; }
.submit-btn:disabled { background: #ccc; cursor: not-allowed; }
.outline-btn { background: #eff6ff; color: #2563eb; border: 1.5px solid #074CA1; }
.outline-btn:disabled { cursor: not-allowed; opacity: 0.7; }
.error-message { text-align: center; font-size: 18px; font-weight: bold; color: #e74c3c; margin: 0 0 12px; }
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(18, 37, 81, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  z-index: 30;
}
.modal-card {
  width: min(100%, 420px);
  background: #fff;
  border-radius: 16px;
  padding: 28px 24px 16px;
  box-shadow: 0 16px 40px rgba(18, 37, 81, 0.18);
}
.modal-card h3 { margin: 0 0 20px; text-align: center; font-size: 22px; color: #122551; }
.modal-card .field-wrap { margin-bottom: 14px; }
</style>
