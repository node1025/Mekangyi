<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import axios from 'axios';
import ProductInformation from './ProductInformation.vue';

const route = useRoute();
const router = useRouter();

// 서버 기본 URL 설정
const SERVER_URL = ((import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '')).replace(/\/$/, '');

const loadError = ref('');
const reloadKey = ref(0);
const mainImageFailed = ref(false);
const loading = ref(true);        // 로딩 상태

const product = ref<any>(null);   // 상품 기본 정보
const variants = ref<any[]>([]);  // 상품 색상/옵션(Variant) 목록
 
const selectedVariantIndex = ref<number>(0);    // 현재 선택된 색상(Variant)의 인덱스
const selectedImage = ref<string | null>(null); // 갤러리에서 사용자가 선택한 메인 이미지
const selectedSize = ref<string | null>(null);  // 선택된 사이즈
const selectedItems = ref<any[]>([]);           // 선택된 옵션들을 담는 배열
const activeTab = ref('detail');                // 현재 활성화된 탭
function jumpToSection(section: string) {
  activeTab.value = section;
  const ids: Record<string, string> = { detail: 'detail-anchor', guide: 'guide-anchor', reviews: 'review-anchor', qna: 'qna-anchor' };
  const target = document.getElementById(ids[section] || 'detail-anchor');
  target?.focus({ preventScroll: true });
  target?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
}

const reviews = ref<any[]>([]); // 리뷰 목록 저장

// 현재 선택된 Variant (색상)
const currentVariant = computed(() => {
  return variants.value.length > 0 ? variants.value[selectedVariantIndex.value] : null;
});

const sizeOrder = ['S', 'M', 'L', 'XL'];
const orderedInventory = computed(() => [...(currentVariant.value?.inventory || [])].sort((a, b) => {const ai=sizeOrder.indexOf(String(a.size)),bi=sizeOrder.indexOf(String(b.size));return (ai<0?999:ai)-(bi<0?999:bi)||String(a.size).localeCompare(String(b.size),'ko',{numeric:true})}));

// 메인 영역에 표시할 이미지
const displayImage = computed(() => {
  // 사용자가 갤러리를 클릭했다면 그 이미지를, 아니면 해당 옵션의 썸네일을 보여줌
  return selectedImage.value || currentVariant.value?.images?.thumbnail || '/default-image.png';
});

watch(displayImage, () => { mainImageFailed.value = false; });

/** API가 내려주는 현재 판매 단가 (가격 모드·이벤트 기간 반영) */
const unitPrice = computed(() => {
  const p = product.value;
  if (!p) return 0;
  const n = Number(p.salePrice ?? p.finalPrice ?? p.price ?? 0);
  return Number.isFinite(n) ? n : 0;
});

const displayDiscountRate = computed(() => {
  const p = product.value;
  if (!p) return 0;
  const eff = p.effectiveDiscountRate;
  if (typeof eff === 'number' && eff >= 0) return eff;
  return Number(p.discountRate) || 0;
});

const showDiscountBadge = computed(() => {
  const p = product.value;
  if (!p) return false;
  if (typeof p.isDiscountActive === 'boolean') return p.isDiscountActive;
  return Number(p.basePrice) > unitPrice.value;
});

// 최종 판매가 포맷팅 함수
const formattedFinalPrice = computed(() => {
  if (!product.value || !unitPrice.value) return '';
  return new Intl.NumberFormat('ko-KR').format(unitPrice.value);
});

const formattedOriginalPrice = computed(() => {
  if (!product.value) return '';
  return new Intl.NumberFormat('ko-KR').format(Number(product.value.basePrice) || 0);
});

// 적립 포인트 계산 함수
const rewardPoints = computed(() => {
  const price = unitPrice.value;
  if (!price) return '0';

  // 0.8% 계산 (소수점 버림)
  const points = Math.floor(price * 0.008);

  // 천 단위 쉼표 포맷팅
  return new Intl.NumberFormat('ko-KR').format(points);
});

// 총 수량 계산 함수
const totalCount = computed(() => {
  return selectedItems.value.reduce((acc, item) => acc + item.quantity, 0);
});

// 총 금액 계산 함수
const totalPrice = computed(() => {
  const total = selectedItems.value.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  return new Intl.NumberFormat('ko-KR').format(total);
});

