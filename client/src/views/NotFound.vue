<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, RouterLink } from 'vue-router';

const route = useRoute();
const triedPath = computed(() => route.fullPath);
</script>

<template>
  <section class="not-found" aria-labelledby="not-found-title">
    <p class="not-found-kicker">404 — PAGE NOT FOUND</p>
    <h1 id="not-found-title">찾을 수 없는 페이지예요</h1>
    <p class="not-found-lead">
      요청하신 주소(<code>{{ triedPath }}</code>)는 메뉴에 없거나 삭제되었을 수 있어요.
    </p>
    <div class="not-found-actions">
      <RouterLink to="/">홈으로 돌아가기</RouterLink>
      <RouterLink to="/category/best">굿즈 둘러보기 ↗</RouterLink>
    </div>
  </section>
</template>

<style scoped>
.not-found {
  max-width: 720px;
  margin: 0 auto;
  padding: 72px 5vw 96px;
  text-align: center;
  color: #254e86;
}
.not-found-kicker {
  font-size: 13px;
  letter-spacing: 1.6px;
  color: #52627a;
  margin-bottom: 18px;
}
.not-found h1 {
  font-size: 34px;
  font-weight: 600;
  letter-spacing: -1px;
  margin: 0 0 16px;
}
.not-found-lead {
  font-size: 16px;
  line-height: 1.8;
  color: #52627a;
  margin-bottom: 32px;
}
.not-found-lead code {
  font-size: 14px;
  background: #f4f8ff;
  padding: 2px 8px;
  border-radius: 6px;
  word-break: break-all;
}
.not-found-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  justify-content: center;
}
.not-found-actions a {
  display: inline-block;
  padding: 14px 24px;
  border-radius: 30px;
  font-size: 16px;
  text-decoration: none;
}
.not-found-actions a:first-child {
  background: #5890df;
  color: #fff;
}
.not-found-actions a:last-child {
  background: #edf4ff;
  color: #5486c8;
}
@media (max-width: 700px) {
  .not-found {
    padding: 48px 22px 72px;
  }
  .not-found h1 {
    font-size: 26px;
  }
}
</style>
