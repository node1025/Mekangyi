<script setup lang="ts">
import { reactive, ref, onMounted } from 'vue';
import { boardApi } from '../../utils/boardApi';
import { validateImageFiles } from '../../utils/imageUploads';
import { useUserStore } from '../../utils/userStore';
const userStore = useUserStore();
const saving = ref(false);

const props = defineProps<{
  editData?: any; 
}>();

// 부모 컴포넌트로 이벤트 전달 정의
const emit = defineEmits(['saved', 'close']);

const imageFile = ref<File | null>(null);   // 업로드할 이미지 파일 상태

// 게시글 작성 폼 데이터
const form = reactive({
  title: '',
  content: '',
  category: userStore.isAdmin.value ? 'notice' : 'free',
  isPrivate: false
});

// 수정 모드일 때 데이터를 폼에 채워주는 함수
const setFormData = () => {
  if (props.editData) {
    form.title = props.editData.title;
    form.content = props.editData.content;
    form.category = props.editData.category;
    form.isPrivate = props.editData.isPrivate;
  }
};
onMounted(setFormData);


// 파일 선택 시 처리
const handleFileChange = (e: any) => {
  const file = e.target.files?.[0] as File | undefined;
  if (!file) return;
  const error = validateImageFiles([file], 1);
  if (error) { alert(error); e.target.value = ''; return; }
  imageFile.value = file;
};

// 게시글 등록 처리 함수
const handleSubmit = async () => {
  if (saving.value) return;
  if (!form.title.trim() || !form.content.trim()) return alert('제목과 내용을 입력해주세요.');
  const token = localStorage.getItem('accessToken');
  if (!token) return alert('로그인이 필요합니다.');

  // multipart/form-data 생성
  const formData = new FormData();
  formData.append('title', form.title);
  formData.append('content', form.content);
  formData.append('category', form.category);
  formData.append('isPrivate', String(form.isPrivate));

  // 이미지가 선택된 경우에만 추가
  if (imageFile.value) {
    formData.append('image', imageFile.value);
  }

  saving.value = true;
  try {
    if (props.editData) {
      // 수정 모드
      await boardApi.updatePost(props.editData._id, formData, token);
      alert('게시글이 수정되었습니다.');
    } else {
      // 등록 모드
      await boardApi.createPost(formData, token);
      alert('게시글이 등록되었습니다.');
    }
    emit('saved');
  } catch (err: any) {
    alert(err.response?.data?.message || '처리 실패');
  } finally {
    saving.value = false;
  }
};
</script>

<template>
  <div class="write-modal-inner">
    <form @submit.prevent="handleSubmit">
      <div class="form-header-row">
        <select aria-label="게시글 카테고리" v-model="form.category" class="category-select">
          <option value="free">자유게시판</option>
          <option v-if="userStore.isAdmin.value" value="event">이벤트</option>
          <option value="qna">Q&A</option>
          <option v-if="userStore.isAdmin.value" value="notice">공지사항</option>
        </select>

        <input 
          v-model="form.title" 
          type="text" maxlength="100" 
          aria-label="게시글 제목" placeholder="제목을 입력하세요" 
          class="title-input"
          required 
        />
      </div>

      <textarea 
        v-model="form.content" 
        aria-label="게시글 내용" placeholder="내용을 입력하세요" 
        rows="8" maxlength="10000" 
        required
      ></textarea>
      
      <div class="file-upload-zone">
        <i class="fas fa-image"></i>
        <label>이미지 첨부 (JPEG·PNG·WebP, 5MB 이하)</label>
        <input type="file" @change="handleFileChange" accept="image/jpeg,image/png,image/webp" />
      </div>

      <div class="form-footer">
        <div class="checkbox-group">
          <input type="checkbox" v-model="form.isPrivate" id="private" />
          <label for="private">🔒 비밀글로 작성</label>
        </div>

        <div class="btn-group">
          <button type="button" class="cancel-btn" @click="emit('close')">취소</button>
          <button type="submit" class="submit-btn" :disabled="saving">
            {{ saving ? '저장 중...' : props.editData ? '수정하기' : '등록하기' }}
          </button>
        </div>
      </div>
    </form>
  </div>
