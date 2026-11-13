<script setup lang="ts">
import { ref } from 'vue';
import axios from 'axios';
import ProductEditModal from './ProductEditModal.vue';

// 재고(Inventory) 데이터 구조 타입 정의
interface Inventory {
  _id: string;
  variantId: string;
  sku: string;
  size: string;
  stockQuantity: number;
}

// 상품 옵션(ProductVariant) 데이터 구조 타입 정의
interface ProductVariant {
  _id: string;
  productId: string;
  variantCode: string;
  color: string;
  images: {
    thumbnail: string;
    gallery: string[];
  };
  inventories: Inventory[]; // 해당 옵션의 재고 목록 (조인된 데이터)
}

// 상품(Product) 데이터 구조 타입 정의
interface Product {
  _id: string;
  category: string;
  productCode: string;
  thumbnail: string;
  name: {
    ko: string;
    en?: string;
  };
  basePrice: number;
  discountRate: number;
  finalPrice: number;
  priceMode?: 'regular' | 'always' | 'event';
  effectiveDiscountRate?: number;
  isDiscountActive?: boolean;
  material: string;
  origin: string;
  careInstructions?: string;
  tags: string[];

  status: '판매중' | '품절' | '중단';
  
  createdAt: string;
  variants: ProductVariant[]; // 상품 옵션 목록 (조인된 데이터)
  rating: {
    avg: number;
    count: number;
  };
}

// 부모 컴포넌트에서 전달받는 props 타입 정의
const props = defineProps<{
  products: Product[];      // 상품 목록 데이터
  loading: boolean;         // 로딩 상태
}>();

// 부모 컴포넌트로 이벤트 전달
const emit = defineEmits<{
  (e: 'refresh'): void;
}>();

// 현재 확장된 행의 상품 ID를 저장 (없으면 null)
const expandedRowId = ref<string | null>(null);

// 테이블 행 클릭 시 확장/축소를 토글하는 함수
const toggleRow = (id: string) => {
  expandedRowId.value = expandedRowId.value === id ? null : id;
};

// 평균 평점을 별 문자로 변환하는 유틸 함수
const getStarRating = (avg: number = 0) =>
  "★".repeat(Math.floor(avg)) + "☆".repeat(5 - Math.floor(avg));

// 색상 매핑
const colorMap: Record<string, string> = {
  'Brown': '#5B3929',
  'Dark Navy': '#212A2E',
  'Dark Green': '#182B1E',
  'Ivory': '#EFEBE0'
};

// 색상 값을 반환하는 함수
const getColorValue = (colorName: string) => {
  // 매핑 사전에 있으면 해당 값 반환
  if (colorMap[colorName]) return colorMap[colorName];
  
  // 아무것도 해당 안 되면 기본값(투명) 반환
  return colorName || 'transparent';
};

// 상품 수정 모달 상태 관리
const isModalOpen = ref(false);
const editingProduct = ref<Product | null>(null);

// 수정 버튼 클릭 핸들러 수정
const handleEdit = (product: Product) => {
  editingProduct.value = product; // 선택한 상품 할당
  isModalOpen.value = true;       // 모달 열기
};

// 상품 수정 처리 함수
const onUpdateProduct = async (payload: any) => { 
  try {
    const token = localStorage.getItem('accessToken');
    
    // ID 추출
    const productId = payload._id; 

    if (!productId) {
      alert("상품 ID를 찾을 수 없습니다.");
      return;
    }

    // 서버 전송용 데이터 구조
    const requestPayload = {
      productData: payload.productData,
      variants: payload.variants
    };

    // API 호출
    const response = await axios.patch(
      `/api/products/${productId}`,
      requestPayload, 
      { 
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        } 
      }
    );

    if (response.status === 200) {
      alert('성공적으로 수정되었습니다.');
      isModalOpen.value = false;
      window.dispatchEvent(new Event('products-updated'));
      localStorage.setItem('products-updated', String(Date.now()));
      emit('refresh');  // 목록 새로고침
    }
  } catch (error: any) {
    console.error('수정 에러 상세:', error.response?.data);
    alert('수정 실패: ' + (error.response?.data?.message || '서버 오류'));
  }
};

