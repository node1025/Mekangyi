<script setup lang="ts">
import { computed, ref, watch } from 'vue';

interface ProductInfo {
  productCode: string;
  name: { ko: string; en?: string };
  description?: string;
  material?: string;
  origin?: string;
  careInstructions?: string;
}
interface VariantInfo {
  color: string;
  images?: { thumbnail?: string; gallery?: string[] };
  inventory?: { size: string; stockQuantity: number }[];
  inventories?: { size: string; stockQuantity: number }[];
}
const props = defineProps<{
  product: ProductInfo;
  variants: VariantInfo[];
  variant: VariantInfo | null;
  serverUrl: string;
}>();
const failedImages = ref<string[]>([]);
watch(() => props.product.productCode, () => { failedImages.value = []; });
const colors = computed(() => [...new Set(props.variants.map(variant => variant.color).filter(Boolean))]);
const sizes = computed(() => [...new Set((props.variant?.inventory || props.variant?.inventories || []).map(item => String(item.size)))].sort((a, b) => (['S','M','L','XL'].includes(a)?['S','M','L','XL'].indexOf(a):999)-(['S','M','L','XL'].includes(b)?['S','M','L','XL'].indexOf(b):999)||a.localeCompare(b, 'ko', { numeric: true })));
const sizeSummary = computed(() => sizes.value.length ? sizes.value.join(' · ') : '선택 가능한 옵션이 아직 등록되지 않았습니다.');
const description = computed(() => {
  if (props.product.description?.trim()) return props.product.description;
  const material = props.product.material ? `${props.product.material} 소재의 ` : '';
  const details = [colors.value.length ? `${colors.value.join(', ')} 색상으로 만나보실 수 있습니다.` : ''];
  return `${material}${props.product.name.ko}입니다. ${details.filter(Boolean).join(' ')}`.trim();
});
const images = computed(() => {
  const gallery = props.variant?.images?.gallery?.filter(Boolean) || [];
  return [...new Set(gallery.length ? gallery : [props.variant?.images?.thumbnail].filter((image): image is string => Boolean(image)))];
});
const visibleImages = computed(() => images.value.filter(image => !failedImages.value.includes(image)));
const imageUrl = (image: string) => {
  const normalized = image.replace(/\\/g, '/');
  return /^https?:\/\//i.test(normalized) ? normalized : `${props.serverUrl}/${normalized.replace(/^\/+/, '')}`;
};
const care = computed(() => props.product.careInstructions?.trim() || '제품에 부착된 취급 안내를 먼저 확인해주세요. 소재별 관리 방법이 다르므로 세탁이나 세척 전 판매자에게 문의해주세요.');
</script>

<template>
  <article class="product-information" aria-label="제품 상세 정보">
    <header class="detail-intro">
      <h2>{{ product.name.ko }}</h2>
      <p v-if="product.name.en" class="detail-name-en">{{ product.name.en }}</p>
      <p class="detail-description">{{ description }}</p>
      <ul class="detail-facts" aria-label="상품 주요 정보">
        <li v-if="product.material"><span>소재</span>{{ product.material }}</li>
        <li v-if="product.origin"><span>원산지</span>{{ product.origin }}</li>
      </ul>
    </header>

    <section class="detail-gallery" aria-labelledby="detail-images-title">
      <div class="detail-section-heading">
        <h3 id="detail-images-title">자세히 보기</h3>
        <p v-if="variant?.color">선택 색상 · {{ variant.color }}</p>
      </div>
      <figure v-for="(image, index) in visibleImages" :key="image">
        <img :src="imageUrl(image)" :alt="`${product.name.ko} 상세 이미지 ${index + 1}`" loading="lazy" decoding="async" @error="failedImages.push(image)" />
      </figure>
      <p v-if="!visibleImages.length" class="detail-empty">등록된 상세 이미지가 없습니다. 아래 제품 정보를 확인해주세요.</p>
      <p class="detail-note">촬영 환경과 화면 설정에 따라 실제 색상과 차이가 있을 수 있습니다.</p>
    </section>

    <section class="detail-specs" aria-labelledby="detail-specs-title">
      <h3 id="detail-specs-title">제품 정보</h3>
      <dl>
        <div><dt>상품명</dt><dd>{{ product.name.ko }}</dd></div>
        <div><dt>제품 소재</dt><dd>{{ product.material || '미등록' }}</dd></div>
        <div><dt>원산지</dt><dd>{{ product.origin || '미등록' }}</dd></div>
        <div class="full-row"><dt>색상</dt><dd>{{ colors.join(' · ') || '미등록' }}</dd></div>
        <div class="full-row"><dt>옵션</dt><dd>{{ sizeSummary }}<small>선택한 색상의 등록 옵션입니다. 구매 가능한 옵션은 상단에서 확인해주세요.</small></dd></div>
      </dl>
    </section>

    <section class="detail-care" aria-labelledby="detail-care-title">
      <h3 id="detail-care-title">취급 및 관리 안내</h3>
      <p>{{ care }}</p>
    </section>
  </article>
