<script setup lang="ts">
import { ref, onMounted } from 'vue';
import axios from 'axios';
import ReviewForm from './ReviewForm.vue';

// 타입 정의
interface OrderItem {
  _id: string;
  productId: { 
    _id: string; 
    name: { 
      ko: string; 
      en?: string;
    } 
  };
  variantId: {
    _id: string;
    color: string;
  };
  size: string;
  quantity: number;
  price: number;
  isReviewed?: boolean;
}

interface Order {
  _id: string;
  orderId: string;
  items: OrderItem[];
  totalPrice: number;
  status: string;
  createdAt: string;
}

const orders = ref<Order[]>([]);  // 주문 내역 저장 상태
const loading = ref(true);        // 로딩 상태

const isModalOpen = ref(false);           // 리뷰 모달 열림 여부
const selectedOrder = ref<string>('');    // 현재 리뷰 모달에서 선택된 주문 ID
const selectedProduct = ref<string>('');  // 현재 리뷰 모달에서 선택된 상품 ID

// 주문 내역 가져오기
const fetchOrders = async () => {
  try {
    const token = localStorage.getItem('accessToken');
    const response = await axios.get(`${(import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '')}/api/orders/my`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    if (response.data.success) {
      orders.value = response.data.orders;  // 서버로부터 주문 목록 저장
    }
  } catch (error) {
    console.error('주문 로드 에러:', error);
    alert('주문 내역을 불러오지 못했습니다.');
  } finally {
    loading.value = false;
  }
};

// 날짜 포맷 함수
const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric'
  });
};

// 주문 상태 텍스트 변환
const getStatusText = (status: string) => {
  const statusMap: Record<string, string> = {
    pending: '결제대기',
    paid: '결제완료',
    shipping: '배송중',
    delivered: '배송완료',
    cancelled: '취소완료'
  };
  return statusMap[status] || '처리중';
};

// 리뷰 모달 열기
const openReviewModal = (orderId: string, productId: string) => {
  selectedOrder.value = orderId;
  selectedProduct.value = productId;
  isModalOpen.value = true;
};

// 리뷰 제출 성공 시 로직
const handleReviewSubmitted = (productId: string, orderId: string) => {
  fetchOrders();  // 서버 데이터를 즉시 다시 불러옴

  // UI 즉시 업데이트
  orders.value = orders.value.map(order => {
    // 문자열로 ID 통일 후 비교
    if (String(order._id) === String(orderId)) { 
      const updatedItems = order.items.map(item => {
        if (String(item.productId._id) === String(productId)) {
          return { ...item, isReviewed: true }; // 리뷰 작성 표시
        }
        return item;
      });
      return { ...order, items: updatedItems };
    }
    return order;
  });
};

// 컴포넌트 마운트 시 주문 내역 불러오기
onMounted(fetchOrders);
</script>

<template>
  <div class="order-container">
    <div v-if="loading" class="loading">데이터를 불러오는 중...</div>
    <div v-else-if="orders.length === 0" class="empty-state">주문 내역이 없습니다.</div>

    <div v-else class="order-list">
      <div v-for="order in orders" :key="order._id" class="order-card">
        <div class="order-header">
          <span class="date">{{ formatDate(order.createdAt) }}</span>
          <span class="order-id">주문번호 : {{ order.orderId }}</span>
        </div>

        <div v-for="item in order.items" :key="item._id" class="product-item">
          <div class="product-info">
            <p class="product-name-ko">{{ item.productId?.name.ko || '정보가 없는 상품' }}</p>
            <p class="product-name-en" v-if="item.productId?.name.en">{{ item.productId.name.en }}</p>
            <p class="product-option">
              색상 : {{ item.variantId?.color || '정보 없음' }} · 
              사이즈 : {{ item.size }} · 
              {{ item.quantity }}개
            </p>
            <p class="product-price">{{ item.price.toLocaleString() }}원</p>
          </div>
          
          <div class="order-status-group">
            <span :class="['status-badge', order.status]">{{ getStatusText(order.status) }}</span>
            <button 
              v-if="order.status === 'delivered' && !item.isReviewed" 
              class="review-btn mini"
              @click="openReviewModal(order._id, item.productId._id)" 
            >
              리뷰 작성
            </button>

            <span v-else-if="item.isReviewed" class="review-done-text">리뷰 완료</span>
          </div>
        </div>
        
        <div class="order-footer">
          <div class="footer-right">
            <span class="total-label">총 결제금액 </span>
            <span class="total-price">{{ order.totalPrice.toLocaleString() }}원</span>
          </div>
        </div>
      </div>
    </div>

