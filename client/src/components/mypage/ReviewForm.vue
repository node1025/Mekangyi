<script setup lang="ts">
import { ref } from 'vue';
import axios from 'axios';
import { validateImageFiles } from '../../utils/imageUploads';

const props = defineProps<{ // 부모 컴포넌트로부터 받는 props
  orderId: string;
  productId: string;
}>();

// 부모 컴포넌트로 이벤트 전달
const emit = defineEmits(['close', 'submitted']);
const SERVER_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');

const rating = ref(5);  // 별점 상태
const content = ref('');  // 리뷰 내용 상태
const images = ref<File[]>([]); // 업로드할 이미지 파일 상태
const imagePreviews = ref<string[]>([]);  // 미리보기용 이미지 데이터 URL

// 이미지 업로드 처리 함수
const handleImageUpload = (event: Event) => {
  const target = event.target as HTMLInputElement;
  if (target.files) {
    const files = Array.from(target.files);
    if (images.value.length + files.length > 3) { // 최대 업로드 수 제한
      alert('이미지는 최대 3장까지 업로드 가능합니다.');
      return;
    }
    const error = validateImageFiles([...images.value, ...files], 3);
    if (error) { alert(error); target.value = ''; return; }
    images.value.push(...files);  // 이미지 파일 저장
    files.forEach(file => {       // 미리보기 생성
      const reader = new FileReader();
      reader.onload = (e) => imagePreviews.value.push(e.target?.result as string);
      reader.readAsDataURL(file);
    });
  }
};

// 업로드한 이미지 제거
const removeImage = (index: number) => {
  images.value.splice(index, 1);
  imagePreviews.value.splice(index, 1);
};

// 리뷰 처리 함수
const submitReview = async () => {
  if (content.value.length < 10) {
    alert('리뷰를 10자 이상 작성해주세요.');
    return;
  }

  try {
    const token = localStorage.getItem('accessToken');

    // FormData 생성
    const formData = new FormData();
    formData.append('orderId', props.orderId);
    formData.append('productId', props.productId);
    formData.append('rating', rating.value.toString());
    formData.append('content', content.value);

    // 이미지 파일 추가
    images.value.forEach(file => formData.append('images', file));

    // 리뷰 등록 요청
    const response = await axios.post(`${SERVER_URL}/api/review`, formData, {
      headers: { 
        Authorization: `Bearer ${token}`,
        'Content-Type': 'multipart/form-data' // 파일 전송 시 필수
      }
    });

    if (response.data.success) {
      alert('리뷰가 등록되었습니다!');
      emit('submitted', props.productId, props.orderId); // 성공 알림
      emit('close');     // 모달 닫기
    }
  } catch (error: any) {
    alert(error.response?.data?.message || '실패했습니다.');
  }
};
</script>

<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-content">
      <button class="close-x-btn" @click="$emit('close')">✕</button>

      <h3>상품 리뷰 작성</h3>
      <p class="modal-subtitle">구매하신 상품은 어떠셨나요?</p>
      
      <div class="rating-container">
        <span v-for="star in 5" :key="star" @click="rating = star" :class="{ active: star <= rating }">★</span>
      </div>

      <textarea v-model="content" placeholder="후기를 10자 이상 남겨주세요." rows="5"></textarea>

      <div class="image-upload-section">
        <div class="preview-container">
          <div v-for="(src, index) in imagePreviews" :key="index" class="image-preview">
            <img :src="src" alt="preview" />
            <button class="remove-img" @click="removeImage(index)">✕</button>
          </div>
          <label v-if="imagePreviews.length < 3" class="upload-label">
            <input type="file" accept="image/jpeg,image/png,image/webp" multiple @change="handleImageUpload" hidden />
            <div class="upload-icon">
              <span class="plus">+</span>
              <span class="count">{{ imagePreviews.length }}/3</span>
            </div>
          </label>
        </div>
      </div>

      <div class="modal-actions">
        <button class="submit-btn" @click="submitReview">등록하기</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 모달 전체 오버레이 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 9999;
}

/* 모달 내용 */
.modal-content {
  position: relative;
  background: white;
  padding: 35px;
  border-radius: 24px;
  width: 90%;
  max-width: 480px;
  text-align: center;
}

.close-x-btn {
  position: absolute;
  top: 20px;
  right: 20px;
  background: none;
  border: none;
  font-size: 24px;
  color: #999;
  cursor: pointer;
  line-height: 1;
  padding: 5px;
  transition: color 0.2s;
}

.close-x-btn:hover {
  color: #333;
}

/* 별점 컨테이너 */
.rating-container {
  font-size: 35px;
  margin-bottom: 25px;
  display: flex;
  justify-content: center;
  gap: 8px;
  cursor: pointer;
}

.rating-container span {
  color: #eee;
}

.rating-container span.active {
  color: #ffcc00;
}

/* 리뷰 작성 텍스트 영역 */
textarea {
  width: 100%;
  border: 1px solid #eee;
  border-radius: 12px;
  padding: 15px;
  margin-bottom: 25px;
  outline: none;
  resize: none;
}

/* 이미지 업로드 섹션 */
.image-upload-section {
  margin-bottom: 25px;
}

.preview-container {
  display: flex;
  gap: 12px;
}
.image-preview, .upload-label {
  width: 80px;
  height: 80px;
  border-radius: 12px;
  position: relative;
}

.image-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 12px;
}

/* 이미지 삭제 버튼 */
.remove-img {
  position: absolute;
  top: -5px;
  right: -5px;
  background: #ff3b30;
  color: white;
  border-radius: 50%;
  width: 20px;
  height: 20px;
  border: none;
  cursor: pointer;
}

/* 이미지 업로드 버튼 */
.upload-label {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: #f8f8f8;
  border: 1px dashed #ccc;
  cursor: pointer;
}

/* 모달 하단 버튼 영역 */
.modal-actions {
  display: flex;
  justify-content: center;
  gap: 12px;
}

/* 제출 버튼 스타일 */
.submit-btn {
  width: 160px;
  height: 50px;
  padding: 14px;
  border-radius: 6px;
  background: #074CA1;
  color: #fff;
  border: none;
  font-weight: 600;
  cursor: pointer;
}

.submit-btn:hover {
  background-color: #063d82;
  color: #fff;
}
</style>
