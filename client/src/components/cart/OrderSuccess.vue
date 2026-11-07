<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();
const orderInfo = ref(null);

onMounted(() => {
  const state = window.history.state;
  if (state && state.order) {
    orderInfo.ref = state.order;
  } else {
    
  }
});

const formatPrice = (price) => price?.toLocaleString();

const goToHome = () => router.push('/');
const goToOrders = () => router.push('/profile');
</script>

<template>
  <div class="order-success-container">
    <div class="success-card">
      <div class="icon-wrapper">
        <i class="fas fa-check-circle"></i>
      </div>
      <h1>결제가 완료되었습니다!</h1>
      <p class="subtitle">고객님의 소중한 주문이 정상적으로 접수되었습니다.</p>

      <hr />

      <div class="order-details" v-if="orderInfo">
        <div class="detail-item">
          <span class="label">주문 번호</span>
          <span class="value">{{ orderInfo.orderId }}</span>
        </div>
        <div class="detail-item">
          <span class="label">결제 금액</span>
          <span class="value price">{{ formatPrice(orderInfo.totalPrice) }}원</span>
        </div>
        <div class="detail-item">
          <span class="label">배송지</span>
          <span class="value">{{ orderInfo.shippingAddress }}</span>
        </div>
      </div>

      <div class="button-group">
        <button @click="goToHome" class="btn-secondary">쇼핑 계속하기</button>
        <button @click="goToOrders" class="btn-primary">주문 내역 보기</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.order-success-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 70vh;
  padding: 20px;
}

.success-card {
  background: white;
  padding: 40px;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.1);
  max-width: 500px;
  width: 100%;
  text-align: center;
}

.icon-wrapper {
  font-size: 64px;
  color: #4caf50;
  margin-bottom: 20px;
}

h1 { font-size: 24px; margin-bottom: 10px; color: #333; }
.subtitle { color: #666; margin-bottom: 30px; }

hr { border: 0; border-top: 1px solid #eee; margin: 20px 0; }

.order-details {
  text-align: left;
  background: #f9f9f9;
  padding: 20px;
  border-radius: 8px;
  margin-bottom: 30px;
}

.detail-item {
  display: flex;
  justify-content: space-between;
  margin-bottom: 10px;
}

.label { color: #888; }
.value { font-weight: 500; color: #333; }
.price { color: #e91e63; font-weight: bold; }

.button-group {
  display: flex;
  gap: 10px;
}

button {
  flex: 1;
  padding: 12px;
  border-radius: 6px;
  cursor: pointer;
  border: none;
  font-weight: bold;
}

.btn-primary { background: #6a8fe7; color: white; }
.btn-secondary { background: #eee; color: #333; }
</style>