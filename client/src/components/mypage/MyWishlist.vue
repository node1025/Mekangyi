<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import axios from 'axios';
import { imageUrl, money } from '../../utils/catalog';

interface WishItem {
  _id: string;
  productId: {
    _id: string;
    name: { ko: string };
    thumbnail?: string;
    salePrice?: number;
    finalPrice?: number;
    productCode?: string;
    status?: string;
  };
}

const router = useRouter();
const SERVER_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');
const items = ref<WishItem[]>([]);
const loading = ref(true);

const fetchWishlist = async () => {
  loading.value = true;
  try {
    const token = localStorage.getItem('accessToken');
    const response = await axios.get(`${SERVER_URL}/api/wishlist`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    items.value = response.data.items || [];
  } catch (error) {
    console.error('찜 목록 로드 실패', error);
    alert('찜 목록을 불러오지 못했습니다.');
  } finally {
    loading.value = false;
  }
};

const removeItem = async (productId: string) => {
  if (!confirm('찜 목록에서 삭제하시겠습니까?')) return;
  try {
    const token = localStorage.getItem('accessToken');
    await axios.delete(`${SERVER_URL}/api/wishlist/${productId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    items.value = items.value.filter((row) => row.productId._id !== productId);
  } catch (error) {
    alert('삭제에 실패했습니다.');
  }
};

const openProduct = (item: WishItem) => {
  const code = item.productId.productCode || item.productId._id;
  router.push(`/product/${code}`);
};

const unitPrice = (item: WishItem) =>
  Number(item.productId.salePrice ?? item.productId.finalPrice ?? 0);

onMounted(fetchWishlist);
</script>

<template>
  <section class="wish-section">
    <header class="wish-header">
      <h2>찜한 상품</h2>
      <p class="wish-guide">마음에 드는 굿즈를 모아두었다가 언제든 다시 만나 보세요.</p>
    </header>

    <div v-if="loading" class="wish-state" role="status">불러오는 중입니다…</div>

    <div v-else-if="items.length === 0" class="wish-state empty">
      찜한 상품이 없습니다. 상품 상세에서 <strong>찜하기</strong>를 눌러 보세요.
    </div>

    <ul v-else class="wish-list">
      <li v-for="row in items" :key="row._id" class="wish-card">
        <button type="button" class="wish-thumb" @click="openProduct(row)">
          <img
            :src="imageUrl(row.productId.thumbnail || '')"
            :alt="row.productId.name.ko"
            loading="lazy"
          />
        </button>
        <div class="wish-body">
          <button type="button" class="wish-name" @click="openProduct(row)">
            {{ row.productId.name.ko }}
          </button>
          <p class="wish-price">{{ money(unitPrice(row)) }}</p>
          <p v-if="row.productId.status === '품절'" class="wish-soldout">품절</p>
        </div>
        <button type="button" class="wish-remove" aria-label="찜 해제" @click="removeItem(row.productId._id)">
          ✕
        </button>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.wish-section {
  width: 100%;
}

.wish-header h2 {
  margin: 0 0 8px;
  font-size: 1.5rem;
  color: #122551;
}

.wish-guide {
  margin: 0 0 24px;
  color: #5c6478;
  font-size: 0.95rem;
}

.wish-state {
  padding: 48px 16px;
  text-align: center;
  color: #666;
  border: 1px dashed #d8dee8;
  border-radius: 8px;
}

.wish-state.empty strong {
  color: #122551;
}

.wish-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.wish-card {
  display: grid;
  grid-template-columns: 96px 1fr auto;
  gap: 16px;
  align-items: center;
  padding: 16px;
  border: 1px solid #e8ecf3;
  border-radius: 8px;
  background: #fff;
}

.wish-thumb {
  border: none;
  padding: 0;
  background: #f4f6fa;
  border-radius: 6px;
  overflow: hidden;
  cursor: pointer;
  width: 96px;
  height: 96px;
}

.wish-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.wish-body {
  text-align: left;
}

.wish-name {
  border: none;
  background: none;
  padding: 0;
  font-size: 1rem;
  font-weight: 600;
  color: #122551;
  cursor: pointer;
  text-align: left;
}

.wish-name:hover {
  text-decoration: underline;
}

.wish-price {
  margin: 8px 0 0;
  font-size: 1rem;
  color: #26332a;
}

.wish-soldout {
  margin: 4px 0 0;
  font-size: 0.85rem;
  color: #c62828;
}

.wish-remove {
  width: 36px;
  height: 36px;
  border: 1px solid #ddd;
  background: #fff;
  border-radius: 50%;
  cursor: pointer;
  color: #666;
  font-size: 1rem;
  line-height: 1;
}

.wish-remove:hover {
  background: #fef2f2;
  border-color: #f5c2c2;
  color: #b91c1c;
}
</style>
