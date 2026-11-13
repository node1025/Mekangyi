<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import axios from 'axios';
import { matchesProductSearch } from '../utils/catalog';
import ProductCard from '../components/product/ProductCard.vue';

const route = useRoute();
const router = useRouter();

const results = ref<any[]>([]);
const loading = ref(false);
const SERVER_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');

const queryText = computed(() =>
  typeof route.query.q === 'string' ? route.query.q.trim() : ''
);

const fetchSearchResults = async () => {
  const query = queryText.value;
  if (!query) {
    results.value = [];
    return;
  }

  loading.value = true;
  try {
    const response = await axios.get(`${SERVER_URL}/api/products`, {
      params: { search: query },
    });
    const products = (response.data.products || []).filter(
      (p: { status?: string }) => p.status !== '중단'
    );
    results.value = products.filter((p: Parameters<typeof matchesProductSearch>[0]) =>
      matchesProductSearch(p, query)
    );
  } catch (error) {
    console.error('검색 실패', error);
  } finally {
    loading.value = false;
  }
};

watch(() => route.query.q, fetchSearchResults);
onMounted(fetchSearchResults);
</script>

<template>
  <div class="search-page">
    <header class="search-head">
      <p class="search-kicker">SEARCH</p>
      <h1>
        <span class="query">{{ queryText || '—' }}</span>
        검색 결과
      </h1>
      <p v-if="!loading && queryText" class="search-meta">
        총 <strong>{{ results.length }}</strong>개의 굿즈
      </p>
    </header>

    <div v-if="!queryText" class="search-state">
      <p>검색어를 입력해 주세요.</p>
      <button type="button" @click="router.push('/category/best')">전체 굿즈 보기</button>
    </div>

    <div v-else-if="loading" class="search-state" role="status">검색 결과를 불러오는 중…</div>

    <div v-else-if="results.length === 0" class="search-state empty">
      <p>‘{{ queryText }}’에 맞는 굿즈가 없어요.</p>
      <span>다른 키워드로 다시 검색해 보세요.</span>
    </div>

    <div v-else class="search-grid">
      <ProductCard v-for="product in results" :key="product._id" :product="product" />
    </div>
  </div>
</template>

<style scoped>
.search-page {
  max-width: 1200px;
  margin: 0 auto;
  padding: 28px 5vw 64px;
  color: #122551;
}

.search-head {
  text-align: center;
  padding: 24px 16px 28px;
  margin-bottom: 28px;
  background: #f1f7ff;
  border-radius: 16px;
  border: 1px solid #e5edf9;
}

.search-kicker {
  margin: 0 0 10px;
  font-size: 12px;
  letter-spacing: 0.14em;
  color: #6886b1;
}

.search-head h1 {
  margin: 0;
  font-size: 26px;
  font-weight: 500;
  line-height: 1.45;
  letter-spacing: -0.02em;
}

.search-head .query {
  color: #3b78d9;
  font-weight: 600;
}

.search-meta {
  margin: 12px 0 0;
  font-size: 14px;
  color: #52627a;
}

.search-meta strong {
  color: #3e78cd;
  font-weight: 600;
}

.search-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 32px 20px;
}

.search-state {
  text-align: center;
  padding: 48px 16px;
  font-size: 15px;
  color: #52627a;
  background: #fff;
  border-radius: 12px;
  border: 1px dashed #dbe6f5;
}

.search-state.empty span {
  display: block;
  margin-top: 8px;
  font-size: 14px;
  color: #8a9bb5;
}

.search-state button {
  margin-top: 16px;
  padding: 10px 18px;
  font-size: 14px;
  color: #3b78d9;
  background: #fff;
  border: 1px solid #cadef9;
  border-radius: 8px;
  cursor: pointer;
}

.search-state button:hover {
  background: #f5f9ff;
}

@media (max-width: 900px) {
  .search-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 24px 16px;
  }
}

@media (max-width: 650px) {
  .search-page {
    padding: 20px 16px 48px;
  }

  .search-head {
    padding: 20px 12px 22px;
    margin-bottom: 20px;
  }

  .search-head h1 {
    font-size: 21px;
  }

  .search-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 22px 12px;
  }
}
</style>
