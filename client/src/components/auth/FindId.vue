<script setup lang="ts">
import { ref } from 'vue';
import axios from 'axios';
import { useRouter } from 'vue-router';

const router = useRouter();
const base = `${(import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '')}/api/auth`;
const name = ref('');
const phone = ref('');
const busy = ref(false);
const errorMessage = ref('');
const found = ref<{ userId: string } | null>(null);

function formatPhone(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length < 4) return digits;
  if (digits.length < 8) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

function onPhoneInput(event: Event) {
  phone.value = formatPhone((event.target as HTMLInputElement).value);
}

async function handleFindId() {
  if (busy.value) return;
  busy.value = true;
  errorMessage.value = '';
  found.value = null;
  try {
    const { data } = await axios.post(`${base}/find-email`, {
      name: name.value.trim(),
      phone: phone.value.replace(/\D/g, '')
    });
    found.value = { userId: data.userId };
  } catch (error) {
    errorMessage.value = axios.isAxiosError(error)
      ? error.response?.data?.message || '일치하는 회원 정보가 없습니다.'
      : '서버와 통신 중 오류가 발생했습니다.';
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="find-wrapper">
    <div class="find-container">
      <h2 class="title">아이디 찾기</h2>
      <p class="info-msg">가입할 때 입력한 이름과 휴대폰 번호가 일치하면 아이디 일부를 보여드립니다.</p>

      <form v-if="!found" class="find-form" @submit.prevent="handleFindId">
        <div class="input-group-stack">
          <div class="field-wrap">
            <label for="find-id-name">이름</label>
            <input id="find-id-name" v-model="name" type="text" maxlength="100" placeholder="이름을 입력해주세요" required :disabled="busy" />
          </div>
          <div class="field-wrap">
            <label for="find-id-phone">휴대폰 번호</label>
            <input id="find-id-phone" :value="phone" type="tel" inputmode="numeric" maxlength="13" placeholder="숫자만 입력해주세요" required :disabled="busy" @input="onPhoneInput" />
          </div>
        </div>
        <p v-if="errorMessage" class="error-message" role="alert">{{ errorMessage }}</p>
        <button type="submit" class="submit-btn" :disabled="busy">{{ busy ? '찾는 중...' : '아이디 찾기' }}</button>
        <button type="button" class="outline-btn" @click="router.push('/login')">로그인</button>
      </form>

      <div v-else class="result-box">
        <div class="result-info">
          <p class="user-id">아이디 <strong>{{ found.userId }}</strong></p>
        </div>
        <button type="button" class="submit-btn" @click="router.push('/login')">로그인</button>
        <button type="button" class="outline-btn" @click="router.push('/reset-password')">비밀번호 찾기</button>
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
  font-weight: 500;
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
.result-box { text-align: center; }
.result-info { background: #f8f9fb; padding: 30px 20px; border-radius: 12px; margin-bottom: 24px; }
.user-id { font-size: 17px; margin: 0 0 12px; color: #333; overflow-wrap: anywhere; }
.user-id strong { color: #074CA1; font-size: 20px; }
.error-message { text-align: center; font-size: 18px; font-weight: bold; color: #e74c3c; margin: 0 0 12px; }
</style>
