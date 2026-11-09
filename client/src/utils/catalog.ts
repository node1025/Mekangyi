import { onMounted, onUnmounted, ref } from 'vue';
import axios from 'axios';
export interface CatalogProduct {
  _id: string; productCode: string; name: { ko: string; en?: string }; category: string;
  basePrice: number; finalPrice: number; discountRate: number;
  priceMode?: 'regular' | 'always' | 'event';
  eventDiscountStart?: string | null;
  eventDiscountEnd?: string | null;
  effectiveDiscountRate?: number;
  isDiscountActive?: boolean;
  thumbnail: string; status: string; createdAt: string; updatedAt?: string; metrics?: { salesCount: number };
  variants: { color: string; inventories: { stockQuantity: number }[] }[];
}
export const money = (value: number) => new Intl.NumberFormat('ko-KR').format(value);

/** 관리자 폼 미리보기용: 서버 `productPricing`과 동일 규칙(100원 절사) */
function roundPriceTo100(value: number) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n / 100) * 100;
}

export function effectiveDiscountPreview(
  priceMode: 'regular' | 'always' | 'event',
  discountRate: number,
  eventStart?: string | null,
  eventEnd?: string | null,
  at: Date = new Date()
) {
  const rate = Math.min(100, Math.max(0, Number(discountRate) || 0));
  if (priceMode === 'regular') return 0;
  if (priceMode === 'always') return rate;
  if (priceMode === 'event') {
    if (rate <= 0) return 0;
    const now = at.getTime();
    const s = eventStart ? Date.parse(eventStart) : NaN;
    const e = eventEnd ? Date.parse(eventEnd) : NaN;
    if (!Number.isFinite(now) || !Number.isFinite(s) || !Number.isFinite(e) || e <= s) return 0;
    return now >= s && now <= e ? rate : 0;
  }
  return rate;
}

export function salePricePreview(
  basePrice: number,
  priceMode: 'regular' | 'always' | 'event',
  discountRate: number,
  eventStart?: string | null,
  eventEnd?: string | null
) {
  const base = Number(basePrice) || 0;
  const eff = effectiveDiscountPreview(priceMode, discountRate, eventStart, eventEnd);
  return roundPriceTo100(base * (1 - eff / 100));
}

export function toDatetimeLocalValue(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromDatetimeLocalValue(s: string): string | null {
  const t = s?.trim() ? Date.parse(s) : NaN;
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}
export function matchesProductSearch(
  product: Pick<CatalogProduct, 'name' | 'category' | 'productCode'> & { description?: string },
  query: string
) {
  const q = query.trim();
  if (!q) return false;
  const lower = q.toLowerCase();
  const fields = [product.name.ko, product.name.en || '', product.category, product.productCode, product.description || ''];
  return fields.some((text) => text.includes(q) || text.toLowerCase().includes(lower));
}

export function imageUrl(path: string, version?: string | number) {
  if (!path) return '/logo.svg';
  const normalized = path.replace(/\\/g, '/');
  const base = /^https?:\/\//.test(normalized)
    ? normalized
    : `${(import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '')}/${normalized.replace(/^\/+/, '')}`;
  const stamp = version ?? (normalized.includes('uploads/') ? import.meta.env.VITE_BUILD_STAMP : '');
  if (stamp == null || stamp === '') return base;
  return `${base}${base.includes('?') ? '&' : '?'}v=${encodeURIComponent(String(stamp))}`;
}
export function useCatalog() {
  const products = ref<CatalogProduct[]>([]);
  const loading = ref(true);
  const error = ref('');
  let sequence = 0;
  let controller: AbortController | undefined;
  let timer: ReturnType<typeof setInterval> | undefined;
  async function refresh() {
    const current = ++sequence;
    controller?.abort(); controller = new AbortController();
    try {
      const response = await axios.get('/api/products', { signal: controller.signal });
      if (current !== sequence) return;
      products.value = response.data.products.filter((p: CatalogProduct) => p.status !== '중단');
      error.value = '';
    } catch (cause) {
      if (current === sequence && !axios.isCancel(cause)) { products.value = []; error.value = '상품을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.'; }
    } finally { if (current === sequence) loading.value = false; }
  }
  function visibleRefresh() { if (document.visibilityState === 'visible') void refresh(); }
  function storageRefresh(event: StorageEvent) { if (event.key === 'products-updated') visibleRefresh(); }
  onMounted(() => { void refresh(); window.addEventListener('focus', visibleRefresh); window.addEventListener('products-updated', visibleRefresh); window.addEventListener('storage', storageRefresh); document.addEventListener('visibilitychange', visibleRefresh); timer = setInterval(visibleRefresh, 30000); });
  onUnmounted(() => { sequence++; controller?.abort(); clearInterval(timer); window.removeEventListener('focus', visibleRefresh); window.removeEventListener('products-updated', visibleRefresh); window.removeEventListener('storage', storageRefresh); document.removeEventListener('visibilitychange', visibleRefresh); });
  return { products, loading, error, refresh };
}