// 이미지 경로를 URL로 변환하는 헬퍼 함수
const getImageUrl = (path: string | null) => {
  if (!path) return '/default-image.png'; // 이미지가 없을 때 기본 이미지
  
  // Windows 경로(\) → URL 경로(/)로 변환
  const normalizedPath = path.replace(/\\/g, '/');
  
  // 이미 전체 URL 형태라면 그대로 반환, 아니라면 서버 URL과 결합
  return normalizedPath.startsWith('http') 
    ? normalizedPath 
    : `${SERVER_URL}/${normalizedPath.replace(/^\//, '')}`;
};

// 색상을 변경할 때마다 메인 이미지를 해당 색상의 썸네일로 초기화
const onVariantChange = () => {
  selectedImage.value = null;
  selectedSize.value = null;
};

// 사이즈 선택 시 실행될 함수
const onSizeChange = (event: Event) => {
  const target = event.target as HTMLSelectElement;
  const size = target.value;

  if (!size || !currentVariant.value) return;

  // 이미 추가된 옵션인지 확인
  const isExist = selectedItems.value.find(
    (item) => item.variantId === currentVariant.value._id && item.size === size
  );

  if (isExist) {
    alert('이미 선택한 옵션입니다.');
    selectedSize.value = null;
    return;
  }

  // 옵션 추가
  selectedItems.value.push({
    variantId: currentVariant.value._id,
    color: currentVariant.value.color,
    size: size,
    quantity: 1,
    price: unitPrice.value
  });

  // 선택창 초기화
  selectedSize.value = null;
};

// 수량 조절 및 삭제 함수
const updateQuantity = (index: number, delta: number) => {
  const item = selectedItems.value[index];
  const newQuantity = item.quantity + delta;

  // 최소 수량 제한 (1개 미만 방지)
  if (newQuantity < 1) return;

  // 최대 수량 제한 (재고 기반 - 선택 사항)
  item.quantity = newQuantity;
};

const removeItem = (index: number) => {
  selectedItems.value.splice(index, 1);
};

