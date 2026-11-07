<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { salePricePreview, effectiveDiscountPreview, toDatetimeLocalValue, fromDatetimeLocalValue, type CatalogProduct } from '../../utils/catalog';

type PriceMode = 'regular' | 'always' | 'event';

// 부모로부터 받을 데이터
const props = defineProps<{
  isOpen: boolean;
  product: (CatalogProduct & {
    material?: string;
    careInstructions?: string;
    variants: any[];
  }) | null;
}>();

// 부모에게 보낼 이벤트
const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'update', updatedData: any): void;
}>();

const editForm = ref<any>(null);  // 모달에서 수정할 데이터를 임시로 보관

// 모달 열림 감지(watch)
watch(() => props.isOpen, (newVal) => {
  if (newVal && props.product) {
    const clone = JSON.parse(JSON.stringify(props.product));  // 깊은 복사
    
    // 필수 필드 기본값 보장
    const mode = (clone.priceMode || 'always') as PriceMode;
    editForm.value = {
      ...clone,
      priceMode: mode,
      eventDiscountLocalStart: mode === 'event' ? toDatetimeLocalValue(clone.eventDiscountStart) : '',
      eventDiscountLocalEnd: mode === 'event' ? toDatetimeLocalValue(clone.eventDiscountEnd) : '',
      material: clone.material || '',
      description: clone.description || '',
      careInstructions: clone.careInstructions || '',
      origin: clone.origin || '대한민국',
      status: clone.status || '판매중',
    };
  }
});

const previewEffectiveRate = computed(() => {
  const f = editForm.value;
  if (!f) return 0;
  return effectiveDiscountPreview(
    (f.priceMode || 'always') as PriceMode,
    Number(f.discountRate) || 0,
    fromDatetimeLocalValue(f.eventDiscountLocalStart || ''),
    fromDatetimeLocalValue(f.eventDiscountLocalEnd || '')
  );
});

const previewSalePrice = computed(() => {
  const f = editForm.value;
  if (!f) return 0;
  return salePricePreview(
    Number(f.basePrice) || 0,
    (f.priceMode || 'always') as PriceMode,
    Number(f.discountRate) || 0,
    fromDatetimeLocalValue(f.eventDiscountLocalStart || ''),
    fromDatetimeLocalValue(f.eventDiscountLocalEnd || '')
  );
});

// 변경사항 저장 함수
const handleSave = () => {
  // 유효성 검사
  if (editForm.value.basePrice < 0) return alert('가격은 0원 이상이어야 합니다.');
  if (editForm.value.discountRate < 0 || editForm.value.discountRate > 100) return alert('할인율은 0~100 사이여야 합니다.');
  const mode = (editForm.value.priceMode || 'always') as PriceMode;
  if (mode === 'event' && Number(editForm.value.discountRate) > 0) {
    const s = editForm.value.eventDiscountLocalStart?.trim();
    const e = editForm.value.eventDiscountLocalEnd?.trim();
    if (!s || !e) return alert('이벤트 모드에서는 할인 기간(시작·종료)을 입력해주세요.');
    if (Date.parse(e) <= Date.parse(s)) return alert('이벤트 종료 시각은 시작보다 이후여야 합니다.');
  }

  // 백엔드 전송용 payload 생성
  const payload = {
    _id: editForm.value._id,
    productData: {
      name: editForm.value.name,
      basePrice: Number(editForm.value.basePrice),
      discountRate: Number(editForm.value.discountRate),
      priceMode: mode,
      eventDiscountStart: mode === 'event' ? fromDatetimeLocalValue(editForm.value.eventDiscountLocalStart || '') : null,
      eventDiscountEnd: mode === 'event' ? fromDatetimeLocalValue(editForm.value.eventDiscountLocalEnd || '') : null,
      status: editForm.value.status,
      material: editForm.value.material,
      description: editForm.value.description,
      careInstructions: editForm.value.careInstructions,
      origin: editForm.value.origin,
      category: editForm.value.category,
      brand: editForm.value.brand
    },
    // 옵션 및 재고 정보 매핑
    variants: editForm.value.variants.map((v: any) => ({
      _id: v._id,
      variantCode: v.variantCode,
      color: v.color,
      inventories: v.inventories.map((inv: any) => ({
        _id: inv._id,     // 재고 ID
        size: inv.size,
        stockQuantity: Number(inv.stockQuantity),
        expectedUpdatedAt: inv.updatedAt
      }))
    }))
  };

  emit('update', payload);
};
</script>

