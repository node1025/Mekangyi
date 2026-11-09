<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import axios from 'axios';
import { useUserStore } from '../../utils/userStore';

const router = useRouter();
const store = useUserStore();

const currentPassword = ref('');
const newPassword = ref('');
const confirmPassword = ref('');
const withdrawPassword = ref('');

const loginForReauth = ref('');
const currentReauth = ref('');
const newReauth = ref('');
const confirmReauth = ref('');

const pwdMessage = ref('');
const pwdError = ref('');
const reauthMessage = ref('');
const reauthError = ref('');
const withdrawError = ref('');
const busyPassword = ref(false);
const busyReauth = ref(false);
const busyWithdraw = ref(false);

const pwRegex = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[!@#$%^&*]).{10,}$/;

async function changePassword() {
  pwdMessage.value = '';
  pwdError.value = '';
  if (!currentPassword.value || !newPassword.value || !confirmPassword.value) {
    pwdError.value = '모든 비밀번호 항목을 입력해주세요.';
    return;
  }
  if (newPassword.value !== confirmPassword.value) {
    pwdError.value = '새 비밀번호 확인이 일치하지 않습니다.';
    return;
  }
  if (!pwRegex.test(newPassword.value)) {
    pwdError.value = '새 비밀번호는 영문, 숫자, 특수문자를 포함해 10자 이상이어야 합니다.';
    return;
  }
  if (busyPassword.value) return;
  busyPassword.value = true;
  try {
    const { data } = await axios.patch('/api/auth/password', {
      currentPassword: currentPassword.value,
      newPassword: newPassword.value
    });
    pwdMessage.value = data.message || '비밀번호가 변경되었습니다.';
    currentPassword.value = '';
    newPassword.value = '';
    confirmPassword.value = '';
    store.logout();
    await router.replace('/login');
  } catch (e: any) {
    pwdError.value = e.response?.data?.message || '비밀번호 변경에 실패했습니다.';
  } finally {
    busyPassword.value = false;
  }
}

async function changeReauthPassword() {
  reauthMessage.value = '';
  reauthError.value = '';
  if (!loginForReauth.value || !newReauth.value || !confirmReauth.value) {
    reauthError.value = '1차 비밀번호와 새 2차 비밀번호를 입력해주세요.';
    return;
  }
  if (newReauth.value !== confirmReauth.value) {
    reauthError.value = '새 2차 비밀번호 확인이 일치하지 않습니다.';
    return;
  }
  if (loginForReauth.value === newReauth.value) {
    reauthError.value = '2차 비밀번호는 1차와 달라야 합니다.';
    return;
  }
  if (!pwRegex.test(newReauth.value)) {
    reauthError.value = '2차 비밀번호는 영문, 숫자, 특수문자를 포함해 10자 이상이어야 합니다.';
    return;
  }
  if (busyReauth.value) return;
  busyReauth.value = true;
  try {
    const { data } = await axios.patch('/api/admin/reauth-password', {
      loginPassword: loginForReauth.value,
      currentReauthPassword: currentReauth.value || undefined,
      newReauthPassword: newReauth.value
    });
    reauthMessage.value = data.message || '2차 비밀번호가 변경되었습니다.';
    loginForReauth.value = '';
    currentReauth.value = '';
    newReauth.value = '';
    confirmReauth.value = '';
    try {
      await axios.delete('/api/admin/session');
    } catch { /* ignore */ }
    await router.replace('/admin/access');
  } catch (e: any) {
    reauthError.value = e.response?.data?.message || '2차 비밀번호 변경에 실패했습니다.';
  } finally {
    busyReauth.value = false;
  }
}

async function deleteAccount() {
  withdrawError.value = '';
  if (!withdrawPassword.value) {
    withdrawError.value = '삭제를 위해 비밀번호를 입력해주세요.';
    return;
  }
  if (!confirm('관리자 계정을 삭제하시겠습니까?\n되돌릴 수 없으며, 마지막 관리자는 삭제할 수 없습니다.')) {
    return;
  }
  if (busyWithdraw.value) return;
  busyWithdraw.value = true;
  try {
    await axios.delete('/api/auth/profile', {
      data: { password: withdrawPassword.value }
    });
    store.logout();
    alert('관리자 계정이 삭제되었습니다.');
    await router.replace('/login');
  } catch (e: any) {
    withdrawError.value = e.response?.data?.message || '계정 삭제에 실패했습니다.';
    withdrawPassword.value = '';
  } finally {
    busyWithdraw.value = false;
  }
}
</script>

<template>
  <div class="account-settings">
  <section class="settings-card">
      <h2>1차 비밀번호 변경</h2>
      <p class="hint">관리자 로그인(STEP 01)에 사용합니다. 변경 후 다시 로그인해야 합니다.</p>
      <form class="settings-form" @submit.prevent="changePassword">
        <label for="cur-pw">현재 비밀번호</label>
        <input id="cur-pw" v-model="currentPassword" type="password" autocomplete="current-password" maxlength="72" required />

        <label for="new-pw">새 비밀번호</label>
        <input id="new-pw" v-model="newPassword" type="password" autocomplete="new-password" maxlength="72" required />

        <label for="confirm-pw">새 비밀번호 확인</label>
        <input id="confirm-pw" v-model="confirmPassword" type="password" autocomplete="new-password" maxlength="72" required />

        <p v-if="pwdError" class="error" role="alert">{{ pwdError }}</p>
        <p v-if="pwdMessage" class="success" role="status">{{ pwdMessage }}</p>

        <button type="submit" class="primary" :disabled="busyPassword">
          {{ busyPassword ? '변경 중…' : '1차 비밀번호 변경' }}
        </button>
      </form>
    </section>

    <section class="settings-card">
      <h2>2차 운영 비밀번호 변경</h2>
      <p class="hint">재인증(STEP 02) 전용입니다. 1차와 반드시 달라야 하며, 변경 후 재인증 화면으로 이동합니다.</p>
      <form class="settings-form" @submit.prevent="changeReauthPassword">
        <label for="login-reauth">1차 로그인 비밀번호 확인</label>
        <input id="login-reauth" v-model="loginForReauth" type="password" autocomplete="current-password" maxlength="72" required />

        <label for="cur-reauth">현재 2차 비밀번호</label>
        <input id="cur-reauth" v-model="currentReauth" type="password" autocomplete="off" maxlength="72" placeholder="처음 설정 시 비워둘 수 없음 — 현재 값 입력" />

        <label for="new-reauth">새 2차 비밀번호</label>
        <input id="new-reauth" v-model="newReauth" type="password" autocomplete="new-password" maxlength="72" required />

        <label for="confirm-reauth">새 2차 비밀번호 확인</label>
        <input id="confirm-reauth" v-model="confirmReauth" type="password" autocomplete="new-password" maxlength="72" required />

        <p v-if="reauthError" class="error" role="alert">{{ reauthError }}</p>
        <p v-if="reauthMessage" class="success" role="status">{{ reauthMessage }}</p>

        <button type="submit" class="primary" :disabled="busyReauth">
          {{ busyReauth ? '변경 중…' : '2차 비밀번호 변경' }}
        </button>
      </form>
    </section>

    <section class="settings-card danger">
      <h2>관리자 계정 삭제</h2>
      <p class="hint">이 계정을 DB에서 완전히 삭제합니다. 운영 중인 마지막 관리자는 삭제할 수 없습니다.</p>
      <form class="settings-form" @submit.prevent="deleteAccount">
        <label for="del-pw">1차 로그인 비밀번호 확인</label>
        <input id="del-pw" v-model="withdrawPassword" type="password" autocomplete="current-password" maxlength="72" required />

        <p v-if="withdrawError" class="error" role="alert">{{ withdrawError }}</p>

        <button type="submit" class="danger-btn" :disabled="busyWithdraw">
          {{ busyWithdraw ? '처리 중…' : '관리자 계정 삭제' }}
        </button>
      </form>
    </section>
  </div>
</template>

<style scoped>
.account-settings {
  display: grid;
  gap: 24px;
  max-width: 520px;
}

.settings-card {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 24px;
}

.settings-card.danger {
  border-color: #f0c4c4;
  background: #fffbfb;
}

.settings-card h2 {
  margin: 0 0 8px;
  font-size: 1.25rem;
  color: #1f2937;
}

.hint {
  margin: 0 0 20px;
  font-size: 0.95rem;
  color: #6b7280;
  line-height: 1.5;
}

.settings-form {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

label {
  font-size: 0.9rem;
  font-weight: 600;
  color: #374151;
}

input {
  padding: 10px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 1rem;
}

.error {
  margin: 4px 0 0;
  color: #b91c1c;
  font-size: 0.9rem;
}

.success {
  margin: 4px 0 0;
  color: #047857;
  font-size: 0.9rem;
}

.primary {
  margin-top: 8px;
  padding: 12px 16px;
  background: #294733;
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 1rem;
  cursor: pointer;
}

.primary:disabled {
  opacity: 0.6;
  cursor: wait;
}

.danger-btn {
  margin-top: 8px;
  padding: 12px 16px;
  background: #b91c1c;
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 1rem;
  cursor: pointer;
}

.danger-btn:disabled {
  opacity: 0.6;
  cursor: wait;
}
</style>