// 장바구니 공통 저장 로직
const saveToCart = async () => {
  for (const item of selectedItems.value) {
    await axios.post(`${SERVER_URL}/api/cart`, {
      productId: product.value._id,
      variantId: item.variantId,
      size: item.size,
      quantity: item.quantity,
      price: item.price
    }, {
      headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` }
    });
  }
  window.dispatchEvent(new CustomEvent('cart-updated'));  // 장바구니 상태 갱신 이벤트
};

// 장바구니 담기
const addToCart = async () => {
  if (selectedItems.value.length === 0) {
    alert('선택된 옵션이 없습니다.');
    return;
  }
  try {
    await saveToCart();
    if(confirm('장바구니에 담겼습니다. 장바구니로 이동하시겠습니까?')) {
      router.push('/cart');
    }
  } catch (error) {
    alert('로그인이 필요합니다.');
  }
};

// 바로 구매
const buyNow = async () => {
  if (selectedItems.value.length === 0) {
    alert('옵션을 선택해 주세요.');
    return;
  }
  try {
    await saveToCart();
    router.push('/cart');
  } catch (error) {
    alert('로그인이 필요합니다.');
  }
};

// 리뷰 데이터 가져오기 함수
const fetchReviews = async (productId: string) => {
  try {
    const response = await axios.get(`${SERVER_URL}/api/review/product/${productId}`);
    if (response.data.success && product.value?._id === productId) {
      reviews.value = response.data.reviews;
    }
  } catch (error) {
    console.error("리뷰 로드 실패", error);
  }
};

// 사용자 이메일 마스킹 함수
const maskUserId = (user: any) => {
  // user 객체에서 이메일 추출 (데이터가 문자열일 경우도 대비)
  const email = typeof user === 'object' ? user?.email : user;
  
  if (!email || !email.includes('@')) return '익명 사용자';

  // 이메일을 아이디와 도메인으로 분리
  const [prefix, domain] = email.split('@');

  // 아이디 마스킹 로직
  let maskedPrefix = '';
  if (prefix.length <= 2) {
    maskedPrefix = prefix[0] + '*';
  } else if (prefix.length <= 4) {
    maskedPrefix = prefix.slice(0, 2) + '**';
  } else {
    // 앞 3자리는 남기고 뒤는 모두 마스킹
    maskedPrefix = prefix.slice(0, 3) + '****';
  }

  // 결합 (예: abc****@gmail.com)
  return `${maskedPrefix}@${domain}`;
};

// 컴포넌트 마운트 시 상품 데이터 로드
let loadVersion = 0;
watch([() => route.params.id, reloadKey], async ([productCode]) => {
  const version = ++loadVersion;
  loading.value = true;
  loadError.value = '';
  activeTab.value = 'detail';
  product.value = null;
  variants.value = [];
  reviews.value = [];
  selectedItems.value = [];
  selectedVariantIndex.value = 0;
  onVariantChange();
  try {
    const response = await axios.get(`${SERVER_URL}/api/products/${productCode}`);
    if (version !== loadVersion) return;
    product.value = response.data.product;
    variants.value = response.data.variants;

    if (product.value?._id) {
      await fetchReviews(product.value._id);
    }
  } catch (error) {
    if (version !== loadVersion) return;
    loadError.value = axios.isAxiosError(error) && error.response?.status === 404
      ? '상품을 찾을 수 없습니다.' : '상품 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.';
  } finally {
    if (version === loadVersion) loading.value = false;
  }
}, { immediate: true });

// 별점 표시용 헬퍼 함수
const renderStars = (rating: number) => {
  return '★'.repeat(rating) + '☆'.repeat(5 - rating);
};
</script>

<template>
  <div v-if="loading" class="loading-state" role="status">데이터를 불러오는 중입니다...</div>
  <div v-else-if="loadError" class="product-load-error" role="alert">
    <p>{{ loadError }}</p>
    <button type="button" @click="reloadKey++">다시 불러오기</button>
    <router-link to="/">홈으로</router-link>
  </div>
  
  <div v-else-if="product" class="product-container">
    <div class="image-section">
      <div class="main-display">
        <img v-if="!mainImageFailed" :src="getImageUrl(displayImage)" :alt="product.name.ko" @error="mainImageFailed = true" />
        <div v-else class="main-image-empty">상품 이미지를 준비 중입니다.</div>
      </div>
      
      <div class="thumbnail-grid" v-if="currentVariant?.images?.gallery?.length">
        <div 
          v-for="(img, index) in currentVariant.images.gallery" 
          :key="index"
          class="thumb-wrapper"
          :class="{ active: displayImage === img }"
          @click="selectedImage = img"
        >
          <img :src="getImageUrl(img)" />
        </div>
      </div>
    </div>
    
    <div class="info-section">
      <h1 class="product-title">{{ product.name.ko }}</h1>
      
      <div class="price-info">
        <div class="price-row">
          <span v-if="showDiscountBadge && displayDiscountRate > 0" class="percent">{{ displayDiscountRate }}%</span>
          <span class="sale-price">{{ formattedFinalPrice }}원 </span>
          <span v-if="showDiscountBadge" class="original-price">{{ formattedOriginalPrice }}원</span>
        </div>

        <div class="benefit-details">
          <div class="benefit-row highlight">
            <span class="label">적립혜택</span>
            <span class="value">{{ rewardPoints }}원 (0.8%)</span>
          </div>
          <div class="benefit-row">
            <span class="label">국내·해외배송</span>
            <span class="value">국내배송</span>
          </div>
          <div class="benefit-row">
            <span class="label">배송방법</span>
            <span class="value">택배</span>
          </div>
          <div class="benefit-row">
            <span class="label">배송비</span>
            <span class="value">전상품 5만원이상 결제시 <span class="free">무료배송</span></span>
          </div>
        </div>
      </div>

      <div class="options-container">
        <div class="option-group">
          <label>색상</label>
          <select v-model="selectedVariantIndex" @change="onVariantChange">
            <option v-for="(variant, idx) in variants" :key="variant._id" :value="idx">
              {{ variant.color }}
            </option>
          </select>
        </div>

        <div class="option-group">
          <label>옵션</label>
          <select v-model="selectedSize" @change="onSizeChange">
            <option :value="null" disabled>- [필수] 옵션을 선택해 주세요 -</option>
            <option 
              v-for="inv in orderedInventory" 
              :key="inv._id"
              :disabled="inv.stockQuantity === 0"
              :value="inv.size"
            >
              {{ inv.size }} {{ inv.stockQuantity === 0 ? '(품절)' : `` }}
            </option>
          </select>
        </div>
      </div>
      
      <div class="selected-list" v-if="selectedItems.length > 0">
        <div v-for="(item, index) in selectedItems" :key="index" class="selected-item">
          <div class="item-info">
            <span class="item-name">{{ product.name.ko }}</span>
            <span class="item-option">{{ item.color }} / {{ item.size }}</span>
          </div>
    
          <div class="item-control">
            <div class="quantity-box">
              <button @click="updateQuantity(index, -1)">-</button>
              <input type="number" v-model.number="item.quantity" readonly />
              <button @click="updateQuantity(index, 1)">+</button>
            </div>
            <div class="item-price-delete">
              <span class="item-price">{{ (item.price * item.quantity).toLocaleString() }}원</span>
              <button class="remove-btn" @click="removeItem(index)">✕</button>
            </div>
          </div>
        </div>
      </div>
      
      <div class="total-price-area">
        <span class="label">총 상품금액</span>
        <div class="total-val">
          <span class="amount">{{ totalPrice }}원</span>
          <span class="count">({{ totalCount }}개)</span>
        </div>
      </div>
      
      <div class="button-grid">
        <button class="buy-now-btn" @click="buyNow">바로 구매</button>
        <div class="sub-action-btns">
          <button class="cart-btn" @click="addToCart">장바구니 담기</button>
          <button class="wish-btn">찜하기</button>
        </div>
      </div>
    </div>
  </div>

  <div v-if="product && !loading" class="product-tabs-container">
    <nav class="tab-menu" aria-label="상품 정보 바로가기">
      <a href="#detail-anchor" :class="{ active: activeTab === 'detail' }" :aria-current="activeTab === 'detail' ? 'location' : undefined" @click.prevent="jumpToSection('detail')">제품상세</a>
      <a href="#guide-anchor" :class="{ active: activeTab === 'guide' }" :aria-current="activeTab === 'guide' ? 'location' : undefined" @click.prevent="jumpToSection('guide')">상품구매안내</a>
      <a href="#review-anchor" :class="{ active: activeTab === 'reviews' }" :aria-current="activeTab === 'reviews' ? 'location' : undefined" @click.prevent="jumpToSection('reviews')">리뷰</a>
      <a href="#qna-anchor" :class="{ active: activeTab === 'qna' }" :aria-current="activeTab === 'qna' ? 'location' : undefined" @click.prevent="jumpToSection('qna')">Q&A</a>
    </nav>
    
    <div class="tab-content">
      <div class="content-detail" id="detail-anchor" tabindex="-1" aria-label="제품상세">
        <ProductInformation :product="product" :variants="variants" :variant="currentVariant" :server-url="SERVER_URL" />
      </div>
      
      <section class="guide-section product-page-section" id="guide-anchor" tabindex="-1" aria-labelledby="guide-title">
        <h2 class="product-section-title" id="guide-title">상품구매안내</h2>
        <h3>교환 및 반품안내</h3>
        <div class="guide-text-block">
          <p><strong>※ 교환 및 반품안내</strong></p>
          <p>- 고객의 변심에 의한 교환 및 반품이면 배송비는 소비자부담이며 상품의 이상에 의한 교환 및 반품이면 배송비는 판매자부담입니다.</p>
          <p>- 상품을 수령일로부터 7일이내에 교환/반품이 가능합니다. 게시판, 고객센터(1588-0000)에서 접수해주시면 됩니다.</p>
          <p>- 상품불량/오배송으로 인한 교환/반품의 경우 동일한 상품으로 무상교환 및 전액 환불이 가능합니다.</p>
        </div>
        
        <div class="guide-text-block">
          <p><strong>※ 아래의 사유는 교환/반품이 불가합니다.</strong></p>
          <p>1. 제품을 훼손한 경우 (제품을 확인하기 위한 포장 훼손의 경우는 제외)</p>
          <p>2. 사용 및 시간의 경과로 상품의 가치가 현저히 감소된 경우</p>
        </div>
        
        <div class="guide-text-block highlight-box">
          <p>교환 및 반품은 <strong>우체국택배(1588-1300)</strong> 전화접수 후 <strong>5,600원 동봉 후 착불</strong>로 보내주시면 됩니다.</p>
          <p>타택배 이용 시 고객님께서 요금지불 해주셔야 하며, 가까운 편의점 이용 시에도 선불로 요금을 지불하신 후 보내주시기 바랍니다.</p>
        </div>
      </section>
    </div>

    <section class="content-reviews product-page-section" id="review-anchor" tabindex="-1" aria-labelledby="reviews-title">
      <h2 class="product-section-title" id="reviews-title">리뷰</h2>
      <div v-if="reviews.length > 0" class="review-list">
        <div v-for="review in reviews" :key="review._id" class="review-card">
          <div class="review-header">
            <div class="user-info">
              <span class="stars">{{ renderStars(review.rating) }}</span>
              <span class="user-name">{{ maskUserId(review.userId) }}</span>
            </div>
            <span class="review-date">{{ new Date(review.createdAt).toLocaleDateString() }}</span>
          </div>
          
          <div class="review-body">
            <p class="review-text">{{ review.content }}</p>
            
            <div v-if="review.images && review.images.length > 0" class="review-images">
              <img v-for="(img, idx) in review.images" :key="idx" :src="getImageUrl(img)" class="review-img" />
            </div>
          </div>
        </div>
      </div>
      
      <div v-else class="empty-board">
        <p>등록된 리뷰가 없습니다.</p>
      </div>
    </section>
    
    <section class="content-qna product-page-section" id="qna-anchor" tabindex="-1" aria-labelledby="qna-title">
      <h2 class="product-section-title" id="qna-title">Q&A</h2>
      <div class="empty-board">
        <p>상품에 대해 궁금한 점을 문의해주세요.</p>
        <RouterLink to="/board?category=qna" class="product-qna-link">상품 문의 남기기 ↗</RouterLink>
      </div>
    </section>
  </div>
</template>

<style scoped>
/* 전체 레이아웃 */
.product-container {
  display: flex;
  max-width: 1200px;
  margin: 0 auto;
  gap: 40px;
  padding: 20px;
}

/* 이미지 섹션 */
.image-section {
  flex: 1.1;
  display: flex;
  flex-direction: column;
  align-items: center;
}

/* 메인 상품 이미지 */
.main-display img {
  width: 510px;
  height: 510px;
  border-radius: 4px;
}

/* 썸네일 이미지 영역 */
.thumbnail-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 15px;
  justify-content: center;
}

.thumb-wrapper {
  width: 80px;
  height: 80px;
  cursor: pointer;
  border: 1px solid #eee;
  transition: border-color 0.2s;
}

.thumb-wrapper.active {
  border: 2px solid #333;
}

/* 썸네일 이미지 */
.thumb-wrapper img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* 상품 정보 섹션 */
.info-section {
  flex: 1;
}

/* 상품명 */
.product-title {
  flex: 1;
  font-size: 22px;
  font-weight: 600;
  line-height: 1.4;
  color: #1a1a1a;
}

/* 가격 정보 영역 */
.price-info {
  border-bottom: 1px solid #f4f4f4;
  padding-bottom: 25px;
  margin-bottom: 25px;
}

.percent {
  font-size: 24px;
  font-weight: bold;
  color: #ff8a7a;
  margin-right: 10px;
}

.sale-price {
  font-size: 24px;
  font-weight: bold;
  color: #333;
}

.original-price {
  font-size:19px;
  color: #bbb;
  text-decoration: line-through;
  margin-left: 8px;
}

/* 혜택 정보 */
.benefit-details {
  margin-top: 20px;
  font-size:17px;
  color: #666;
}

.benefit-row {
  display: flex;
  margin-bottom: 8px;
}

.benefit-row .label {
  width: 100px;
  color: #333;
}

.benefit-row.highlight .value,
.free {
  color: #ff5a5a;
  font-weight: bold;
}

/* 옵션 선택 영역 */
.option-group {
  display: flex;
  align-items: center;
  margin-bottom: 15px;
}

.option-group label {
  width: 100px;
  font-size:17px;
  color: #333;
}

/* 셀렉트 박스 */
select {
  flex: 1;
  padding: 10px;
  border: 1px solid #ddd;
  font-size:17px;
  border-radius: 0;
  outline: none;
}

/* 옵션 영역 상단 여백 */
.options-container {
  padding-top: 10px;
}

/* 선택된 옵션 리스트 */
.selected-list {
  margin: 20px 0;
  background-color: #fbfbfb; 
  border-top: 1px solid #eee;
  max-height: 400px;
  overflow-y: auto;
}

/* 옵션 1개 단위 */
.selected-item {
  padding: 20px 15px;
  border-bottom: 1px solid #eee;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.selected-item:last-child {
  border-bottom: none;
}

/* 옵션 이름 영역 */
.item-info {
  margin-bottom: 12px;
  font-size:17px;
  color: #333;
}

/* 옵션 상세 */
.item-option {
  display: block;
  margin-top: 4px;
  color: #888;
  font-size:16px;
}

.item-control {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

/* 수량 조절 박스 스타일 */
.quantity-box {
  display: flex;
  align-items: center;
  border: 1px solid #e5e5e5;
  background: #fff;
  border-radius: 4px;
  overflow: hidden;
  width: fit-content;
}

.quantity-box button {
  width: 32px;
  height: 32px;
  border: none;
  background-color: #f9f9f9;
  cursor: pointer;
  font-size: 18px;
  color: #333;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s, color 0.2s;
}

.quantity-box button:hover {
  background-color: #eee;
  color: #000;
}

.quantity-box input {
  width: 40px;
  height: 32px;
  text-align: center;
  border: none;
  border-left: 1px solid #e5e5e5;
  border-right: 1px solid #e5e5e5;
  font-size:18px;
  font-weight: 500;
  outline: none;
  background: #fff;
  color: #333;
}

/* 숫자 입력 화살표 제거 */
.quantity-box input::-webkit-outer-spin-button,
.quantity-box input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

/* 옵션 가격 & 삭제 버튼 */
.item-price-delete {
  display: flex;
  align-items: center;
  gap: 12px;
}

.item-price {
  font-weight: 600;
  font-size:18px;
  color: #333;
}

.remove-btn {
  background: none;
  border: none;
  color: #bbb;
  cursor: pointer;
  font-size:18px;
  padding: 5px;
}

.remove-btn:hover {
  color: #ff5a5a;
}

/* 총 가격 영역 */
.total-price-area {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  padding: 25px 0;
  border-top: 2px solid #333;
}

.total-price-area .label {
  font-size:18px;
  font-weight: bold;
}

.total-val .amount {
  font-size: 24px;
  color: #333;
  letter-spacing: -0.5px;
}

.total-val .count {
  font-size:17px;
  color: #888;
  margin-left: 4px;
}

/* 버튼 스타일 */
.button-grid {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 10px;
}

.buy-now-btn {
  height: 55px;
  background-color: #074CA1;
  border: none;
  color: #fff;
  font-size:19px;
  font-weight: bold;
  cursor: pointer;
}

.buy-now-btn:hover {
  background-color: #063d82;
}

.sub-action-btns {
  display: flex;
  gap: 8px;
}

.cart-btn,
.wish-btn {
  flex: 1;
  height: 50px;
  background: #eff6ff;
  border: 1px solid #ddd;
  color: #666;
  font-size:17px;
  cursor: pointer;
}

.cart-btn:hover,
.wish-btn:hover {
  background: #dbeafe;
}
/* 탭 섹션 전체 컨테이너 */
.product-tabs-container {
  max-width: 1200px;
  margin: 60px auto;
  padding: 0 20px;
}

/* 탭 메뉴 바 */
.tab-menu {
  display: flex;
  list-style: none;
  padding: 0;
  margin: 0;
  border: 1px solid #eee; /* 전체 테두리 */
}

.tab-menu a {
  flex: 1;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size:18px;
  color: #333;
  cursor: pointer;
  background-color: #fff;
  border-right: 1px solid #eee;
  transition: all 0.2s ease;
}

.tab-menu a:last-child {
  border-right: none;
}

/* 활성화된 탭 스타일 (이미지처럼 검은색 배경) */
.tab-menu a.active {
  background-color: #074CA1;
  color: #fff;
  font-weight: bold;
}

/* 컨텐츠 영역 */
.tab-content {
  padding: 50px 0;
  border-bottom: 1px solid #eee;
}

.loading-state, .product-load-error { padding: 80px 20px; text-align: center; line-height: 1.8; }
.product-load-error button, .product-load-error a { display: inline-block; margin: 12px 8px; color: #074ca1; }
.main-image-empty { width: 100%; min-height: 300px; display: grid; place-items: center; background: #f5f7f9; color: #657080; }

.content-detail {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
}

/* 구매 안내 섹션 스타일 */
.guide-section {
  margin-bottom: 40px;
}

.guide-section h3 {
  font-size:19px;
  margin-bottom: 15px;
  color: #1a1a1a;
  border-left: 3px solid #6a8fe7;
  padding-left: 10px;
}

.guide-section p {
  font-size:18px;
  line-height: 1.8;
  color: #666;
  margin: 5px 0;
}

/* 안내 문구 블록 간격 */
.guide-text-block {
  margin-bottom: 20px;
  line-height: 1.6;
  font-size:18px;
  color: #555;
}

.guide-text-block strong {
  color: #333;
  display: inline-block;
  margin-bottom: 5px;
}

/* 강조 박스 (택배 안내 등) */
.highlight-box {
  background-color: #f9f9f9;
  padding: 20px;
  border-radius: 4px;
  border: 1px solid #eee;
  color: #333;
}

.highlight-box strong {
  color:#52627a; /* 테마색 강조 */
}

/* 리뷰 리스트 스타일 */
.review-list {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.review-card {
  padding: 20px;
  border-bottom: 1px solid #eee;
  text-align: left;
}

.review-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 10px;
}

.stars {
  color: #ffcc00;
  font-size:19px;
  margin-right: 10px;
}

.user-name {
  font-weight: bold;
  font-size:18px;
}

.review-date {
  font-size:16px;
  color: #999;
}

.review-text {
  font-size:18px;
  line-height: 1.6;
  color: #333;
  white-space: pre-line; /* 줄바꿈 허용 */
}

.review-images {
  display: flex;
  gap: 10px;
  margin-top: 15px;
}

.review-img {
  width: 100px;
  height: 100px;
  object-fit: cover;
  border-radius: 4px;
  border: 1px solid #eee;
}

/* Q&A 빈 상태 디자인 */
.empty-board {
  text-align: center;
  padding: 80px 0;
  color: #999;
}


.product-container, .product-tabs-container { box-sizing: border-box; }
.image-section, .info-section { min-width: 0; }
.main-display { width: 100%; max-width: 510px; }
.main-display img { width: 100%; height: auto; aspect-ratio: 1; object-fit: contain; }
.price-row { flex-wrap: wrap; }
@media (max-width: 960px) {
  .product-container { flex-direction: column; gap: 28px; padding: 20px; }
  .info-section { width: 100%; }
  .product-tabs-container { margin-top: 32px; }
}
@media (max-width: 480px) {
  .product-tabs-container { padding: 0 16px; }
  .tab-menu a { font-size:16px; height: 52px; }
  .tab-content { padding: 32px 0; }
  .product-title { font-size: 20px; }
}
.product-detail{color:#254b7b}.product-title{color:#204d88}.btn-buy{background:#3576dd!important;border-color:#3576dd!important;border-radius:10px}.btn-cart{border-color:#b5ceef!important;color:#4275b7!important;border-radius:10px}.options-container select{border-color:#d7e4f7;border-radius:8px}.main-display img{object-fit:contain!important}.product-container{color:#254b7b}.tab-menu a.active{color:#3677da;border-color:#3677da}

.tab-menu a{text-decoration:none;min-width:0;text-align:center;padding:8px;line-height:1.5}
.tab-menu a.active{background:#122551;color:#fff;border-color:#122551}
.content-detail,.product-page-section{scroll-margin-top:170px}
.product-page-section{max-width:900px;margin:64px auto 0;padding-top:42px;border-top:1px solid #dce5f2}
.product-section-title{font-size:26px;color:#122551;line-height:1.5;margin:0 0 28px;font-weight:700}
.product-qna-link{display:inline-block;margin-top:16px;padding:12px 22px;border:1px solid #d2dff2;border-radius:6px;text-decoration:none;color:#122551;background:#f4f7fd;font-size:16px}
@media(max-width:650px){.tab-menu a{font-size:14px;padding:7px 4px}.product-page-section{margin-top:44px;padding-top:30px}.product-section-title{font-size:23px}.guide-text-block{overflow-wrap:anywhere}}
</style>