<template>
  <Transition name="modal">
    <div v-if="isOpen" class="modal-overlay" @click.self="$emit('close')">
      <div class="modal-content large">
        <div class="modal-header">
          <div class="header-title-group">
            <h3>상품 정보 수정</h3>
            <span v-if="editForm" class="product-id-tag">ID: {{ editForm._id }}</span>
          </div>
          <button class="close-btn" @click="$emit('close')">&times;</button>
        </div>
        
        <div class="modal-body" v-if="editForm">
          <div class="section-title">판매 설정</div>
          
          <div class="form-row">
            <div class="form-group flex-1">
              <label>판매 상태</label>
              <div class="status-selector">
                <button v-for="status in ['판매중', '품절', '중단']" :key="status" type="button" :class="['status-opt', status, { active: editForm.status === status }]" @click="editForm.status = status" >
                  {{ status }}
                </button>
              </div>
            </div>
          </div>

          <div class="section-title">기본 정보</div>

          <div class="form-row">
            <div class="form-group flex-2">
              <label>상품명 (KO)</label>
              <input v-model="editForm.name.ko" type="text" placeholder="한글 상품명 입력" />
            </div>
            <div class="form-group flex-2">
              <label>상품명 (EN)</label>
              <input v-model="editForm.name.en" type="text" placeholder="영문 상품명 입력" />
            </div>
          </div>

          <div class="form-row">
            <div class="form-group flex-1">
              <label>정가 (Base Price)</label>
              <div class="input-wrapper">
                <input v-model.number="editForm.basePrice" type="number" min="0" />
                <span class="unit">원</span>
              </div>
            </div>
            <div class="form-group flex-1">
              <label>할인율 (설정값)</label>
              <div class="input-wrapper">
                <input v-model.number="editForm.discountRate" type="number" min="0" max="100" :disabled="editForm.priceMode === 'regular'" />
                <span class="unit">%</span>
              </div>
            </div>
            <div class="form-group flex-1">
              <label>최종 판매가 (미리보기)</label>
              <div class="final-price-preview">
                {{ previewSalePrice.toLocaleString() }}원
                <span v-if="previewEffectiveRate > 0" class="preview-note">(적용 {{ previewEffectiveRate }}%)</span>
              </div>
            </div>
          </div>

          <div class="form-row">
            <div class="form-group flex-1">
              <label>가격 적용 방식</label>
              <div class="status-selector price-mode-selector">
                <button type="button" :class="['status-opt', { active: editForm.priceMode === 'regular' }]" @click="editForm.priceMode = 'regular'">정가만</button>
                <button type="button" :class="['status-opt', { active: editForm.priceMode === 'always' }]" @click="editForm.priceMode = 'always'">상시 할인</button>
                <button type="button" :class="['status-opt', { active: editForm.priceMode === 'event' }]" @click="editForm.priceMode = 'event'">이벤트 기간만</button>
              </div>
              <p class="field-hint">정가만: 등록된 할인율은 표시용·보관용이며 판매가는 정가와 같습니다. 상시 할인: 항상 할인가. 이벤트: 아래 기간에만 할인가.</p>
            </div>
          </div>

          <div v-if="editForm.priceMode === 'event'" class="form-row">
            <div class="form-group flex-1">
              <label>이벤트 시작</label>
              <input v-model="editForm.eventDiscountLocalStart" type="datetime-local" />
            </div>
            <div class="form-group flex-1">
              <label>이벤트 종료</label>
              <input v-model="editForm.eventDiscountLocalEnd" type="datetime-local" />
            </div>
          </div>
          
          <div class="section-title">상품 상세 내용</div>
          <div class="detail-edit-fields">
            <label for="edit-product-description">상품 설명 (최대 4,000자)</label>
            <textarea id="edit-product-description" v-model="editForm.description" rows="5" maxlength="4000"></textarea>
            <label for="edit-product-care">취급 및 관리 안내</label>
            <textarea id="edit-product-care" v-model="editForm.careInstructions" rows="3"></textarea>
          </div>
          <div class="section-title">옵션 및 사이즈별 재고</div>
          <div class="variant-edit-list">
            <div v-for="variant in editForm.variants" :key="variant._id" class="variant-edit-card">
              <div class="variant-header">
                <div class="color-info">
                  <span class="color-dot" :style="{ backgroundColor: variant.color }"></span>
                  <strong>{{ variant.color }}</strong>
                  <span class="v-code">{{ variant.variantCode || variant.productCode }}</span>
                </div>
              </div>
              
              <div class="size-stock-grid">
                <div v-for="inv in variant.inventories" :key="inv._id" class="size-input-box">
                  <span class="size-name">{{ inv.size }}</span>
                  <input v-model.number="inv.stockQuantity" type="number" min="0" :class="{ 'zero-stock': inv.stockQuantity === 0 }" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn-cancel" @click="$emit('close')">취소</button>
          <button class="btn-save" @click="handleSave">저장</button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.detail-edit-fields { display: grid; gap: 10px; margin-bottom: 24px; }
