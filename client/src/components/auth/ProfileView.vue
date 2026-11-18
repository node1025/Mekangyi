<script setup lang="ts">
import { ref, reactive, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useUserStore } from '../../utils/userStore';
import { resolveMypageSection, type MypageSection } from '../../constants/mypageSections';
import axios from 'axios';
import ProfileForm from '../mypage/ProfileForm.vue';
import ShippingAddress from '../mypage/ShippingAddress.vue';
import MyOrders from '../mypage/MyOrders.vue';
import MyWishlist from '../mypage/MyWishlist.vue';

const userStore = useUserStore();
const route = useRoute();
const router = useRouter();

// 상태 관리
const isPending = ref(false);
const isVerified = ref(false); 
const currentPassword = ref('');
const activeMenu = ref<MypageSection>(resolveMypageSection(route.query.section));
const withdrawPassword = ref(''); // 탈퇴용 비밀번호 입력값

watch(
  () => route.query.section,
  (section) => {
    activeMenu.value = resolveMypageSection(section);
  }
);

const SERVER_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');

const form = reactive({
  userId: userStore.user.value?.userId || '', 
  userName: userStore.user.value?.name || '',
  email: '',
  phone: '',
  gender: '',
  birthDate: '',
  address: {
    zipCode: '',
    basicAddress: '',
    detailAddress: '',
  }
});

const setActiveMenu = (menu: MypageSection) => {
  activeMenu.value = menu;
  router.replace({ path: '/profile', query: menu === 'profile' ? {} : { section: menu } });
};

