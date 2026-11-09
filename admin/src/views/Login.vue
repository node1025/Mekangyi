<script setup lang="ts">
import { ref } from 'vue';
import axios from 'axios';
import { useRouter } from 'vue-router';
import { useUserStore } from '../utils/userStore';
import { adminPaths } from '../config/adminRoutes';

const router = useRouter();
const store = useUserStore();
const userId = ref('');
const password = ref('');
const message = ref('');
const busy = ref(false);

async function login() {
  if (busy.value) return;
  busy.value = true;
  message.value = '';
  try {
    const { data } = await axios.post('/api/auth/login', {
      userId: userId.value,
      password: password.value,
    });
    if (data.user.role !== 'admin') {
      message.value = '관리자 권한이 있는 계정만 로그인할 수 있습니다.';
      return;
    }
    store.login(data.user, data.accessToken);
    password.value = '';
    await router.replace(adminPaths.gate);
  } catch (e: any) {
    message.value = e.response?.data?.message || '로그인 서버에 연결하지 못했습니다.';
    password.value = '';
  } finally {
    busy.value = false;
  }
}
</script>
<template><main class="login-layout"><aside><small>BUKANGI / OPERATIONS</small><h1>부캉이의 하루를<br>함께 운영하는 공간.</h1><p>상품과 주문, 고객의 이야기를 관리합니다.</p><ol><li>01 · 관리자 계정 로그인</li><li>02 · 비밀번호 재인증</li></ol><p>허용된 네트워크에서만 접근할 수 있습니다.</p></aside><section><small>STEP 01</small><h2>관리자 로그인</h2><p>고객 쇼핑몰과 분리된 임직원 전용 사이트입니다.</p><form @submit.prevent="login"><label for="ops-id">관리자 아이디</label><input id="ops-id" v-model="userId" autocomplete="username" required maxlength="16"><label for="ops-password">비밀번호</label><input id="ops-password" v-model="password" type="password" autocomplete="current-password" required maxlength="72"><p v-if="message" role="alert">{{message}}</p><button :disabled="busy">{{busy?'확인 중…':'로그인하고 재인증으로 이동 →'}}</button></form></section></main></template>
<style scoped>.login-layout{max-width:1080px;margin:70px auto;display:grid;grid-template-columns:1fr 1fr;padding:0 24px}.login-layout aside{background:#e8f0fe;padding:55px 42px}.login-layout small{font-size:14px;letter-spacing:2px;color:#6781a5}.login-layout h1{font-size:32px;line-height:1.6;margin:35px 0 20px}.login-layout p{font-size:17px;color:#52627a;line-height:1.8}.login-layout ol{list-style:none;padding:25px 0}.login-layout li{padding:16px 0;border-top:1px solid #cbd9ef;font-size:17px}.login-layout section{background:white;border:1px solid #e0e7f3;padding:60px 42px}.login-layout h2{font-size:26px;margin-top:24px}.login-layout label{display:block;font-size:16px;margin:25px 0 9px}.login-layout input{width:100%;padding:14px;border:1px solid #cfd9e8;border-radius:7px}.login-layout button{margin-top:28px;width:100%;padding:16px;border:0;background:#2d65bc;color:white;border-radius:7px;font-size:17px}.login-layout [role=alert]{color:#ad3939}@media(max-width:700px){.login-layout{grid-template-columns:1fr;margin:25px auto}.login-layout aside{padding:28px}.login-layout h1{font-size:25px}.login-layout ol{display:none}.login-layout section{padding:30px}}</style>