</template>

<style scoped>
.product-information { width: 100%; max-width: 900px; margin: 0 auto; color: #20252c; }
.detail-intro { padding: 12px 0 48px; text-align: center; }
.detail-code { margin: 0 0 18px; font-size:16px; letter-spacing: .12em; color: #657080; }
h2 { margin: 0; font-size: clamp(23px, 3vw, 32px); line-height: 1.45; word-break: keep-all; }
.detail-name-en { margin: 12px 0 0; color:#52627a; font-size:18px; }
.detail-description { max-width: 650px; margin: 26px auto 0; font-size:19px; line-height: 1.95; white-space: pre-line; word-break: keep-all; overflow-wrap: anywhere; }
.detail-facts { display: flex; justify-content: center; flex-wrap: wrap; gap: 20px 36px; list-style: none; padding: 0; margin: 30px 0 0; font-size:18px; }
.detail-facts li { display: flex; gap: 10px; }
.detail-facts span { color:#52627a; }
h3 { font-size: 20px; margin: 0 0 22px; font-weight: 600; }
.detail-section-heading { display: flex; align-items: baseline; justify-content: space-between; gap: 15px; }
.detail-section-heading p { font-size:17px; color: #657080; margin: 0; }
figure { margin: 0 0 18px; background: #f8f8f8; }
figure img { display: block; width: 100%; height: auto; }
.detail-note { font-size:16px; color:#52627a; line-height: 1.7; }
.detail-empty { padding: 50px 20px; background: #f7f8fa; color: #657080; text-align: center; line-height: 1.8; }
.detail-specs { margin-top: 60px; }
dl { display: grid; grid-template-columns: minmax(0, 1fr); margin: 0; border-top: 2px solid #122551; }
dl > div { display: grid; grid-template-columns: 100px minmax(0, 1fr); gap: 16px; padding: 20px 12px; border-bottom: 1px solid #e7e9ed; font-size:18px; line-height: 1.7; }
dt { color: #657080; }
dd { margin: 0; overflow-wrap: anywhere; }
.full-row { grid-column: 1 / -1; }
small { display: block; color:#52627a; margin-top: 8px; font-size:16px; }
.detail-care { margin-top: 48px; padding: 28px; background: #f5f7f9; }
.detail-care p { margin: 0; font-size:18px; line-height: 1.9; white-space: pre-line; overflow-wrap: anywhere; }
@media (max-width: 600px) {
  .detail-intro { padding-bottom: 32px; }
  .detail-description { font-size:18px; }
  .detail-facts { gap: 14px 20px; font-size:17px; }
  dl { grid-template-columns: 1fr; }
  dl > div { grid-template-columns: 80px minmax(0, 1fr); gap: 10px; padding: 16px 4px; }
  .detail-section-heading { align-items: flex-start; }
  .detail-care { padding: 22px 18px; }
}
</style>
