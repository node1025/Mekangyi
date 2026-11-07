<script setup lang="ts">
import {useRouter} from 'vue-router';import {useUserStore} from './utils/userStore';
const store=useUserStore(),router=useRouter();
function logout(){store.logout();void router.replace('/login')}
</script>
<template><header class="ops-header"><RouterLink to="/admin"><img src="/brand/bukangi_character_1.png" alt="" />부캉이</RouterLink><span>임직원 전용 관리 시스템</span><button v-if="store.isLoggedIn.value" @click="logout">로그아웃</button></header><RouterView /></template>