// 상품 삭제 처리 함수
const handleDelete = async (id: string, event: Event) => {
  event.stopPropagation();  // 이벤트 버블링 방지

  if (!confirm('정말 삭제하시겠습니까?')) return;

  try {
    // 로컬 스토리지에서 토큰 가져오기
    const token = localStorage.getItem('accessToken');
    
    if (!token) {
      alert('로그인 세션이 만료되었습니다. 다시 로그인해주세요.');
      return;
    }

    // API 호출
    const response = await axios.delete(`/api/products/${id}`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    
    if (response.status === 200 || response.status === 204) {
      alert('상품이 삭제되었습니다.');
      window.dispatchEvent(new Event('products-updated'));
      localStorage.setItem('products-updated', String(Date.now()));
      emit('refresh'); 
      if (expandedRowId.value === id) {
        expandedRowId.value = null;
      }
    }
  } catch (error: any) {
    console.error('삭제 중 에러 발생:', error);
    if (error.response?.status === 401 || error.response?.status === 403) {
      alert('삭제 권한이 없습니다. 관리자 계정인지 확인해주세요.');
    } else {
      const errorMsg = error.response?.data?.message || '서버와의 통신 중 오류가 발생했습니다.';
      alert(`삭제 실패: ${errorMsg}`);
    }
  }
};
</script>

<template>
  <div class="table-container">
    <div class="table-header-area">
      <h3 class="table-title">상품 목록 관리</h3> <br/>
      <span class="table-count">전체 {{ products?.length || 0 }}개</span>
    </div>
        
    <div class="table-wrapper">
      <table class="product-table">
        <thead>
          <tr>
            <th class="w-name">상품명</th>
            <th class="w-price">판매가</th>
            <th class="w-status">상태</th>
            <th class="w-date">등록일</th>
            <th class="w-rating">평점</th> 
            <th class="w-action">관리</th>
          </tr>
        </thead>

        <tbody>
          <tr v-if="loading" class="state-row"><td colspan="6">데이터를 불러오는 중입니다...</td></tr>
          <tr v-else-if="!products.length" class="state-row"><td colspan="6">등록된 상품이 없습니다.</td></tr>
          
          <template v-for="product in products" :key="product._id">
            <tr class="product-row clickable" :class="{ 'is-expanded': expandedRowId === product._id }" @click="toggleRow(product._id)">
              <td class="name-text">
                <div class="name-wrapper-horizontal">
                  <span class="expand-icon">{{ expandedRowId === product._id ? '▼' : '▶' }}</span>
                  <span class="ko-name">{{ product.name.ko }}</span>
                </div>
              </td>

              <td class="price-text">
                <div class="price-wrapper">
                  <span v-if="(product.isDiscountActive ?? (product.basePrice > product.finalPrice))" class="origin-price">{{ product.basePrice.toLocaleString() }}원</span>
                  <span class="final-price">{{ product.finalPrice.toLocaleString() }}원</span>
                  <span v-if="(product.isDiscountActive ?? (product.basePrice > product.finalPrice)) && (product.effectiveDiscountRate ?? product.discountRate) > 0" class="discount-pill">-{{ product.effectiveDiscountRate ?? product.discountRate }}%</span>
                </div>
              </td>

              <td class="text-center">
                <span class="status-badge" :class="product.status">{{ product.status }}</span>
              </td>

              <td class="date-text">{{ new Date(product.createdAt).toLocaleDateString() }}</td>
                            
              <td class="rating-text-center">
                <div class="rating-wrapper" :title="`평점: ${product.rating?.avg}`">
                  <span class="star-icon">{{ getStarRating(product.rating?.avg) }}</span>
                  <span class="rating-avg">{{ product.rating?.avg?.toFixed(1) || '0.0' }}</span>
                  <span class="rating-count">({{ product.rating?.count || 0 }})</span>
                </div>
              </td>

              <td class="action-column">
                <div class="action-buttons">
                  <button class="btn-edit" @click.stop="handleEdit(product)">수정</button>
                  <button class="btn-delete" @click.stop="handleDelete(product._id, $event)">삭제</button>
                </div>
              </td>
            </tr>

            <tr v-if="expandedRowId === product._id" class="detail-row">
              <td colspan="6">
                <div class="variant-container">
                  <div v-if="!product.variants || product.variants.length === 0" class="no-data">
                    등록된 옵션 정보가 없습니다.
                  </div>

                  <table v-else class="variant-table">
                    <thead>
                      <tr>
                        <th class="vw-code">상품 코드</th>
                        <th class="vw-color">색상</th>
                        <th class="vw-stock">사이즈별 재고 수량</th>
                      </tr>
                    </thead>

                    <tbody>
                      <tr v-for="variant in product.variants" :key="variant._id">
                        <td><div class="code-column">{{ variant.variantCode }}</div></td>
                        <td class="color-cell">
                          <div class="color-wrapper">
                            <span class="color-dot" :style="{ backgroundColor: getColorValue(variant.color) }"></span>
                            <span class="color-name">{{ variant.color }}</span>
                          </div>
                        </td>
                        <td>
                          <div class="size-stock-chips">
                            <template v-if="variant.inventories && variant.inventories.length > 0">
                              <span v-for="inv in variant.inventories" :key="inv._id" 
                                    class="size-chip" :class="{ 'out-of-stock': inv.stockQuantity === 0 }">
                                <span class="size-label">{{ inv.size }}</span>
                                <strong class="stock-count">{{ inv.stockQuantity }}</strong>
                              </span>
                            </template>
                            <span v-else class="no-stock-text">재고 정보 없음</span>
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </td>
            </tr>

          </template>
        </tbody>
      </table>
    </div>
    <ProductEditModal :is-open="isModalOpen" :product="editingProduct" @close="isModalOpen = false" @update="onUpdateProduct"/>
  </div>
</template>

<style scoped>
/* 테이블 기본 레이아웃 */
.table-container { 
  width: 100%; 
  font-family:var(--font-body); 
}

.table-header-area { 
  display: flex; 
  align-items: flex-end; 
  gap: 8px; 
  margin-bottom: 12px; 
  padding-left: 4px; 
}

.table-title { 
  font-size: 18px; 
  font-weight: 700; 
  margin: 0; 
  color: #1e293b; 
}

.table-count { 
  font-size:17px; 
  color: #64748b; 
  font-weight: 500; 
}

.table-wrapper {
  background: #fff;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  overflow: hidden;
}

/* 메인 상품 테이블 (상위) */
.product-table { 
  width: 100%; 
  border-collapse: collapse; 
  table-layout: fixed;
}

/* 헤더 및 셀 공통 설정 */
.product-table th {
  padding: 14px 16px;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
  font-size:16px;
  font-weight: 600;
  color: #475569;
  text-align: center;
  text-transform: uppercase;
}

.product-table td { 
  padding: 12px 16px; 
  font-size:18px; 
  vertical-align: middle; 
  border-bottom: 1px solid #f1f5f9;
}

/* 컬럼 너비 설정 */
.w-name   { width: 30%; }
.w-price  { width: 20%; }
.w-status { width: 10%; }
.w-date   { width: 15%; }
.w-rating { width: 10%; }
.w-action { width: 15%; }

/* 행(Row) 스타일 */
.product-row.clickable { cursor: pointer; transition: background 0.2s; }
.product-row:hover { background-color: #f8fafc; }
.is-expanded { background-color: #f1f5f9; }

/* 메인 테이블 내부 요소 */
.name-wrapper-horizontal { display: flex; align-items: center; gap: 8px; }

/* 확장/축소 화살표 아이콘 */
.expand-icon {
  font-size:14px;
  color:#52627a;
  width: 14px;
  transition: transform 0.2s, color 0.2s;
}

.is-expanded .expand-icon { color: #2563eb; }
.ko-name { font-weight: 600; color: #1e293b; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.price-text { text-align: right; }
.price-wrapper {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
}

.price-text { text-align: right; }
.price-wrapper { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; }
.origin-price { font-size:15px; color:#52627a; text-decoration: line-through; }
.final-price { font-weight: 700; color: #0f172a; }
.discount-pill { background: #fee2e2; color: #dc2626; font-size:14px; padding: 1px 6px; border-radius: 4px; font-weight: 800; margin-top: 2px; }

/* 상태 배지 */
.status-badge { display: inline-flex; padding: 4px 8px; border-radius: 6px; font-size:15px; font-weight: 700; }
.status-badge.판매중 { background: #ecfdf5; color: #059669; border: 1px solid #10b98133; }
.status-badge.품절 { background: #fff1f2; color: #e11d48; border: 1px solid #f43f5e33; }
.status-badge.중단 { background: #f1f5f9; color: #64748b; border: 1px solid #cbd5e1; }

.date-text { color:#52627a; font-size:16px; text-align: center; }
.star-icon { color: #f59e0b; font-size:17px; letter-spacing: -1px; }
.text-center, .rating-text-center { text-align: center; }

/* 관리 버튼 */
.action-buttons { display: flex; justify-content: center; gap: 6px; }
.action-buttons button {
  padding: 6px 12px;
  border-radius: 6px;
  font-size:16px;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid transparent;
  transition: all 0.2s;
}
.btn-edit { background: #eff6ff; color: #2563eb; border-color: #dbeafe !important; }
.btn-edit:hover { background: #2563eb; color: #fff; }
.btn-delete { background: #fef2f2; color: #dc2626; border-color: #fee2e2 !important; }
.btn-delete:hover { background: #dc2626; color: #fff; }

/* 상세 옵션 영역 */
.detail-row td { padding: 0 !important; background-color: #f1f5f9; }
.variant-container {
  padding: 20px 30px;
  background-color: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
  animation: slideDown 0.25s ease-out;
}

.variant-table {
  width: 100%;
  table-layout: fixed;
  background: #ffffff;
  border-radius: 10px;
  border-collapse: separate;
  border-spacing: 0;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  border: 1px solid #e2e8f0;
  overflow: hidden;
}

/* 상세 테이블 너비 비율 */
.vw-code  { width: 22%; }
.vw-color { width: 15%; }
.vw-stock { width: 63%; }

.variant-table th {
  background: #f1f5f9;
  padding: 12px 16px;
  font-size:15px;
  font-weight: 700;
  color: #475569;
  text-align: center;
  border-bottom: 2px solid #e2e8f0;
  text-transform: uppercase;
}

.variant-table td {
  padding: 16px;
  font-size:17px;
  border-bottom: 1px solid #f1f5f9;
  color: #334155;
  vertical-align: middle;
}

.variant-table td:nth-child(2) { font-weight: 600; text-align: center; }
.variant-table tbody tr:last-child td { border-bottom: none; }
.variant-table tbody tr:hover { background-color: #fcfdfe; }

/* 상품 코드 박스 */
.code-column {
  font-family: 'JetBrains Mono', monospace;
  font-size:16px;
  color:#52627a;
  font-weight: 600;
  padding: 6px 10px;
  border-radius: 20px;
  display: block;
  text-align: center;
  border: 1px solid #cbd5e1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 색상 셀 정렬 */
.color-cell {
  text-align: center;
}

.color-wrapper {
  display: inline-flex;
  align-items: center;
  gap: 8px; /* 점과 텍스트 사이 간격 */
  justify-content: center;
}

/* 원형 색상 점 */
.color-dot {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 1px solid rgba(0, 0, 0, 0.1); 
  box-shadow: inset 0 1px 1px rgba(0,0,0,0.1);
  flex-shrink: 0;
}

.color-name {
  font-weight: 600;
  color: #475569;
}

/* 사이즈 + 재고 칩 컨테이너 */
.size-stock-chips { display: flex; gap: 8px; flex-wrap: wrap; margin: 10px; }
.size-chip {
  display: inline-flex;
  align-items: center;
  background: #ffffff;
  border: 1px solid #cbd5e1;
  border-radius: 20px;
  padding: 2px 4px 2px 10px;
  transition: all 0.2s ease;
}
.size-label { font-weight: 500; color: #64748b; margin-right: 6px; font-size:15px; }
.stock-count {
  background: #6a8fe7;
  color: #ffffff;
  padding: 4px 10px;
  border-radius: 15px;
  font-size:16px;
  min-width: 20px;
  text-align: center;
}

/* 품절 및 상태 */
.size-chip.out-of-stock { border-color: #fecaca; background-color: #fff1f2; }
.size-chip.out-of-stock .size-label { color: #f87171; }
.size-chip.out-of-stock .stock-count { background-color: #ef4444; color: #fff; }
.no-stock-text { font-size:16px; color:#52627a; font-style: italic; }

/* 애니메이션 */
@keyframes slideDown {
  from { opacity: 0; transform: translateY(-8px); }
  to { opacity: 1; transform: translateY(0); }
}

/* 로딩/빈 상태 행 */
.state-row td {
  padding: 60px 0;
  text-align: center;
  color:#52627a;
  background: #fff;
}

</style>