.detail-edit-fields label { font-size:18px; font-weight: 600; }
.detail-edit-fields textarea { box-sizing: border-box; width: 100%; padding: 12px; border: 1px solid #d8dee8; border-radius: 6px; font: inherit; resize: vertical; }
/* 모달 레이아웃  */
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(15, 23, 42, 0.6);
  backdrop-filter: blur(8px);
}

/* 실제 모달 박스 */
.modal-content {
  display: flex;
  flex-direction: column;
  width: 800px; /* .large 사이즈 통합 */
  max-height: 90vh;
  background: #f8fafc;
  border-radius: 24px;
  border: 1px solid rgba(255, 255, 255, 0.3);
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  overflow: hidden;
}

/* 모달 구조 레이아웃 */
.modal-header, .modal-footer {
  padding: 16px 32px;
  background: #fff;
  display: flex;
  align-items: center;
}

/* 상단 헤더 */
.modal-header {
  justify-content: space-between;
  border-bottom: 1px solid #f1f5f9;
}

/* 모달 제목 */
.modal-header h3 {
  margin: 0;
  font-size: 1.4rem;
  color: #0f172a;
  font-weight: 800;
}

/* 모달 본문 */
.modal-body {
  padding: 32px;
  background: #f8fafc;
  overflow-y: auto;
  scrollbar-width: thin;
}

/* 하단 액션 영역 */
.modal-footer {
  justify-content: flex-end;
  gap: 12px;
  background: #f8fafc;
}

/* 입력 필드 및 라벨 스타일 */
.form-row {
  display: flex;
  gap: 16px;
  margin-bottom: 20px;
}

