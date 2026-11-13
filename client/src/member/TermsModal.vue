<script setup lang="ts">
import { TERMS_DATA } from './terms';   // 약관 데이터 상수를 가져옴

const props = defineProps<{             // 부모 컴포넌트에서 전달받는 props 타입 정의
  isOpen: boolean;
  termKey: string;
}>();

const emit = defineEmits(['close']);    // 부모 컴포넌트로 전달할 이벤트(닫기) 정의
</script>

<template>
  <Teleport to="body">
    <div v-if="isOpen" class="modal-overlay" @click.self="emit('close')">
      <div class="modal-content">
        <header class="modal-header">
          <h2 class="modal-title">{{ TERMS_DATA[termKey]?.title }}</h2>
          <button class="header-close-btn" @click="emit('close')">&times;</button>
        </header>

        <div class="modal-body" v-html="TERMS_DATA[termKey]?.body"></div>

        <footer class="modal-footer">
          <button class="confirm-btn" @click="emit('close')">확인</button>
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
/* 배경 영역 스타일 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 10000;
}

/* 모달 영역 스타일 */
.modal-content {
  background: #fff;
  width: 90%;
  max-width: 800px;
  max-height: 85vh;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
  display: flex;
  flex-direction: column;
  position: relative;
  animation: modalFadeIn 0.3s ease-out;
}

/* 모달 등장 애니메이션 */
@keyframes modalFadeIn {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

/* 헤더 스타일 */
.modal-header {
  padding: 25px 30px;
  border-bottom: 1px solid #f0f0f0;
  display: flex;
  justify-content: center;
  align-items: center;
  position: relative;
}

/* 제목 */
.modal-title {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  color: #333;
}

/* 닫기 버튼 */
.header-close-btn {
  position: absolute;
  right: 20px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  font-size: 28px;
  color: #bbb;
  cursor: pointer;
  line-height: 1;
  transition: color 0.2s;
}

.header-close-btn:hover {
  color: #333;
}

/* 본문 */
.modal-body {
  padding: 30px;
  overflow-y: auto;
  font-size:18px;
  line-height: 1.8;
  color: #555;
  white-space: pre-line; /* 약관 줄바꿈 처리 */
}

.modal-body::-webkit-scrollbar {
  width: 6px;
}
.modal-body::-webkit-scrollbar-thumb {
  background-color: #e0e0e0;
  border-radius: 10px;
}
.modal-body::-webkit-scrollbar-track {
  background-color: #f9f9f9;
}

/* 하단 버튼 영역 */
.modal-footer {
  padding: 20px 30px 30px;
  text-align: center;
  border-top: 1px solid #f5f5f5;
}

/* 확인 버튼 */
.confirm-btn {
  width: 160px;
  height: 50px;
  background: #074CA1;
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size:19px;
  font-weight: 600;
  cursor: pointer;
}

.confirm-btn:hover {
  background: #063d82;
}

/* 약관 테이블 */
:deep(.terms-table) {
  width: 100%;
  border-collapse: collapse;
  margin: 20px 0;
  font-size:17px;
  border-top: 2px solid #333;
}

:deep(.terms-table th), :deep(.terms-table td) {
  border: 1px solid #eee;
  padding: 12px;
  text-align: left;
}

:deep(.terms-table th) {
  background: #f8f9fa;
  font-weight: 600;
  color: #333;
  text-align: center;
}

/* 강조 텍스트 */
:deep(strong) {
  color: #222;
  font-weight: 700;
}

:deep(.table-title) {
  display: block;
  font-size:18px;
  font-weight: 700;
  margin-top: 25px;
  margin-bottom: 10px;
  color: #000;
}

</style>