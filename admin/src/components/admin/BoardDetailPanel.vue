<script setup lang="ts">
import { ref, watch } from 'vue';
import { boardApi } from '../../utils/boardApi';
import { imageUrl } from '../../utils/catalog';
import BoardWrite from './BoardWrite.vue';

const categoryLabels: Record<string, string> = {
  free: '자유게시판',
  qna: 'Q&A',
  notice: '공지사항',
  event: '이벤트',
};

const props = defineProps<{ postId: string }>();
const emit = defineEmits<{ close: []; changed: [] }>();

const post = ref<any>(null);
const loading = ref(true);
const error = ref('');
const editing = ref(false);
const deleting = ref(false);

const formatDate = (value: string) =>
  new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));

async function load() {
  loading.value = true;
  error.value = '';
  post.value = null;
  try {
    const { data } = await boardApi.getPost(props.postId);
    post.value = data.post;
  } catch (e: any) {
    error.value = e.response?.data?.message || '게시글을 불러오지 못했습니다.';
  } finally {
    loading.value = false;
  }
}

async function remove() {
  if (deleting.value || !post.value) return;
  if (!confirm('이 게시글을 삭제할까요? 삭제 후 복구할 수 없습니다.')) return;
  deleting.value = true;
  try {
    const token = localStorage.getItem('accessToken') || '';
    await boardApi.deletePost(post.value._id, token);
    emit('changed');
    emit('close');
  } catch (e: any) {
    alert(e.response?.data?.message || '삭제하지 못했습니다.');
  } finally {
    deleting.value = false;
  }
}

function onSaved() {
  editing.value = false;
  void load();
  emit('changed');
}

watch(() => props.postId, load, { immediate: true });
</script>

<template>
  <div class="detail-panel">
    <div v-if="loading" class="detail-state">게시글을 불러오는 중…</div>
    <div v-else-if="error" class="detail-state error">
      <p>{{ error }}</p>
      <button type="button" class="btn subtle" @click="load">다시 시도</button>
    </div>

    <BoardWrite
      v-else-if="editing && post"
      :edit-data="post"
      @saved="onSaved"
      @close="editing = false"
    />

    <template v-else-if="post">
      <header class="detail-head">
        <span :class="['badge', post.category]">{{ categoryLabels[post.category] || post.category }}</span>
        <h2>{{ post.title }}</h2>
        <div class="detail-meta">
          <span>{{ post.author?.name || '탈퇴한 회원' }}</span>
          <time :datetime="post.createdAt">{{ formatDate(post.createdAt) }}</time>
          <span>조회 {{ post.views }}</span>
          <span v-if="post.isPrivate" class="private-tag">비밀글</span>
        </div>
      </header>

      <div class="detail-body">
        <img
          v-if="post.imageUrl"
          :src="imageUrl(post.imageUrl)"
          alt="게시글 첨부 이미지"
          loading="lazy"
        />
        <p>{{ post.content }}</p>
      </div>

      <footer class="detail-actions">
        <button type="button" class="btn subtle" @click="emit('close')">목록으로</button>
        <div class="detail-actions-end">
          <button type="button" class="btn primary" @click="editing = true">수정</button>
          <button type="button" class="btn danger" :disabled="deleting" @click="remove">
            {{ deleting ? '삭제 중…' : '삭제' }}
          </button>
        </div>
      </footer>
    </template>
  </div>
</template>

<style scoped>
.detail-panel {
  font-family: var(--font-body);
  color: #1f2937;
}

.detail-state {
  text-align: center;
  padding: 40px 16px;
  font-size: 15px;
  color: #6b7280;
}

.detail-state.error {
  color: #b91c1c;
}

.detail-head {
  padding-bottom: 16px;
  border-bottom: 1px solid #eef0f3;
  margin-bottom: 20px;
}

.detail-head h2 {
  margin: 12px 0 10px;
  font-size: 22px;
  font-weight: 700;
  line-height: 1.45;
  color: #111827;
  overflow-wrap: anywhere;
}

.detail-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 16px;
  font-size: 14px;
  color: #6b7280;
}

.private-tag {
  padding: 2px 8px;
  border-radius: 6px;
  background: #fef3c7;
  color: #92400e;
  font-size: 12px;
  font-weight: 600;
}

.badge {
  display: inline-block;
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 600;
}

.badge.notice {
  background: #fff1f1;
  color: #e74c3c;
}
.badge.free {
  background: #edf5ef;
  color: #287444;
}
.badge.qna {
  background: #f1f3ff;
  color: #3f51b5;
}
.badge.event {
  background: #fff9db;
  color: #f39c12;
}

.detail-body {
  min-height: 120px;
  padding-bottom: 20px;
  border-bottom: 1px solid #eef0f3;
}

.detail-body img {
  display: block;
  max-width: 100%;
  max-height: 360px;
  object-fit: contain;
  margin: 0 auto 20px;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
}

.detail-body p {
  margin: 0;
  font-size: 16px;
  line-height: 1.75;
  color: #374151;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.detail-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding-top: 18px;
  flex-wrap: wrap;
}

.detail-actions-end {
  display: flex;
  gap: 8px;
}

.btn {
  padding: 10px 16px;
  border-radius: 8px;
  font-size: 15px;
  font-weight: 600;
  border: none;
  cursor: pointer;
}

.btn.subtle {
  background: #f3f4f6;
  color: #374151;
}

.btn.primary {
  background: #2563eb;
  color: #fff;
}

.btn.danger {
  background: #dc2626;
  color: #fff;
}

.btn:disabled {
  opacity: 0.6;
  cursor: wait;
}
</style>
