<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import axios from 'axios';
const router = useRouter();
const state = ref<'checking'|'guest'|'forbidden'|'ready'|'error'>('checking');
const userId = ref('');
const password = ref('');
const message = ref('');
const busy = ref(false);
const cooldown = ref(0);
let timer: ReturnType<typeof setInterval> | undefined;
async function inspect() {
  state.value = 'checking'; message.value = '';
  if (!localStorage.getItem('accessToken')) { state.value = 'guest'; return; }
  try {
    const { data } = await axios.get('/api/auth/profile');
    const profile = data.user || data;
    if (profile.role !== 'admin') { state.value = 'forbidden'; return; }
    userId.value = profile.userId; state.value = 'ready';
  } catch (error: any) { state.value = [401,403].includes(error.response?.status) ? 'guest' : 'error'; }
}
async function authenticate() {
  if (busy.value || cooldown.value) return;
  busy.value = true; message.value = '';
  try {
    await axios.post('/api/admin/session', { userId: userId.value, reauthPassword: password.value });
    password.value = ''; await router.replace('/admin');
  } catch (error: any) {
    message.value = error.response?.data?.message || '인증 서버에 연결하지 못했습니다.';
    password.value = '';
    if (error.response?.status === 429) {
      const until = Date.now() + Number(error.response.headers['retry-after'] || 60) * 1000;
      clearInterval(timer);
      const tick = () => { cooldown.value = Math.max(0, Math.ceil((until - Date.now()) / 1000)); if (!cooldown.value) clearInterval(timer); };
      tick(); timer = setInterval(tick, 1000);
    }
  } finally { busy.value = false; }
}
onMounted(inspect);
onUnmounted(() => clearInterval(timer));
</script>
<template>
  <div class="admin-access"><aside class="access-story"><span class="access-eyebrow">부캉이 / OPERATIONS</span><h1>조금 더 안전한<br /><em>운영의 시작.</em></h1><p>관리자 전용 공간입니다.<br />계정을 확인한 뒤 한 번 더 인증해주세요.</p><ol><li><span>01</span><div><strong>관리자 계정 로그인</strong><p>관리자 계정으로 로그인합니다.</p></div></li><li><span>02</span><div><strong>2차 운영 비밀번호</strong><p>1차와 다른 재인증 비밀번호로 입장합니다.</p></div></li></ol><RouterLink to="/login">← 관리자 로그인</RouterLink></aside>
    <section class="access-panel" aria-labelledby="admin-title"><span class="access-eyebrow">AUTHORIZED PERSONNEL ONLY</span><h2 id="admin-title">관리자 전용 로그인</h2><p class="panel-description">상품과 고객 정보를 안전하게 관리하는 공간</p>
      <p v-if="state === 'checking'" role="status">접근 권한을 확인하고 있습니다.</p>
      <div v-else-if="state === 'guest'" class="access-state"><span class="step-label">STEP 01</span><h3>먼저 로그인해주세요.</h3><p>관리자 권한이 있는 회원 계정이 필요합니다.</p><RouterLink class="access-primary" to="/login?redirect=/admin/access">관리자 계정 로그인으로 이동 ↗</RouterLink></div>
      <div v-else-if="state === 'forbidden'" class="access-state" role="alert"><h3>관리자 권한이 없습니다.</h3><p>이 계정으로는 관리자 공간에 접근할 수 없습니다.</p><RouterLink to="/" class="access-primary">로그인 화면으로 이동</RouterLink></div>
      <div v-else-if="state === 'error'" class="access-state" role="alert"><p>접근 권한을 확인하지 못했습니다.</p><button @click="inspect" class="access-primary">다시 확인</button></div>
      <form v-else @submit.prevent="authenticate"><span class="step-label">STEP 02 · 2차 재인증</span><label for="admin-account">관리자 아이디</label><input id="admin-account" :value="userId" readonly autocomplete="username" /><label for="admin-password">2차 운영 비밀번호</label><input id="admin-password" v-model="password" type="password" autocomplete="off" required maxlength="72" placeholder="1차 로그인과 다른 2차 비밀번호" /><p v-if="message" class="access-error" role="alert">{{ message }}</p><button class="access-primary" :disabled="busy || cooldown > 0">{{ busy ? '인증 확인 중…' : cooldown ? `${cooldown}초 후 다시 시도` : '인증하고 관리자 페이지 입장 ↗' }}</button><p class="session-note">인증 후 15분 동안 관리 기능을 사용할 수 있습니다.<br />공용 기기에서는 사용 후 관리자 세션을 잠가주세요.</p></form>
    </section>
  </div>
</template>
<style scoped>
.admin-access{max-width:1180px;margin:64px auto 90px;display:grid;grid-template-columns:1fr 1fr;min-height:600px;padding:0 24px;color:#253c2e}.access-story{background:#e8f0fe;padding:54px 42px;display:flex;flex-direction:column}.access-eyebrow{font-size:13px;letter-spacing:2px;color:#6c7867}.access-story h1{font-size:36px;font-weight:400;line-height:1.6;letter-spacing:-1.5px;margin:32px 0 18px}.access-story h1 em{font-family:var(--font-cute)}.access-story>p{color:#72806d;font-size:17px;line-height:1.9}.access-story ol{list-style:none;padding:20px 0 30px}.access-story li{display:flex;gap:20px;border-top:1px solid #ccd4c7;padding:20px 0 4px}.access-story li>span{font:italic 23px Georgia,serif;color:#75866d}.access-story li strong{font-size:16px;font-weight:500}.access-story li p{font-size:15px;color:#7a8475}.access-story>a{font-size:15px;margin-top:auto;text-decoration:none}.access-panel{border:1px solid #e3e6dc;padding:60px 45px;background:#fff}.access-panel h2{font-size:25px;font-weight:500;letter-spacing:-1px;margin:24px 0 12px}.panel-description{font-size:16px;color:#858a80;margin-bottom:42px}.step-label{display:block;color:#65805c;font-size:14px;letter-spacing:1px;margin-bottom:26px}.access-panel label{display:block;font-size:15px;margin:22px 0 9px}.access-panel input{width:100%;border:1px solid #d8dfd3;padding:14px;background:#fff;border-radius:0;font-size:17px}.access-panel input[readonly]{background:#f4f6ef;color:#6c7566}.access-primary{display:block;text-align:center;width:100%;margin-top:28px;border:0;padding:17px;background:#2d65bc;color:white;text-decoration:none;font-size:16px}.access-state h3{font-weight:500;font-size:19px}.access-state p,.session-note{font-size:15px;line-height:1.9;color:#818978}.session-note{margin-top:22px}.access-error{color:#a34136;font-size:16px;line-height:1.8}@media(max-width:700px){.admin-access{grid-template-columns:1fr;margin:24px auto 50px;padding:0 18px}.access-story{padding:30px}.access-story h1{font-size:28px;margin-top:20px}.access-story ol{display:none}.access-story>a{margin-top:20px}.access-panel{padding:35px 28px}}
</style>
