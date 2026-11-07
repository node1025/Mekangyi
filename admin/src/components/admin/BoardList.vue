<script setup lang="ts">
const categoryLabels: Record<string, string> = { free: '자유게시판', qna: 'Q&A', notice: '공지사항', event: '이벤트' };
import { ref, onMounted } from 'vue';
import { boardApi } from '../../utils/boardApi';
import BoardWrite from '../admin/BoardWrite.vue';

// 게시글 데이터 타입 정의
interface Post {
  _id: string;
  title: string;
  category: string;
  author: {
    name: string;
    userId: string;
  };
  views: number;
  isPrivate: boolean;
  createdAt: string;
  updatedAt: string;
}

const posts = ref<Post[]>([]);      // 게시글 목록 상태
const category = ref('');           // 현재 선택된 카테고리 상태
const isModalOpen = ref(false);     // 글쓰기 모달 열림 상태

// 게시글 목록 조회 함수
const fetchPosts = async () => {
  try {
    const params: any = {};
    if (category.value) params.category = category.value;
    
    // API 호출
    const res = await boardApi.getPosts(params);

    // 백엔드 응답 구조({ posts: [], totalPages: ... })에 맞춰 할당
    if (res.data && res.data.posts) {
      posts.value = res.data.posts;
    }
  } catch (err: any) {
    // 에러 발생 시 상세 원인 파악을 위한 로그
    const errorMsg = err.response?.data?.message || '서버와 통신할 수 없습니다.';
    console.error('목록 로드 실패:', errorMsg);
    alert(errorMsg);
  }
};

// 글쓰기 완료 후 처리
const handleSaved = () => {
  isModalOpen.value = false;    // 글쓰기 모달 닫기
  fetchPosts();                 // 목록 새로고침
};

onMounted(fetchPosts);          // 컴포넌트 마운트 시 실행
</script>

<template>
  <div class="board-container">
    <div class="board-header">
      <div class="left-section">
        <select v-model="category" @change="fetchPosts" class="category-select">
          <option value="">전체 카테고리</option>
          <option value="notice">📢 공지사항</option>
          <option value="free">자유게시판</option>
          <option value="qna">❓ Q&A</option>
          <option value="event">🎈 이벤트</option>
        </select>
      </div>
      
      <div class="right-section">
        <button @click="isModalOpen = true" class="write-btn">
          글쓰기
        </button>
      </div>
    </div>

    <table class="board-table">
      <thead>
        <tr>
          <th>번호</th>
          <th>카테고리</th>
          <th>제목</th>
          <th>작성자</th>
          <th>조회수</th>
          <th>날짜</th>
        </tr>
      </thead>

      <tbody>
        <tr v-for="(post, index) in posts" :key="post._id">
          <td>{{ index + 1 }}</td>
          <td><span :class="['badge', post.category]">{{ categoryLabels[post.category] || post.category }}</span></td>
          <td class="title-cell">
            <router-link :to="`/board/${post._id}`">{{ post.title }}</router-link>
            <span v-if="post.isPrivate"> 🔒</span>
          </td>
          <td>{{ post.author?.name || '탈퇴한 회원' }}</td>
          <td>{{ post.views }}</td>
          <td>{{ new Date(post.createdAt).toLocaleDateString() }}</td>
        </tr>
      </tbody>
    </table>

    <Teleport to="body">
      <Transition name="modal-fade">
        <div v-if="isModalOpen" class="modal-overlay" @click.self="isModalOpen = false">
          <div class="modal-card">
            <header class="modal-header">
              <h3>게시글 작성</h3>

              <button class="close-icon-btn" @click="isModalOpen = false">&times;</button>
            </header>

            <div class="modal-body">
              <BoardWrite @saved="handleSaved" @close="isModalOpen = false" />
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

  </div>
</template>

<style scoped>
.badge.free, .category-badge.free { background: #edf5ef; color: #287444; }
/* 게시판 전체 레이아웃 */
.board-container { 
  max-width: 1100px; 
  margin: 60px auto; 
  padding: 0 20px;
  font-family:var(--font-body);
  color: #222;
}

/* 상단 헤더 */
.board-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-bottom: 30px;
  border-bottom: 2px solid #111;
  padding-bottom: 15px;
}

/* 카테고리 선택 드롭다운 */
.category-select {
  padding: 8px 12px;
  border: none;
  background: transparent;
  font-size:18px;
  font-weight: 600;
  cursor: pointer;
  color: #555;
}

/* 글쓰기 버튼 */
.write-btn {
  background: #2563eb;
  color: #fff;
  padding: 10px 28px;
  border: none;
  font-size:18px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s;
}

/* 게시글 목록 테이블 */
.board-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  margin-bottom: 50px;
}

.board-table th {
  padding: 15px;
  background-color: #f9f9f9;
  border-bottom: 1px solid #eee;
  font-size:17px;
  color: #888;
}

.board-table td {
  padding: 15px;
  border-bottom: 1px solid #f2f2f2;
  text-align: center;
  font-size:18px;
}

.title-cell {
  text-align: left !important;
  font-weight: 500;
}

.title-cell a {
  text-decoration: none;
  color: inherit;
}

.title-cell a:hover {
  text-decoration: underline;
}

/* 카테고리 배지 스타일 */
.badge {
  padding: 4px 10px;
  border-radius: 20px;
  font-size:15px;
  font-weight: 600;
}

.badge.notice { background: #fff1f1; color: #e74c3c; }
.badge.qna    { background: #f1f3ff; color: #3f51b5; }
.badge.event  { background: #fff9db; color: #f39c12; }

/* 모달 오버레이 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(4px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 2000;
}

.modal-card {
  background: #fff;
  width: 90%;
  max-width: 700px;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 15px 35px rgba(0, 0, 0, 0.2);
}

.modal-header {
  padding: 16px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #f0f0f0;
  background: #fafafa;
}

.modal-header h3 {
  margin: 0;
  font-size:19px;
  font-weight: 700;
  color: #333;
}

/* 모달 닫기 버튼 */
.close-icon-btn {
  background: none;
  border: none;
  font-size: 24px;
  color: #bbb;
  cursor: pointer;
  line-height: 1;
}

/* 모달 콘텐츠 영역 */
.modal-body {
  padding: 20px;
  max-height: 70vh;
  overflow-y: auto;
}

/* 모달 애니메이션 */
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.3s;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

.modal-fade-enter-active .modal-card {
  transition: transform 0.3s ease-out;
}

.modal-fade-enter-from .modal-card {
  transform: translateY(10px);
}
</style>
