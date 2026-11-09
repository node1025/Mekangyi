<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import axios from 'axios';
import { useUserStore } from '../../utils/userStore';
import { adminPaths } from '../../config/adminRoutes';

const router = useRouter();
const store = useUserStore();
const { user, userName } = store;

const activePanel = ref<'login' | 'danger'>('login');

const currentPassword = ref('');
const newPassword = ref('');
const confirmPassword = ref('');
const withdrawPassword = ref('');

const pwdMessage = ref('');
const pwdError = ref('');
const withdrawError = ref('');
const busyPassword = ref(false);
const busyWithdraw = ref(false);

const pwRegex = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[!@#$%^&*]).{10,}$/;

const accountId = computed(() => user.value?.userId ?? '—');
const displayName = computed(() => userName.value || '관리자');
const avatarInitial = computed(() => (displayName.value.trim()[0] || '관').toUpperCase());

const panels = [
  {
    id: 'login' as const,
    step: '로그인',
    title: '비밀번호',
    blurb: '관리자 로그인 화면에서 사용합니다.',
  },
  {
    id: 'danger' as const,
    step: '주의',
    title: '계정 삭제',
    blurb: '되돌릴 수 없는 작업입니다.',
  },
];

const activeMeta = computed(() => {
  const match = panels.find((p) => p.id === activePanel.value);
  return match ?? panels[0]!;
});

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
      newPassword: newPassword.value,
    });
    pwdMessage.value = data.message || '비밀번호가 변경되었습니다.';
    currentPassword.value = '';
    newPassword.value = '';
    confirmPassword.value = '';
    store.logout();
    await router.replace(adminPaths.login);
  } catch (e: any) {
    pwdError.value = e.response?.data?.message || '비밀번호 변경에 실패했습니다.';
  } finally {
    busyPassword.value = false;
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
      data: { password: withdrawPassword.value },
    });
    store.logout();
    alert('관리자 계정이 삭제되었습니다.');
    await router.replace(adminPaths.login);
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
    <header class="account-hero">
      <div class="account-hero__identity">
        <span class="account-avatar" aria-hidden="true">{{ avatarInitial }}</span>
        <div>
          <p class="account-eyebrow">로그인 중인 운영자</p>
          <h2 class="account-name">{{ displayName }}</h2>
          <p class="account-meta">
            <span class="account-id">아이디 {{ accountId }}</span>
            <span class="account-role">관리자</span>
          </p>
        </div>
      </div>
      <ul class="account-flow" aria-label="인증 안내">
        <li>
          <span class="flow-step">01</span>
          <div>
            <strong>관리자 로그인</strong>
            <p>아이디·비밀번호로 콘솔에 접속합니다.</p>
          </div>
        </li>
      </ul>
    </header>

    <nav class="account-tabs" role="tablist" aria-label="계정 설정 항목">
      <button
        v-for="tab in panels"
        :key="tab.id"
        type="button"
        role="tab"
        class="account-tab"
        :class="{ active: activePanel === tab.id, danger: tab.id === 'danger' }"
        :aria-selected="activePanel === tab.id"
        @click="activePanel = tab.id"
      >
        <span class="tab-step">{{ tab.step }}</span>
        <span class="tab-title">{{ tab.title }}</span>
      </button>
    </nav>

    <section class="account-panel" role="tabpanel" :aria-labelledby="`panel-${activePanel}`">
      <header class="panel-head">
        <span class="panel-step">{{ activeMeta.step }}</span>
        <h3>{{ activeMeta.title }}</h3>
        <p>{{ activeMeta.blurb }}</p>
      </header>

      <aside class="policy-note" v-if="activePanel !== 'danger'">
        <strong>비밀번호 규칙</strong>
        <ul>
          <li>10자 이상</li>
          <li>영문 · 숫자 · 특수문자(!@#$%^&amp;*) 각 1종 이상</li>
        </ul>
      </aside>

      <form
        v-if="activePanel === 'login'"
        id="panel-login"
        class="settings-form"
        @submit.prevent="changePassword"
      >
        <div class="field">
          <label for="cur-pw">현재 비밀번호</label>
          <input
            id="cur-pw"
            v-model="currentPassword"
            class="form-input"
            type="password"
            autocomplete="current-password"
            maxlength="72"
            required
          />
        </div>
        <div class="field-row">
          <div class="field">
            <label for="new-pw">새 비밀번호</label>
            <input
              id="new-pw"
              v-model="newPassword"
              class="form-input"
              type="password"
              autocomplete="new-password"
              maxlength="72"
              required
            />
          </div>
          <div class="field">
            <label for="confirm-pw">새 비밀번호 확인</label>
            <input
              id="confirm-pw"
              v-model="confirmPassword"
              class="form-input"
              type="password"
              autocomplete="new-password"
              maxlength="72"
              required
            />
          </div>
        </div>
        <p class="field-hint">변경 후 보안을 위해 자동으로 로그아웃됩니다.</p>

        <div v-if="pwdError" class="banner error" role="alert">{{ pwdError }}</div>
        <div v-if="pwdMessage" class="banner success" role="status">{{ pwdMessage }}</div>

        <div class="form-actions">
          <button type="submit" class="btn primary" :disabled="busyPassword">
            {{ busyPassword ? '변경 중…' : '로그인 비밀번호 저장' }}
          </button>
        </div>
      </form>

      <form v-else id="panel-danger" class="settings-form danger-form" @submit.prevent="deleteAccount">
        <div class="danger-callout">
          <p>
            이 계정을 데이터베이스에서 <strong>완전히 삭제</strong>합니다. 운영 중인
            <strong>마지막 관리자</strong>는 삭제할 수 없습니다.
          </p>
        </div>

        <div class="field">
          <label for="del-pw">1차 로그인 비밀번호 확인</label>
          <input
            id="del-pw"
            v-model="withdrawPassword"
            class="form-input"
            type="password"
            autocomplete="current-password"
            maxlength="72"
            required
          />
        </div>

        <div v-if="withdrawError" class="banner error" role="alert">{{ withdrawError }}</div>

        <div class="form-actions">
          <button type="submit" class="btn danger" :disabled="busyWithdraw">
            {{ busyWithdraw ? '처리 중…' : '관리자 계정 영구 삭제' }}
          </button>
        </div>
      </form>
    </section>
  </div>
</template>

<style scoped>
.account-settings {
  font-family: var(--font-body);
  display: flex;
  flex-direction: column;
  gap: 20px;
  max-width: 920px;
}

.account-hero {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: stretch;
  gap: 20px;
  padding: 22px 24px;
  border-radius: 12px;
  background: linear-gradient(135deg, #edf0e8 0%, #f7f9f4 55%, #e8f0fe 100%);
  border: 1px solid #dce5d8;
}

.account-hero__identity {
  display: flex;
  align-items: center;
  gap: 16px;
  min-width: 220px;
}

.account-avatar {
  flex-shrink: 0;
  width: 56px;
  height: 56px;
  border-radius: 14px;
  background: #294733;
  color: #fff;
  display: grid;
  place-items: center;
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.02em;
  box-shadow: 0 6px 16px rgba(41, 71, 51, 0.25);
}

.account-eyebrow {
  margin: 0 0 4px;
  font-size: 12px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #6b7a66;
}

.account-name {
  margin: 0;
  font-family: var(--font-cute);
  font-size: 26px;
  font-weight: 400;
  color: #1f2d24;
  line-height: 1.2;
}

.account-meta {
  margin: 8px 0 0;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  font-size: 15px;
  color: #4b5a47;
}

.account-id {
  font-weight: 600;
}

.account-role {
  padding: 3px 10px;
  border-radius: 999px;
  background: #294733;
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.04em;
}

.account-flow {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  justify-content: flex-end;
  min-width: 260px;
}

.account-flow li {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid #e2e8de;
  border-radius: 10px;
  min-width: 140px;
}

.account-flow li.flow-connector {
  min-width: 0;
  width: 28px;
  height: 2px;
  padding: 0;
  border: 0;
  background: #b8c4b0;
  border-radius: 1px;
}

.flow-step {
  font-size: 13px;
  font-weight: 700;
  color: #294733;
  background: #dfe8d9;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  display: grid;
  place-items: center;
}

.account-flow strong {
  display: block;
  font-size: 15px;
  color: #253c2e;
}

.account-flow p {
  margin: 2px 0 0;
  font-size: 13px;
  color: #6d7a68;
}

.account-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 4px;
  background: #f3f5f8;
  border-radius: 12px;
  border: 1px solid #e5e7eb;
}

.account-tab {
  flex: 1 1 160px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  padding: 14px 16px;
  border: 1px solid transparent;
  border-radius: 10px;
  background: transparent;
  cursor: pointer;
  text-align: left;
  transition: background 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
  color: #4b5563;
}

.account-tab:hover {
  background: #fff;
}

.account-tab.active {
  background: #fff;
  border-color: #cdd8c8;
  box-shadow: 0 2px 8px rgba(41, 71, 51, 0.08);
  color: #1f2937;
}

.account-tab.danger.active {
  border-color: #f5c6c6;
  box-shadow: 0 2px 8px rgba(185, 28, 28, 0.1);
}

.tab-step {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: #6b7280;
}

.account-tab.active .tab-step {
  color: #294733;
}

.account-tab.danger .tab-step,
.account-tab.danger .tab-title {
  color: #b91c1c;
}

.tab-title {
  font-size: 16px;
  font-weight: 700;
}

.account-panel {
  padding: 28px 28px 32px;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  background: #fff;
}

.panel-head {
  margin-bottom: 20px;
  padding-bottom: 18px;
  border-bottom: 1px solid #eef0f3;
}

.panel-step {
  display: inline-block;
  margin-bottom: 8px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.1em;
  color: #6b7a66;
}

.panel-head h3 {
  margin: 0 0 6px;
  font-family: var(--font-cute);
  font-size: 22px;
  font-weight: 400;
  color: #111827;
}

.panel-head p {
  margin: 0;
  font-size: 15px;
  color: #6b7280;
  line-height: 1.5;
}

.policy-note {
  margin-bottom: 22px;
  padding: 14px 16px;
  border-radius: 10px;
  background: #f9fafb;
  border: 1px dashed #d1d5db;
  font-size: 14px;
  color: #4b5563;
}

.policy-note strong {
  display: block;
  margin-bottom: 8px;
  color: #374151;
}

.policy-note ul {
  margin: 0;
  padding-left: 18px;
  line-height: 1.6;
}

.settings-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.field-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.field label {
  font-size: 14px;
  font-weight: 600;
  color: #374151;
}

.form-input {
  padding: 10px 12px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 16px;
  width: 100%;
  box-sizing: border-box;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.form-input:focus {
  outline: none;
  border-color: #6a8fe7;
  box-shadow: 0 0 0 3px rgba(106, 143, 231, 0.2);
}

.field-hint {
  margin: 0;
  font-size: 13px;
  color: #9ca3af;
  line-height: 1.45;
}

.banner {
  padding: 12px 14px;
  border-radius: 8px;
  font-size: 14px;
  line-height: 1.45;
}

.banner.error {
  background: #fef2f2;
  border: 1px solid #fecaca;
  color: #b91c1c;
}

.banner.success {
  background: #ecfdf5;
  border: 1px solid #a7f3d0;
  color: #047857;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  padding-top: 8px;
}

.btn {
  padding: 12px 20px;
  border-radius: 8px;
  border: none;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s ease, transform 0.1s ease;
}

.btn:disabled {
  opacity: 0.55;
  cursor: wait;
}

.btn.primary {
  background: #294733;
  color: #fff;
}

.btn.primary:not(:disabled):hover {
  background: #1f3528;
}

.btn.danger {
  background: #b91c1c;
  color: #fff;
}

.btn.danger:not(:disabled):hover {
  background: #991b1b;
}

.danger-form .danger-callout {
  display: block;
  margin: 0;
  padding: 16px 18px;
  border-radius: 10px;
  background: #fff5f5;
  border: 1px solid #fecaca;
  font-size: 15px;
  color: #7f1d1d;
  line-height: 1.55;
}

.danger-callout p {
  margin: 0;
}

@media (max-width: 720px) {
  .account-hero {
    flex-direction: column;
  }

  .account-flow {
    justify-content: flex-start;
    flex-wrap: wrap;
  }

  .account-flow li.flow-connector {
    display: none;
  }

  .field-row {
    grid-template-columns: 1fr;
  }

  .account-panel {
    padding: 20px 18px 24px;
  }

  .form-actions .btn {
    width: 100%;
  }
}
</style>