</template>

<style scoped>
/* 글쓰기 모달 스타일 */
   .write-modal-inner {
  width: 100%;
  background-color: #fff;
  display: flex;
  justify-content: center;
}

/* 폼 레이아웃 */
form {
  width: 92%;
  display: flex;
  flex-direction: column;
  gap: 18px;
  margin: 0 auto;
}

.form-header-row {
  display: flex;
  align-items: center;
  gap: 12px;
  border-bottom: 2px solid #f1f1f1;
  transition: border-color 0.3s;
}

.form-header-row:focus-within {
  border-bottom-color: #2563eb;
}

/* 카테고리 선택 */
.category-select {
  border: none;
  font-size:18px;
  font-weight: 600;
  color: #222;
  background: transparent;
  outline: none;
  cursor: pointer;
  white-space: nowrap;
}

/* 제목 */
.title-input {
  width: 100%;
  padding: 12px 0;
  border: none;
  font-size: 18px;
  font-weight: 700;
  outline: none;
  background: transparent;
}

/* 내용 */
textarea {
  width: 100%;
  box-sizing: border-box;
  padding: 15px;
  border: 1px solid #f1f5f9;
  border-radius: 10px;
  font-size:18px;
  line-height: 1.6;
  resize: none;
  background-color: #f8fafc;
  outline: none;
  min-height: 180px;
  transition: all 0.2s;
}

textarea:focus {
  border-color: #cbd5e1;
  background: #fff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.02);
}

/* 이미지 업로드 */
.file-upload-zone {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 15px;
  background: #f8f9fa;
  border-radius: 6px;
  font-size:17px;
  border: 1px dashed #e2e8f0;
}

.file-upload-zone i {
  color: #888;
}

.file-upload-zone label {
  font-weight: 600;
  color: #555;
  cursor: pointer;
}

/* 하단 영역 */
.form-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 5px;
}

/* 비공개 체크박스 */
.checkbox-group {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size:18px;
  color: #666;
  cursor: pointer;
}

/* 버튼 그룹 */
.btn-group {
  display: flex;
  gap: 8px;
}

.btn-group button {
  padding: 10px 20px;
  border-radius: 6px;
  font-size:18px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

/* 취소 버튼 */
.cancel-btn {
  background: #eff6ff;
  border: 1px solid #ddd;
  color: #666;
}

/* 등록 버튼 */
.submit-btn {
  background: #074CA1;
  border: none;
  color: #fff;
}

.submit-btn:hover {
  background: #063d82;
  transform: translateY(-2px);
}
.write-modal-inner form{width:100%;gap:20px}.form-header-row{gap:12px;flex-wrap:wrap}.category-select{border:1px solid #dbe3d1;background:#f7f9f3;color:#6d835c;font-size:15px;padding:12px}.title-input{border:1px solid #dbe3d1;padding:12px;color:#3b5730;font-size:17px;min-width:180px}.write-modal-inner textarea{border:1px solid #dbe3d1;border-radius:0;padding:16px;font-size:17px;line-height:1.8;resize:vertical;color:#465e3a}.file-upload-zone{background:#f7f9f3;border:1px dashed #cedbbc;border-radius:0;color:#83986d;font-size:14px;padding:18px}.file-upload-zone input{font-size:14px;max-width:100%}.checkbox-group{font-size:14px;color:#7f9270}.submit-btn{background:#2e4e35!important;border:0;border-radius:0;color:white}.cancel-btn{border-radius:0;border:1px solid #d1dcc4;background:white;color:#82966d}.btn-group button{font-size:15px;padding:11px 18px}.form-footer{flex-wrap:wrap;gap:20px}
</style>

