<script setup lang="ts">
import { computed } from 'vue';
import { imageUrl, money, type CatalogProduct } from '../../utils/catalog';
const props = defineProps<{ product: CatalogProduct; index?: number }>();
const displayDiscount = computed(() => props.product.effectiveDiscountRate ?? props.product.discountRate ?? 0);
const showSale = computed(() => props.product.isDiscountActive ?? props.product.basePrice > props.product.finalPrice);
</script>
<template>
  <RouterLink :to="`/product/${product.productCode}`" class="shop-card" :data-product-code="product.productCode">
    <div class="shop-card-image"><img :src="imageUrl(product.thumbnail)" :alt="product.name.ko" loading="lazy" /><span v-if="index !== undefined" class="card-rank">{{ String(index + 1).padStart(2, '0') }}</span><span class="card-action" aria-hidden="true">자세히 보기 ↗</span><span v-if="product.status === '품절'" class="stock-label">SOLD OUT</span></div>
    <div class="card-meta"><span>{{ product.category }}</span></div>
    <h3>{{ product.name.ko }}</h3>
    <p class="card-price"><span v-if="showSale && displayDiscount > 0" class="sale-rate">{{ displayDiscount }}%</span><strong>{{ money(product.finalPrice) }}원</strong><del v-if="showSale">{{ money(product.basePrice) }}원</del></p>
  </RouterLink>
</template>
<style scoped>
.shop-card{display:block;text-decoration:none;color:inherit;min-width:0}.shop-card-image{aspect-ratio:4/5;background:#f2f1ee;position:relative;overflow:hidden}.shop-card-image img{width:100%;height:100%;object-fit:cover;transition:transform .6s}.shop-card:hover img{transform:scale(1.045)}.card-rank{position:absolute;top:15px;left:16px;font:italic 24px Georgia,serif}.card-action{position:absolute;bottom:0;left:0;right:0;background:#243d31ed;color:white;padding:13px;text-align:center;font-size:16px;transform:translateY(100%);transition:transform .25s}.shop-card:hover .card-action,.shop-card:focus-visible .card-action{transform:translateY(0)}.card-meta{display:flex;justify-content:space-between;font-size:14px;letter-spacing:1px;color:#777;margin-top:20px}.shop-card h3{font-size:18px;line-height:1.6;font-weight:500;margin:9px 0}.card-price{display:flex;flex-wrap:wrap;gap:9px;align-items:center;font-size:18px;margin:0}.sale-rate{color:#a14d37;font-weight:600}.card-price del{color:#999;font-size:16px}.stock-label{position:absolute;inset:auto 12px 12px auto;padding:7px 10px;background:white;font-size:14px;letter-spacing:1px}@media(max-width:600px){.card-meta{font-size:13px;margin-top:13px}.shop-card h3{font-size:16px}.card-price{font-size:16px;gap:6px}.card-price del{font-size:14px}}
.shop-card-image{aspect-ratio:1;border-radius:18px;background:#f5f8fe;border:1px solid #edf2fa}.shop-card-image img{object-fit:contain;padding:16px;mix-blend-mode:multiply}.shop-card:hover img{transform:scale(1.035)}.card-action{background:#3975dcf0;font-size:15px;padding:11px}.card-rank{font-family:Arial,sans-serif;color:#52627a;font-size:20px;font-style:normal;font-weight:700}.card-meta{margin-top:18px;color:#52627a;font-size:13px;letter-spacing:.7px}.shop-card h3{font-size:18px;color:#244b7c;margin:9px 0 10px;font-weight:500}.card-price{font-size:18px;color:#254c7d}.sale-rate{color:#ee8d82}.card-price del{color:#52627a;font-size:15px}.stock-label{color:#6180a8;border-radius:6px}@media(max-width:650px){.shop-card-image{border-radius:13px}.shop-card-image img{padding:10px}.card-meta{font-size:12px;margin-top:12px;letter-spacing:0}.shop-card h3{font-size:16px}.card-price{font-size:16px}.card-price del{font-size:14px}}
</style>
