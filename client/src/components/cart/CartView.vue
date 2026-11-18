<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import axios from 'axios';
import { useRouter } from 'vue-router';

interface CartItem {
  _id: string;
  productId: any;
  variantId: any;
  size: string;
  quantity: number;
  price: number;
}

const cartItems = ref<CartItem[]>([]);
const loading = ref(true);
const selectedIds = ref<string[]>([]); // 선택된 항목의 ID들

const router = useRouter();

// 서버 기본 URL 설정
const SERVER_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');
 
// 이미지 경로를 URL로 변환하는 헬퍼 함수
const getImageUrl = (path: string | null) => {
  if (!path) return '/default-image.png'; // 이미지가 없을 때 기본 이미지
  
  // Windows 경로(\) → URL 경로(/)로 변환
  const normalizedPath = path.replace(/\\/g, '/');
  
  // 이미 전체 URL 형태라면 그대로 반환, 아니라면 서버 URL과 결합
  return normalizedPath.startsWith('http') 
    ? normalizedPath 
    : `${SERVER_URL}/${normalizedPath}`;
};

// 삭제나 수량 변경 후 헤더의 배지를 업데이트하기 위해 이벤트 발생 시키기
const emitCartUpdate = () => {
  window.dispatchEvent(new CustomEvent('cart-updated'));
};