<ReviewForm 
  v-if="isModalOpen"
  :order-id="selectedOrder"
  :product-id="selectedProduct"
  @close="isModalOpen = false"
  @submitted="handleReviewSubmitted" 
/>
  </div>
</template>

<style scoped>
/* 전체 주문 페이지 컨테이너 */
.order-container {
  max-width: 900px;
  margin: 0 auto;
  padding: 50px 20px;
  background-color: #fafafa;
  min-height: 100vh;
}

/* 주문 카드 전체 */
.order-card {
  border: 1px solid rgba(0, 0, 0, 0.05);
  border-radius: 20px;
  margin-bottom: 30px;
  overflow: hidden;
  background: #ffffff;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.03);
}

.order-header {
  background: #fdfdfd;
  padding: 18px 25px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #f1f1f1;
}

/* 주문 날짜 */
.date {
  font-size:19px;
  font-weight: 700;
  color: #222;
}

/* 주문 번호 */
.order-id {
  font-size:17px;
  color: #999;
}

/* 상품 정보 영역 */
.product-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 25px;
  border-bottom: 1px solid #f9f9f9;
}

/* 상품명 (한국어) */
.product-name-ko {
  font-weight: 700;
  font-size: 17px;
  color: #1a1a1a;
  margin: 0;
}

/* 상품명 (영어) */
.product-name-en {
  font-size:18px;
  color: #888;
  margin: 0 0 4px 0;
}

/* 옵션 정보 */
.product-option {
  font-size:17px;
  color: #666;
  background: #f1f1f1;
  padding: 2px 8px;
  border-radius: 4px;
  width: fit-content;
}

/* 상품 가격 */
.product-price {
  font-weight: 700;
  font-size:19px;
  color: #333;
  margin-top: 8px;
}

/* 주문 상태 그룹 */
.order-status-group {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 10px;
}

/* 주문 상태 배지 */
.status-badge {
  font-size:16px;
  font-weight: 700;
  padding: 6px 14px;
  border-radius: 30px;
  text-transform: uppercase;
}

/* 상태별 색상 */
.status-badge.paid { background: #e7f3ff; color: #007aff; }
.status-badge.shipping { background: #fff4e5; color: #ff9500; }
.status-badge.delivered { background: #e8f5e9; color: #34c759; }
.status-badge.cancelled { background: #ffebee; color: #ff3b30; }

/* 리뷰 작성 버튼 */
.review-btn.mini {
  background-color: #074CA1;
  color: #fff;
  border: 1px solid #074CA1;
  padding: 6px 14px;
  border-radius: 8px;
  font-size:17px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.review-btn.mini:hover {
  background-color: #063d82;
  color: #fff;
}

/* 주문 카드 하단 영역 */
.order-footer {
  padding: 20px 25px;
  background: #fdfdfd;
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 12px;
}

/* 총액 레이블 */
.total-label {
  font-size:18px;
  color: #666;
  font-weight: 600;
  margin-bottom: 2px;
}

.total-price {
  font-size: 20px;
  font-weight: 900;
  color: #000;
}

/* 로딩/주문 없을 때 상태 */
.loading,
.empty-state {
  text-align: center;
  padding: 100px 0;
  color: #bbb;
  font-size:19px;
}

/* 리뷰 작성 완료 텍스트 */
.review-done-text {
  font-size:16px;
  color: #bbb;
  font-weight: 500;
  padding: 6px 0;
}
</style>
