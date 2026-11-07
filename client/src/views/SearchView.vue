<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import axios from 'axios';

const route = useRoute();
const router = useRouter();

const results = ref<any[]>([]);
const loading = ref(false);
const SERVER_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');

const getImageUrl = (path: string) => {
  if (!path) return '/default-image.png';
  return path.replace(/\\/g, '/').startsWith('http') 
    ? path 
    : `${SERVER_URL}/${path.replace(/\\/g, '/')}`;
};

const fetchSearchResults = async () => {
  const query = route.query.q;
  if (!query) {
    results.value = [];
    return;
  }

  loading.value = true;
  try {
    const response = await axios.get(`${SERVER_URL}/api/products`, {
      params: { search: query }
    });
    results.value = response.data.products || [];
  } catch (error) {
    console.error("검색 실패", error);
  } finally {
    loading.value = false;
  }
};

const goToDetail = (productCode: string) => {
  router.push(`/product/${productCode}`);
};

watch(() => route.query.q, fetchSearchResults);
onMounted(fetchSearchResults);
</script>

<template>
  <div class="search-page">
    <div class="search-header">
      <h2>'{{ route.query.q }}' 검색 결과 <span class="count">({{ results.length }})</span></h2>
    </div>
    
    <div v-if="loading" class="state-msg">검색 결과 로딩 중...</div>
    <div v-else-if="results.length === 0" class="state-msg empty">
      <p>검색 결과가 없습니다.</p>
      <span>다른 검색어를 입력해 보세요.</span>
    </div>
    
    <div v-else class="product-grid">
      <div 
        v-for="product in results" 
        :key="product._id" 
        class="product-card"
        @click="goToDetail(product.productCode)"
      >
        <div class="img-box">
          <img :src="getImageUrl(product.thumbnail)" :alt="product.name.ko" />
        </div>
        <div class="info-box">
          <p class="name">{{ product.name.ko }}</p>
          <p class="price">{{ product.finalPrice?.toLocaleString() }}원</p>
        </div>
      </div>
    </div>
  </div>
</template>