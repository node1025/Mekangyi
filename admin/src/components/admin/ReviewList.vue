<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import axios from 'axios';

interface Review {
  _id: string;
  userId: { name: string; email: string };
  productId: { 
    name: { ko: string; [key: string]: string }
  };
  rating: number;
  content: string;
  images: string[];
  createdAt: string;
}
const SERVER_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');

const allReviews = ref<Review[]>([]);
const selectedRating = ref<number | string>('all');
const loading = ref(true);

const fetchAllReviews = async () => {
  try {
    const token = localStorage.getItem('accessToken');
    const response = await axios.get(`${SERVER_URL}/api/review/admin/all`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (response.data.success) {
      allReviews.value = response.data.reviews;
    }
  } catch (error) {
    console.error('리뷰 목록 로드 실패:', error);
  } finally {
    loading.value = false;
  }
};

const cleanProductName = (name: string | undefined) => {
  if (!name) return '상품 정보 없음';
  return name.replace('부캉이 시그니처', '').trim();
};

const filteredReviews = computed(() => {
  if (selectedRating.value === 'all') return allReviews.value;
  return allReviews.value.filter(review => review.rating === Number(selectedRating.value));
});

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('ko-KR');
};

const deleteReview = async (reviewId: string) => {
  if (!confirm('이 리뷰를 삭제하시겠습니까?')) return;
  try {
    const token = localStorage.getItem('accessToken');
    await axios.delete(`${SERVER_URL}/api/review/${reviewId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    allReviews.value = allReviews.value.filter(r => r._id !== reviewId);
    alert('삭제되었습니다.');
  } catch (error) {
    alert('삭제 실패');
  }
};

onMounted(fetchAllReviews);
</script>

<template>
  <div class="table-container">
    <div class="table-header-area">
      <h3 class="table-title">리뷰 관리</h3>
      <span class="table-count">전체 {{ filteredReviews.length }}건</span>
      
      <div class="header-controls">
        <select v-model="selectedRating" class="status-select">
          <option value="all">전체 별점</option>
          <option v-for="n in [5,4,3,2,1]" :key="n" :value="n">⭐ {{ n }}점</option>
        </select>
        <button class="btn-refresh" @click="fetchAllReviews">새로고침 🔄</button>
      </div>
    </div>

    <div v-if="loading" class="loading-state">데이터를 불러오는 중입니다...</div>

    <div v-else class="table-wrapper">
      <table class="admin-table">
        <thead>
          <tr>
            <th class="w-date">작성일</th>
            <th class="w-product">상품명</th>
            <th class="w-user">작성자</th>
            <th class="w-rating">별점</th>
            <th class="w-content">리뷰 내용</th>
            <th class="w-attach">첨부</th>
            <th class="w-action">관리</th>
          </tr>
        </thead>

        <tbody>
          <tr v-if="filteredReviews.length === 0">
            <td colspan="7" class="empty-row">등록된 리뷰가 없습니다.</td>
          </tr>
          
          <tr v-for="review in filteredReviews" :key="review._id" class="order-row">
            <td data-label="작성일" class="date-text">{{ formatDate(review.createdAt) }}</td>
            <td data-label="상품명" class="product-name">{{ cleanProductName(review.productId?.name?.ko) }}</td>
            <td data-label="작성자" class="user-info">
              <div class="user-wrapper">
                <span class="user-name">{{ review.userId?.name }}</span>
                <span class="user-email">{{ review.userId?.email }}</span>
              </div>
            </td>
            <td data-label="별점" class="text-center">
              <span class="rating-badge">⭐ {{ review.rating }}</span>
            </td>
            <td data-label="리뷰 내용" class="content-cell">
              <div class="content-text">{{ review.content }}</div>
            </td>
            <td data-label="첨부" class="text-center">
              <span v-if="review.images.length > 0" class="image-count-badge">📷 {{ review.images.length }}</span>
              <span v-else class="no-image">-</span>
            </td>
            <td data-label="관리" class="action-column">
              <button class="btn-delete" @click="deleteReview(review._id)">삭제</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.table-container { 
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  font-family:var(--font-body); 
  padding: 20px;
}

.table-header-area { 
  display: flex; 
  align-items: center; 
  gap: 12px; 
  margin-bottom: 20px; 
}

.table-title { 
  font-size: 20px; 
  font-weight: 700; 
  color: #1e293b; 
  margin: 0; 
}

.table-count { 
  font-size:18px; 
  color: #64748b; 
  font-weight: 500; 
  flex-grow: 1; 
}

.header-controls {
  display: flex;
  gap: 10px;
  align-items: center;
}

/* 버튼 및 셀렉트 스타일 */
.btn-refresh {
  padding: 8px 16px;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  cursor: pointer;
  font-size:17px;
  transition: all 0.2s;
}

.status-select {
  padding: 8px;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  font-size:17px;
  color: #475569;
  outline: none;
  background-color: white;
}

/* 테이블 래퍼 */
.table-wrapper {
  background: #fff;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  overflow: hidden;
}

.admin-table { 
  width: 100%; 
  border-collapse: collapse; 
  table-layout: fixed; 
}

.admin-table th {
  padding: 14px 16px;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
  font-size:16px;
  font-weight: 600;
  color: #475569;
  text-align: center;
}

.admin-table td { 
  padding: 16px; 
  font-size:18px; 
  vertical-align: middle; 
  border-bottom: 1px solid #f1f5f9;
}

/* 컬럼 너비 설정 */
.w-date { width: 10%; }
.w-product { width: 15%; }
.w-user { width: 18%; }
.w-rating { width: 8%; }
.w-content { width: 33%; }
.w-attach { width: 8%; }
.w-action { width: 8%; }

/* 데이터 텍스트 스타일 */
.date-text { color: #64748b; font-size:17px; text-align: center; }
.product-name { font-weight: 600; color: #1e293b; }
.text-center { text-align: center; }

.user-wrapper { display: flex; flex-direction: column; gap: 2px; }
.user-name { font-weight: 600; color: #1e293b; }
.user-email { font-size:16px; color:#52627a; }

.rating-badge {
  font-weight: 700;
  color: #f59e0b;
}

.content-text {
  line-height: 1.5;
  color: #475569;
  overflow: hidden;
}

.image-count-badge {
  background: #eff6ff;
  color: #2563eb;
  padding: 4px 8px;
  border-radius: 6px;
  font-size:15px;
  font-weight: 700;
}

.no-image { color:#52627a; }

.btn-delete {
  padding: 6px 12px;
  background: #fff1f2;
  color: #e11d48;
  border: 1px solid #ffe4e6;
  border-radius: 6px;
  font-size:16px;
  font-weight: 600;
  cursor: pointer;
  transition: 0.2s;
}

.btn-delete:hover {
  background: #e11d48;
  color: #fff;
}

.loading-state, .empty-row {
  padding: 40px;
  text-align: center;
  color:#52627a;
}

</style>