// 데이터 불러오기
const fetchCart = async () => {
  try {
    const token = localStorage.getItem('accessToken');
    const response = await axios.get(`${SERVER_URL}/api/cart`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    cartItems.value = response.data.items || [];
    // 처음에 모든 항목 선택 상태로 초기화
    selectedIds.value = cartItems.value.map(item => item._id);
  } catch (error) {
    console.error("장바구니 로드 실패", error);
  } finally {
    loading.value = false;
  }
};

// 수량 업데이트 (API 연동)
const updateQty = async (itemId: string, newQty: number) => {
  if (newQty < 1) return;
  try {
    const token = localStorage.getItem('accessToken');
    await axios.patch(`${SERVER_URL}/api/cart`, 
      { itemId, quantity: newQty },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const item = cartItems.value.find(i => i._id === itemId);
    if (item) {
      item.quantity = newQty;
      emitCartUpdate(); // 헤더 숫자 갱신
    }
  } catch (error: any) {
    alert(error.response?.data?.message || '수량 변경에 실패했습니다.');
    await fetchCart();
  }
};

// 개별 삭제
const deleteItem = async (itemId: string) => {
  if (!confirm('정말 삭제하시겠습니까?')) return;
  try {
    const token = localStorage.getItem('accessToken');
    await axios.delete(`${SERVER_URL}/api/cart/${itemId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    cartItems.value = cartItems.value.filter(i => i._id !== itemId);
    emitCartUpdate();
  } catch (error: any) {
    alert(error.response?.data?.message || '삭제에 실패했습니다.');
  }
};

// 선택된 항목들의 계산
const selectedItemsData = computed(() => 
  cartItems.value.filter(item => selectedIds.value.includes(item._id))
);

// 선택된 상품들의 순수 상품가 합계
const totalProductPrice = computed(() => 
  selectedItemsData.value.reduce((acc, item) => acc + (item.price * item.quantity), 0)
);

// 배송비 계산 (선택된 상품 합계 기준)
const shippingFee = computed(() => {
  if (selectedItemsData.value.length === 0) return 0; // 선택한 상품이 없으면 0원
  return totalProductPrice.value >= 50000 ? 0 : 2800;
});

// 최종 결제 예정 금액 (상품가 + 배송비)
const finalOrderPrice = computed(() => totalProductPrice.value + shippingFee.value);

// 전체 선택/해제 토글
const toggleAll = () => {
  if (selectedIds.value.length === cartItems.value.length) {
    selectedIds.value = [];
  } else {
    selectedIds.value = cartItems.value.map(item => item._id);
  }
};

// 장바구니 전체 비우기
const clearCart = async () => {
  if (cartItems.value.length === 0) return;
  if (!confirm('장바구니를 모두 비우시겠습니까?')) return;

  try {
    const token = localStorage.getItem('accessToken');
    // 백엔드 API 설계에 따라 엔드포인트는 다를 수 있습니다 (보통 /api/cart)
    await axios.delete(`${SERVER_URL}/api/cart/all/clear`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    // 클라이언트 상태 초기화
    cartItems.value = [];
    selectedIds.value = [];
    
    emitCartUpdate(); // 헤더 숫자 갱신
    alert("장바구니를 비웠습니다.");
  } catch (error) {
    console.error("장바구니 비우기 실패", error);
    alert("장바구니를 비우는 중 오류가 발생했습니다.");
  }
};

const goToOrderForm = () => {
  if (selectedIds.value.length === 0) {
    alert("주문할 상품을 선택해주세요.");
    return;
  }

  // 선택된 상품 정보와 계산된 금액들을 객체로 묶어서 전달
  const orderPayload = {
    items: selectedItemsData.value,
    totalProductPrice: totalProductPrice.value,
    shippingFee: shippingFee.value,
    finalOrderPrice: finalOrderPrice.value
  };

  // 상세 페이지로 이동
  router.push({
    name: 'OrderForm',
    state: { orderData: JSON.stringify(orderPayload) }
  });
};

onMounted(fetchCart);
</script>

<template>
  <div class="cart-page">
    <h2>SHOPPING CART</h2>
    
    <div v-if="loading">로딩 중입니다.</div>

    <div v-else-if="cartItems.length === 0" class="empty-cart">
      장바구니가 비어 있습니다.
    </div>
    
    <div v-else class="cart-container">
      <div class="cart-list">
        <div class="list-header">
          <label class="all-check-label">
            <input type="checkbox" :checked="selectedIds.length === cartItems.length" @change="toggleAll" />
            <span>전체선택</span>
          </label>
          <span>상품정보</span>
          <span>수량</span>
          <span>주문금액</span>
          <span>배송비</span>
          <span></span>
        </div>

        <div v-for="item in cartItems" :key="item._id" class="cart-item">
          <input type="checkbox" :value="item._id" v-model="selectedIds" />
          
          <div class="product-info">
            <img :src="getImageUrl(item.variantId?.images?.thumbnail)" class="thumb" />
            
            <div class="details">
              <p class="name">{{ item.productId?.name?.ko }}</p>
              <p class="option">[{{ item.variantId?.color }} / {{ item.size }}]</p>
            </div>
          </div>
          
          <div class="qty-control">
            <button @click="updateQty(item._id, item.quantity - 1)">-</button>
            <input type="number" v-model.number="item.quantity" readonly />
            <button @click="updateQty(item._id, item.quantity + 1)">+</button>
          </div>
            
          <div class="item-price">
            {{ (item.price * item.quantity).toLocaleString() }}원
          </div>
            
          <div class="delivery">{{ shippingFee === 0 ? '무료' : '2,800원' }}</div>
            <button @click="deleteItem(item._id)" class="del-btn">✕</button>
          </div>
        </div>
        
        <div class="cart-summary">
          <div class="summary-box">
            <div class="row">
              <span>총 상품금액</span>
              <span>{{ totalProductPrice.toLocaleString() }}원</span>
            </div>
            
            <div class="row">
              <span>총 배송비</span>
              <span>+ {{ shippingFee.toLocaleString() }}원</span>
            </div>
            
            <div v-if="shippingFee > 0" class="shipping-info">
              (50,000원 이상 구매 시 무료배송)
            </div>
            
            <hr />
            
            <div class="row total">
              <span>결제예정금액</span>
              <span>{{ finalOrderPrice.toLocaleString() }}원</span>
            </div>
          </div>
          
        <button class="order-btn" @click="goToOrderForm">주문하기</button>
        <button class="order-all-btn" @click="clearCart">장바구니 비우기</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 페이지 레이아웃 및 제목 */
.cart-page { 
  max-width: 1200px; 
  margin: 60px auto; 
  padding: 0 20px; 
  font-family:var(--font-body);
}

h2 { 
  font-size: 28px; 
  text-align: center; 
  letter-spacing: 2px; 
  margin-bottom: 50px; 
  font-weight: 700;
}

.cart-container {
  display: flex;
  gap: 40px;
  align-items: flex-start;
}

/* 장바구니 리스트 공통 스타일 */
.cart-list { flex: 1; }

.list-header, .cart-item { 
  display: grid;
  grid-template-columns: 100px 1fr 150px 150px 120px 40px; 
  align-items: center;
  text-align: center;
}

/* 리스트 헤더 */
.list-header { 
  padding: 15px 0; 
  border-top: 2px solid #1a1a1a; 
  border-bottom: 1px solid #eee; 
  background-color: #fff;
}

.list-header span, 
.all-check-label span {
  font-size:18px; 
  font-weight: 600; 
  color: #333;
}

/* 전체선택 & 체크박스 */
.all-check-label {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px; 
  cursor: pointer;
}

.all-check-label input,
.cart-item input[type="checkbox"] {
  width: 16px;
  height: 16px;
  cursor: pointer;
  margin: 0;
}

/* 개별 상품 옵션 */
.cart-item { 
  padding: 25px 0; 
  border-bottom: 1px solid #eee; 
}

.product-info { 
  display: flex; 
  align-items: center; 
  gap: 20px; 
  text-align: left; 
}

.thumb { 
  width: 100px; 
  height: 120px; 
  object-fit: cover; 
  background-color: #f5f5f5;
  border-radius: 4px;
}

.details .name { 
  font-size:19px; 
  font-weight: 600; 
  margin-bottom: 8px; 
  color: #333;
}

.details .option { font-size:17px; color: #999; }

/* 수량 조절 및 가격 */
.qty-control { 
  display: flex;
  align-items: center;
  border: 1px solid #e5e5e5;
  background: #fff;
  border-radius: 4px;
  overflow: hidden;
  width: fit-content;
  margin: 0 auto; 
}

.qty-control button { 
  width: 32px;
  height: 32px;
  border: none;
  background-color: #f9f9f9;
  cursor: pointer;
  font-size: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}
.qty-control button:hover { background-color: #eee; }

.qty-control input { 
  width: 40px;
  height: 32px;
  text-align: center;
  border: none;
  border-left: 1px solid #e5e5e5;
  border-right: 1px solid #e5e5e5;
  font-size:18px;
  font-weight: 500;
  outline: none;
}

/* 수량 input 화살표 제거 */
.qty-control input::-webkit-outer-spin-button,
.qty-control input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.item-price { font-weight: 700; color: #333; font-size:19px; }

.del-btn { 
  background: none; 
  border: none; 
  color: #ccc; 
  cursor: pointer; 
  font-size: 18px; 
  transition: color 0.2s;
}
.del-btn:hover { color: #1a1a1a; }

/* 우측 사이드바 */
.cart-summary { 
  width: 350px; 
  position: sticky; 
  top: 100px; 
}

.summary-box { 
  background: #fcfcfc; 
  padding: 30px; 
  border: 1px solid #eee; 
  border-radius: 8px;
}

.summary-box .row { 
  display: flex; 
  justify-content: space-between; 
  margin-bottom: 20px; 
  font-size:18px;
  color: #666;
}

.summary-box .total { 
  margin-top: 20px; 
  padding-top: 20px; 
  border-top: 1px solid #eee; 
  color: #1a1a1a;
  font-weight: 800;
}

.total span:last-child { 
  font-size: 24px; 
  color:#52627a; 
}

.shipping-info { 
  font-size:16px; 
  color: #ff5a5a; 
  background: #fff0f0; 
  padding: 8px; 
  text-align: center; 
  border-radius: 4px; 
  margin-bottom: 15px;
}

/* 버튼 및 상태 알림 */
.order-btn, .order-all-btn { 
  width: 100%; 
  height: 60px; 
  margin-top: 12px; 
  cursor: pointer; 
  border: none; 
  font-size:18px; 
  font-weight: 700; 
  border-radius: 4px;
  transition: all 0.3s;
}

.order-btn { background: #074CA1; color: #fff; }
.order-btn:hover { background: #063d82; }

.order-all-btn { 
  background: #eff6ff;
  color: #666;
  border: 1px solid #eee;
  box-shadow: none;
}

.order-all-btn:hover { 
  background: #e9e9e9;
  color: #333;
  transform: translateY(-2px);
}

.empty-cart {
  text-align: center;
  padding: 100px 0;
  border-top: 1px solid #eee;
  color: #999;
}

/* 태블릿 및 모바일 반응형 스타일 */
@media (max-width: 1024px) {
  .cart-container {
    flex-direction: column;   /* 리스트와 요약본을 세로로 배치 */
    gap: 30px;
  }

  .cart-summary {
    width: 100%;
    position: static;         /* 스크롤 따라오기 해제 */
  }

  /* 헤더 숨기기 */
  .list-header {
    display: none;
  }

  .cart-item {
    grid-template-columns: 40px 100px 1fr 40px; 
    grid-template-rows: auto auto;
    gap: 15px;
    padding: 20px 10px;
    text-align: left;
  }

  /* 체크박스 위치 고정 */
  .cart-item input[type="checkbox"] {
    grid-column: 1;
    grid-row: 1 / 3;
    align-self: center;
  }

  /* 상품 정보 */
  .product-info {
    grid-column: 2 / 4;
    grid-row: 1;
  }

  /* 수량 조절 버튼 */
  .qty-control {
    grid-column: 2;
    grid-row: 2;
    margin: 0;
  }

  /* 가격 정보 */
  .item-price {
    grid-column: 3;
    grid-row: 2;
    text-align: right;
    align-self: center;
    font-size: 18px;
  }

  /* 삭제 버튼 */
  .del-btn {
    grid-column: 4;
    grid-row: 1;
    align-self: flex-start;
  }

  .delivery {
    display: none;
  }
}

@media (max-width: 480px) {
  h2 { font-size: 22px; margin-bottom: 30px; }
  
  .thumb {
    width: 70px;
    height: 90px;
  }
  
  .details .name { font-size:18px; }
  
  .summary-box { padding: 20px; }
  
  .total span:last-child { font-size: 20px; }
}
</style>