.form-group {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* 필드 라벨 */
label {
  font-size:17px;
  font-weight: 600;
  color: #64748b;
}

/* 공통 입력 요소 스타일 */
input, select, textarea {
  padding: 10px 14px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size:18px;
  color: #1e293b;
  transition: all 0.2s;
  background: #fff;
}

input:focus, select:focus, textarea:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

/* 단위가 있는 입력 필드 */
.input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.input-wrapper input { width: 100%; padding-right: 35px; }

/* 우측 단위 표시 (원, 개, cm 등) */
.unit {
  position: absolute;
  right: 12px;
  font-size:17px;
  color:#52627a;
}

/* 정보 그룹화 */
.section-title { 
  margin: 24px 0 12px;
  padding-bottom: 8px; 
  border-bottom: 2px solid #f1f5f9;
  color: #1e293b;
  font-weight: 700; 
}

/* 옵션/변형 카드 */
.variant-edit-card {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 12px;
}

.variant-info {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  font-size:18px;
}

/* 상품 코드 */
.product-code { color:#52627a; font-size:16px; }

/* 사이즈별 재고 입력 UI */
.size-stock-chips { display: flex; gap: 10px; flex-wrap: wrap; }

/* 개별 사이즈 칩 */
.size-chip {
  display: inline-flex;
  align-items: center;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 20px;
  padding-left: 12px;
  transition: all 0.2s;
}

.size-chip:focus-within {
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

/* 사이즈 텍스트 */
.size-label { font-weight: 700; color: #64748b; margin-right: 8px; font-size:16px; }

/* 재고 수량 입력 */
.stock-count-input {
  width: 45px;
  padding: 4px 8px;
  background: #6a8fe7;
  color: #fff;
  border: none;
  border-radius: 15px;
  text-align: center;
  font-weight: 600;
}

.stock-count-input:focus { background: #2563eb; }

/* 버튼 스타일 */
button {
  padding: 10px 18px;
  border-radius: 8px;
  font-size:18px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid transparent;
}

.close-btn { background: none; font-size: 24px; color:#52627a; }

.btn-cancel { background: #eff6ff; border-color: #e2e8f0; color: #2563eb; }
.btn-cancel:hover { background: #dbeafe; }

.btn-save { background: #074CA1; color: #fff; }
.btn-save:hover { background: #063d82; }

/* 모달 등장/퇴장 애니메이션 */
.modal-enter-active, .modal-leave-active { transition: opacity 0.3s; }
.modal-enter-from, .modal-leave-to { opacity: 0; }

/* Chrome, Safari, Edge에서 숫자 화살표 제거 */
input::-webkit-outer-spin-button,
input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
.header-title-group { display: flex; align-items: center; gap: 12px; }
.product-id-tag { font-size:15px; color:#52627a; background: #f1f5f9; padding: 2px 8px; border-radius: 4px; }

/* 상태 선택기 */
.status-selector { display: flex; gap: 8px; }
.price-mode-selector { flex-wrap: wrap; }
.field-hint { margin: 8px 0 0; font-size:16px; color: #64748b; line-height: 1.5; }
.preview-note { margin-left: 8px; font-size:17px; color: #64748b; font-weight: 500; }
.status-opt { 
  flex: 1; padding: 8px; border: 1px solid #e2e8f0; background: #fff; 
  color: #64748b; font-size:16px; border-radius: 6px; cursor: pointer;
}
.status-opt.active.판매중 { background: #ecfdf5; color: #059669; border-color: #10b981; }
.status-opt.active.품절 { background: #fff1f2; color: #e11d48; border-color: #f43f5e; }
.status-opt.active.중단 { background: #f1f5f9; color: #475569; border-color: #94a3b8; }

/* 최종가 미리보기 */
.final-price-preview {
  padding: 10px; background: #f1f5f9; border-radius: 8px;
  text-align: right; font-weight: 700; color: #1e293b;
}

/* 재고 그리드 */
.size-stock-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
  gap: 10px;
}

.size-input-box {
  display: flex; flex-direction: column; gap: 4px;
  background: #f8fafc; padding: 8px; border-radius: 8px; border: 1px solid #e2e8f0;
}

.size-name { font-size:15px; font-weight: 700; color: #64748b; text-align: center; }

.size-input-box input {
  width: 100%; border: none; background: #fff; text-align: center;
  font-weight: 700; padding: 4px; border-radius: 4px;
}

.size-input-box input.zero-stock { color: #ef4444; }

.variant-header { margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px dashed #e2e8f0; }
.color-info { display: flex; align-items: center; gap: 8px; }
.color-dot { width: 12px; height: 12px; border-radius: 50%; border: 1px solid rgba(0,0,0,0.1); }
.v-code { font-size:15px; color:#52627a; }

.flex-2 { flex: 2; }
</style>