// 비밀번호 확인 함수
const verifyPassword = async () => {
  if (!currentPassword.value.trim()) {
    alert('비밀번호를 입력해주세요.');
    return;
  }

  if (isPending.value) return;
  isPending.value = true;

  try {
    // 로컬 스토리지나 store에서 토큰 가져오기
    const token = localStorage.getItem('accessToken');

    if (!token) {
      alert('로그인 정보가 없습니다. 다시 로그인해주세요.');
      window.location.href = '/login';
      return;
    }

    const response = await axios.post(`${SERVER_URL}/api/auth/verify-password`,
      { password: currentPassword.value },
      { headers: {
          Authorization: `Bearer ${token}` // 토큰을 헤더에 담아 전송
        }
      }
    );

    if (response.status === 200) {
      isVerified.value = true;
      // 서버에서 넘겨주는 데이터 구조에 따라 로드
      loadUserData(response.data.user);
    }
  } catch (error: any) {
    const status = error.response?.status;
    const message = error.response?.data?.message;

    if (status === 401) {
      alert('인증이 만료되었거나 비밀번호가 일치하지 않습니다.');
    } else if (status === 403) {
      alert('권한이 없습니다.');
    } else if (status === 500) {
      alert('서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
    } else {
      alert(message || '비밀번호 확인 중 오류가 발생했습니다.');
    }
    
    currentPassword.value = ''; // 실패 시 입력창 초기화
  } finally {
    isPending.value = false; // 성공/실패 여부와 상관없이 로딩 해제
  }
};

// 데이터 매핑 함수
const loadUserData = (user: any) => {
  form.userId = user.userId;
  form.userName = user.name;
  form.phone = user.phone || '';
  form.gender = user.gender || 'none';
  form.email = user.email || '';
  
  if (user.birthDate) {
    form.birthDate = user.birthDate.split('T')[0]; 
  } else {
    form.birthDate = '';
  }

  if (user.address) {
    form.address = { ...user.address };
  }
};

// 회원탈퇴 함수
const handleWithdraw = async () => {
  if (!withdrawPassword.value) {
    alert('비밀번호를 입력해주세요.');
    return;
  }

  if (!confirm('회원 탈퇴하시겠습니까? 모든 정보가 삭제되며 복구할 수 없습니다.')) {
    return;
  }

  try {
    const token = localStorage.getItem('accessToken');
    
    await axios.delete('/api/auth/profile', {
      headers: { Authorization: `Bearer ${token}` },
      data: { password: withdrawPassword.value } // DELETE 요청에서 body를 보낼 때 사용하는 형식
    });

    alert('회원 탈퇴가 완료되었습니다. 그동안 이용해주셔서 감사합니다.');
    
    // 탈퇴 성공 후 스토어 비우고 메인페이지로 이동
    userStore.logout(); 
    window.location.href = '/';

  } catch (error: any) {
    console.error('탈퇴 에러:', error);
    alert(error.response?.data?.message || '비밀번호가 일치하지 않거나 오류가 발생했습니다.');
    withdrawPassword.value = '';
  }
};
</script>

<template>
  <div class="profile-container">
    <aside class="sidebar">
      <div class="user-welcome">
        <p class="welcome-text">반가워요!</p>
        <h3 class="user-name"><strong>{{ userStore.userName.value }}님</strong></h3>
      </div>
      
      <nav class="sidebar-menu">
        <div class="menu-group">
          <p class="group-label">내 정보 관리</p>
          <ul class="menu-list">
            <li class="menu-item" :class="{ active: activeMenu === 'profile' }" @click="setActiveMenu('profile')"> 회원 정보 관리 </li>
            <li class="menu-item" :class="{ active: activeMenu === 'address' }" @click="setActiveMenu('address')"> 배송지 관리 </li>
            <li class="menu-item" :class="{ active: activeMenu === 'orders' }" @click="setActiveMenu('orders')"> 주문 내역 </li>
            <li class="menu-item" :class="{ active: activeMenu === 'wishlist' }" @click="setActiveMenu('wishlist')"> 찜한 상품 </li>
          </ul>
        </div>

        <div class="menu-group">
          <p class="group-label">고객센터</p>
          <ul class="menu-list">
            <li class="menu-item" :class="{ active: activeMenu === 'qna' }" @click="setActiveMenu('qna')"> 1:1 문의 </li>
            <li class="menu-item delete-account" :class="{ active: activeMenu === 'withdraw' }" @click="setActiveMenu('withdraw')"> 회원탈퇴 </li>
          </ul>
        </div>
      </nav>
    </aside>

    <main class="profile-content">
      <section v-if="activeMenu === 'profile'">
        <header class="content-header">
          <h2>개인 정보 수정</h2>
        </header>
        
        <div v-if="!isVerified" class="verify-container">
          <h2>비밀번호 재확인</h2>
          <p class="verify-guide">회원님의 정보를 안전하게 보호하기 위해 비밀번호를 다시 한번 확인해주세요.</p>
          
          <div class="verify-box">
            <div class="input-row">
              <label class="input-label">아이디</label>
              <div class="input-content">
                <input type="text" v-model="form.userId" readonly class="readonly-input" />
              </div>
            </div>
            
            <div class="input-row">
              <label class="input-label">비밀번호<span class="asterisk">*</span></label>
              <div class="input-content">
                <input type="password" v-model="currentPassword" placeholder="현재 비밀번호를 입력해주세요" @keyup.enter="verifyPassword" class="password-input" />
              </div>
            </div>
            
            <div class="button-wrapper">
              <button @click="verifyPassword" class="submit-btn">확인</button>
            </div>
          </div>
        </div>
        
        <ProfileForm v-if="isVerified && form.userId" :initialData="form" />
      </section>

      <section v-else-if="activeMenu === 'address'">
        <header class="content-header">
          <h2>배송지 관리</h2>
        </header>
        <div class="content-body">
          <ShippingAddress />
        </div>
      </section>

      <section v-else-if="activeMenu === 'orders'">
        <header class="content-header">
          <h2>주문 내역</h2>
        </header>
        <div class="content-body">
          <MyOrders />
        </div>
      </section>

      <section v-else-if="activeMenu === 'wishlist'">
        <div class="content-body">
          <MyWishlist />
        </div>
      </section>

      <section v-else-if="activeMenu === 'qna'">
        <header class="content-header">
          <h2>1:1 문의</h2>
        </header>
        <div class="content-body">
          <p>궁금하신 점을 남겨주시면 답변해 드립니다.</p>
        </div>
      </section>

      <section v-else-if="activeMenu === 'withdraw'">
        <header class="content-header">
          <h2>회원 탈퇴</h2>
        </header>
        <div class="verify-container">
          <p class="verify-guide">탈퇴 시 계정 정보 및 이용 기록은 모두 삭제되며 다시 복구할 수 없습니다. 계속하시려면 비밀번호를 입력해주세요.</p>
          
          <div class="verify-box">
            <div class="input-row">
              <label class="input-label">비밀번호 확인</label>
              <div class="input-content">
                <input type="password" v-model="withdrawPassword" placeholder="비밀번호를 입력하세요" @keyup.enter="handleWithdraw" />
              </div>
            </div>
            
            <div class="button-wrapper">
              <button @click="handleWithdraw" class="submit-btn withdraw-btn">탈퇴하기</button>
            </div>
          </div>
        </div>
      </section>
    </main>
  </div>
</template>

<style scoped>
/* 전체 레이아웃 */
.profile-container {
  display: flex;
  justify-content: center;
  gap: 40px;
  padding: 60px 20px;
  background-color: #f9f9f9;
  min-height: 100vh;
}

/* 사이드바 */
.sidebar {
  width: 250px;
  background: white;
  border: 1px solid #f9f9f9;
  border-radius: 8px;
  overflow: hidden;
  height: fit-content;
}

/* 사용자 환영 문구 */
.user-welcome {
  padding: 30px 25px;
  background-color: #fff;
  border-bottom: 1px solid #f9f9f9;
}

.welcome-text {
  font-size:18px;
  color: #666;
  margin-bottom: 5px;
}

.user-name {
  font-size: 20px;
  color: #333;
}

/* 사이드바 메뉴 */
.menu-group {
  padding-bottom: 10px;
}

.group-label {
  padding: 20px 25px 10px;
  font-size:16px;
  font-weight: 700;
  color: #aaa;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* 메뉴 리스트 */
.menu-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.menu-item {
  padding: 14px 25px;
  font-size:18px;
  font-weight: bold;
  color: #555;
  cursor: pointer;
  transition: all 0.2s ease-in-out;
  border-left: 4px solid transparent;
  display: block;
}

.menu-item:hover {
  background-color: #f9f9f9;
  color: #074CA1;
}

/* 활성화 상태 (Active) */
.menu-item.active {
  background-color: #f9f0ff;
  color: #074CA1;
  font-weight: 600;
  border-left: 4px solid #074CA1;
  padding-left: 30px;
}

/* 메인 콘텐츠 영역 */
.profile-content {
  flex: 1;
  width: 750px;
  max-width: 800px;
  background: white;
  padding: 40px 50px;
  border: 1px solid #f9f9f9;
  border-radius: 8px;
}

.content-header h2 {
  font-size: 24px;
  font-weight: 700;
  text-align: left;
}

/* 비밀번호 재확인 영역 */
.verify-container {
  max-width: 800px;
  margin: 0 auto;
  padding: 10px 0;
}

.verify-container h2 {
  font-size: 22px;
  text-align: left;
  border-bottom: 2px solid #333;
  padding-bottom: 15px;
  margin-bottom: 10px;
}

.verify-guide {
  text-align: left;
  font-size:18px;
  color: #666;
  margin-bottom: 30px;
}

.verify-box {
  padding: 40px 20px;
}

.input-row {
  display: flex;
  align-items: center;
  margin-bottom: 20px;
  justify-content: center;
}

.input-label {
  width: 120px;
  font-size:19px;
  font-weight: 700;
  color: #333;
  text-align: left;
  margin-bottom: 0;
  line-height: 52px;
}

.input-content {
  flex: 1;
  max-width: 400px;
  margin-bottom: 0 !important
}

.asterisk { color: #ee6a7b; }

/* 폼 공통 입력 스타일 */
input {
  width: 100%;
  box-sizing: border-box; /* 패딩을 포함한 너비 계산 */
  height: 52px;
  margin-bottom: 0;
  padding: 0 16px;
  background-color: #ffffff;
  border: 1.5px solid #eee;
  border-radius: 8px;
  font-size:18px;
  color: #000000 !important; 
  font-weight: 500;
  transition: all 0.2s ease-in-out;
  outline: none;
}

input[type="radio"] {
  width: auto;
  height: auto;
  margin: 0;
  cursor: pointer;
  accent-color: #074CA1;
  transform: scale(1.2);
}

input:focus {
  border-color: #074CA1;
}

.readonly-input {
  background-color: #f2f2f2 !important;
  color: #666 !important;
  border: 1px solid #ddd;
  cursor: default;
}

/* 버튼 스타일 */
.button-wrapper {
  margin-top: 40px;
  display: flex;
  justify-content: center;
}

.submit-btn {
  width: 200px;
  height: 56px;
  background-color: #074CA1;
  color: #fff;
  border: none;
  border-radius: 4px;
  font-size:19px;
  font-weight: 700;
  margin: 0;
  display: block;
  cursor: pointer;
  transition: background-color 0.2s;
}

.submit-btn:hover {
  background-color: #153666;
}

/* 회원탈퇴 스타일 */
.menu-item.delete-account:hover {
  color: #ee6a7b;
}

.withdraw-btn {
  background-color: #ee6a7b;
}

.withdraw-btn:hover {
  background-color: #d64f61;
}

/* 애니메이션 */
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 모바일/태블릿 반응형 스타일 */
@media (min-width: 769px) and (max-width: 1199px) {
  .profile-container {
    gap: 20px;
    padding: 40px 15px;
  }

  .sidebar {
    width: 200px;
  }

  .user-welcome {
    padding: 20px 15px;
  }

  .menu-item {
    padding: 12px 15px;
    font-size:18px;
  }

  .profile-content {
    padding: 30px;
    width: auto;
    flex: 1;
  }

  :deep(.input-group label) {
    width: 100px;
    min-width: 100px;
  }
}

@media (max-width: 768px) {
  .profile-container {
    flex-direction: column;
    padding: 20px 10px;
    gap: 20px;
  }

  .sidebar {
    width: 100%;
    border: none;
    border-bottom: 1px solid #eee;
    border-radius: 0;
  }

  .user-welcome {
    padding: 20px;
    text-align: center;
  }

  .group-label {
    display: none;
  }

  .menu-list {
    display: flex;
    overflow-x: auto;
    white-space: nowrap;
    padding: 10px 0;
    -webkit-overflow-scrolling: touch;
  }

  .menu-list::-webkit-scrollbar {
    display: none;
  }

  .menu-item {
    border-left: none !important;
    border-bottom: 2px solid transparent;
    padding: 10px 15px;
    font-size:18px;
    flex: 0 0 auto;
  }

  .menu-item.active {
    background-color: transparent;
    color: #074CA1;
    border-bottom: 2px solid #074CA1 !important;
    padding-left: 15px;
  }

  .profile-content {
    width: 100%;
    max-width: 100%;
    padding: 30px 20px;
    border: none;
    border-radius: 0;
  }

  .input-row {
    flex-direction: column;
    align-items: flex-start;
  }

  .input-label {
    width: 100%;
    line-height: 1.5;
    margin-bottom: 8px;
  }

  .input-content {
    width: 100%;
    max-width: 100%;
  }
}
</style>