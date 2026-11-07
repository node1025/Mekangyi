<script setup lang="ts">
import { RouterLink, RouterView, useRouter } from 'vue-router';
import { ref, onMounted, onUnmounted, watch, computed } from 'vue';
import { useUserStore } from './utils/userStore';
import { IoOutlineSearch, IoOutlineBag, IoOutlinePerson, BsChevronBarUp } from '@kalimahapps/vue-icons';  // 아이콘
import axios from 'axios';
import Footer from './views/Footer.vue';

const userStore = useUserStore();
const router = useRouter();

const isMenuOpen = ref(false);      // 마이페이지 드롭다운 상태
const isSearchOpen = ref(false);    // 검색창 활성화 상태
const showTopButton = ref(false);   // 상단 이동 버튼 표시 상태

const cartCount = ref(0);           // 장바구니 물품 수
const searchQuery = ref('');        // 검색어 입력값
const allProducts = ref<any[]>([]); // 전체 상품 목록
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');

// 로그아웃 처리 함수
const handleLogout = () => {
  userStore.logout();
  isMenuOpen.value = false;
  router.push('/');
};

// 드롭다운 메뉴 토글 열기/닫기
const toggleMenu = () => {  
  isMenuOpen.value = !isMenuOpen.value;
};

const closeMenu = () => {
  isMenuOpen.value = false;
};

// 외부 클릭 감지 로직
const handleClickOutside = (e: MouseEvent) => {
  const target = e.target as HTMLElement;
  
  // 마이페이지 드롭다운 닫기
  if (isMenuOpen.value && !target.closest('.user-dropdown-container')) {
    isMenuOpen.value = false;
  }
  
  // 검색 드롭다운 닫기
  if (isSearchOpen.value && !target.closest('.user-dropdown-container')) {
    isSearchOpen.value = false;
    searchQuery.value = ''; // 닫을 때 검색어 초기화
  }
};

// 검색 기능
const filteredResults = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();
  if (!query) return [];
  
  // 상품명(한글/영어)에 검색어가 포함된 상품만 필터링 (최대 7개)
  return allProducts.value
    .filter(p => 
      p.name.ko.toLowerCase().includes(query) || 
      (p.name.en && p.name.en.toLowerCase().includes(query))
    )
    .slice(0, 7); 
});

// 검색창 토글 시 데이터가 없으면 불러오기
const toggleSearch = async () => {
  isSearchOpen.value = !isSearchOpen.value;
  if (isSearchOpen.value) {
    try {
      const response = await axios.get('/api/products');
      allProducts.value = response.data.products;
    } catch (error) {
      console.error("상품 로드 실패", error);
    }
  }
};

// 검색 결과 클릭 시 상세 페이지로 이동
const goToProduct = (productCode: string) => {
  router.push(`/product/${productCode}`);
  searchQuery.value = '';
  isSearchOpen.value = false;
};

// 장바구니 수량 조회 함수
const fetchCartCount = async () => {
  // 로그인이 되어 있지 않으면 0으로 초기화하고 중단
  if (!userStore.isLoggedIn.value) {
    cartCount.value = 0;
    return;
  }

  try {
    const token = localStorage.getItem('accessToken');
    const response = await axios.get('/api/cart', {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    // items 배열의 길이를 세거나, 각 아이템의 quantity 합계를 구함
    const items = response.data.items || [];
    cartCount.value = items.length; // 품목 종류 수

  } catch (error) {
    console.error("장바구니 수량 로드 실패", error);
    cartCount.value = 0;
  }
};

// 로그인 상태가 변할 때마다 수량을 다시 조회
watch(() => userStore.isLoggedIn.value, (newVal) => {
  if (newVal) {
    fetchCartCount();
  } else {
    cartCount.value = 0; // 로그아웃 시 배지 초기화
  }
}, { immediate: true });

// 스크롤 위치 감지 함수
const handleScroll = () => {
  showTopButton.value = window.scrollY > 300; // 300px 이상 스크롤되면 버튼 표시
};

// 최상단으로 이동하는 함수
const scrollToTop = () => {
  window.scrollTo({
    top: 0,
    behavior: 'smooth' // 부드럽게 이동
  });
};

onMounted(() => {
  document.addEventListener('click', handleClickOutside);
  window.addEventListener('cart-updated', fetchCartCount);  // 다른 페이지에서 장바구니 변경 시 자동 갱신
  window.addEventListener('scroll', handleScroll);

  fetchCartCount();   // 장바구니 수량 조회
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
  window.removeEventListener('cart-updated', fetchCartCount);
  window.removeEventListener('scroll', handleScroll);
});
</script>

<template>
  <div class="announcement">BUKANGI GOODS SHOP <span>좋아하는 마음을, 일상 가까이 · 50,000원 이상 무료배송</span></div>
  <header class="discovery-header">
    <div class="header-inner">
      <div class="logo-area">
        <RouterLink to="/" class="logo-text"><img src="/brand/bukangi_character_1.png" alt="" /><span>부캉이</span></RouterLink>
      </div>

      <nav class="category-nav">
        <ul class="category-list">
  <li><RouterLink to="/category/best">전체 굿즈</RouterLink></li>
  <li><RouterLink to="/category/plush">인형·키링</RouterLink></li>
  <li><RouterLink to="/category/living">리빙</RouterLink></li>
  <li><RouterLink to="/category/stationery">문구·데스크</RouterLink></li>
  <li><RouterLink to="/category/apparel">의류</RouterLink></li>
  <li><RouterLink to="/about">부캉이 이야기</RouterLink></li>
  <li><RouterLink to="/board">커뮤니티</RouterLink></li>
</ul>
      </nav>

      <div class="icon-menu">
        <div class="user-dropdown-container"> 
          <button class="icon-btn" @click="toggleSearch" aria-label="검색" :aria-expanded="isSearchOpen">
            <IoOutlineSearch class="icon" />
          </button>
          
          <div v-if="isSearchOpen" class="search-dropdown" @click.stop>
            <div class="serch-input-wrapper">
              <input 
                v-model="searchQuery" 
                type="text" 
                placeholder="상품명을 입력하세요" 
                aria-label="상품 검색어"
                class="search-bar-input"
                @keyup.esc="isSearchOpen = false"
                ref="searchInput"
                autofocus
              />
            </div>
            
            <ul v-if="filteredResults.length > 0" class="search-results">
              <li v-for="product in filteredResults" :key="product._id" @click="goToProduct(product.productCode)">
                <div class="search-item">
                  <img :src="`${API_BASE_URL}/${product.thumbnail}`" class="search-thumb" alt="상품" />
                  <div class="search-info">
                    <span class="search-name">{{ product.name.ko }}</span>
                    <span class="search-price">{{ product.finalPrice.toLocaleString() }}원</span>
                  </div>
                </div>
              </li>
            </ul>
            
            <div v-else-if="searchQuery" class="no-result">검색 결과가 없습니다.</div>
          </div>
        </div>

        <RouterLink to="/cart" class="icon-btn" aria-label="장바구니">
          <IoOutlineBag class="icon" />
          <span v-if="cartCount > 0" class="cart-badge">{{ cartCount }}</span>
        </RouterLink>

        <div class="user-dropdown-container">
          <button class="icon-btn" @click="toggleMenu" aria-label="마이페이지" :aria-expanded="isMenuOpen">
            <IoOutlinePerson class="icon" /> 
          </button>
          
          <div v-if="isMenuOpen" class="dropdown-box" @click.stop>
            <template v-if="userStore.isLoggedIn.value">
              <div class="user-info">{{ userStore.userName.value }}님</div>
              
              <div class="admin-badge">
                <span v-if="userStore.isAdmin.value">ADMIN</span>
              </div>
              
              <div class="divider"></div>

              <RouterLink to="/profile" @click="closeMenu">회원정보관리</RouterLink>
              
              <button @click="handleLogout">로그아웃</button>
            </template>

            <template v-else>
              <RouterLink to="/login" @click="closeMenu">로그인</RouterLink>
              <RouterLink to="/register" @click="closeMenu">회원가입</RouterLink>
            </template>
          </div>
        </div>
      </div>
    </div>
  </header>

  <main class="content-container">
    <RouterView />
  </main>

  <Footer />

  <Transition name="fade">
    <button 
      v-if="showTopButton" 
      class="top-button" 
      @click="scrollToTop"
      aria-label="맨 위로 이동"
    >
      <BsChevronBarUp class="top-icon" />
    </button>
  </Transition>

</template>

<style scoped>
/* 헤더 레이아웃 */
.discovery-header {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 80px;
  background-color: #fff;
  border-bottom: 1px solid #e5e5e5;
  z-index: 1000;
  display: flex;
  align-items: center;
}

.header-inner {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  max-width: 1400px;
  margin: 0 auto;
  padding: 0 20px;
}

.content-container {
  margin-top: 80px;
}

/* 로고 텍스트 스타일 */
.logo-text {
  font-size: 1.75rem;
  font-weight: 900;
  letter-spacing: -1px;
  color: transparent;
  text-decoration: none;
  background: linear-gradient(to right, #000000, #6a8fe7); /* 왼쪽에서 오른쪽으로 그라데이션 */
  
  /* 그라데이션이 글자 모양대로 깎이도록 설정 */
  -webkit-background-clip: text; 
  background-clip: text;         
  -webkit-text-fill-color: transparent; /* 글자 내부를 배경색(그라데이션)으로 채움 */

  display: inline-block;
  transition: opacity 0.3s;
}

.logo-text:hover {
  opacity: 0.7;         /* 마우스를 올렸을 때 살짝 투명해지도록 설정 */
}

/* 카테고리 메뉴 목록 */
.category-list {
  display: flex;
  list-style: none;     /* 목록 점 제거 */
  gap: 25px;
  margin: 0;
  padding: 0;
}

/* 카테고리 링크 스타일 */
.category-list li a {
  text-decoration: none;
  color: #000;
  font-size:18px;
  font-weight: 600;
}

/* 우측 아이콘 메뉴 레이아웃 */
.icon-menu {
  display: flex;
  gap: 8px;             /* 아이콘들 사이의 좁은 간격 */
  align-items: center;
}

/* 아이콘 버튼 공통 스타일 */
.icon-btn {
  position: relative;
  background: none;
  border: none;
  cursor: pointer;
  padding: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 아이콘 크기 및 색상 */
.icon {
  width: 24px;
  height: 24px;
  color: #000;
}

/* 검색창 드롭다운 */
.search-dropdown {
  position: absolute;
  top: 55px;
  right: 0;
  width: 300px;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(15px);
  border-radius: 12px;
  padding: 6px;
  z-index: 1100;
  border: 1px solid rgba(0, 0, 0, 0.05);
  overflow: hidden;
  animation: dropdownSlide 0.3s ease-out;
}

/* 검색 입력창 */
.search-bar-input {
  width: 100%;
  padding: 10px 0;
  border: none;
  background: transparent;
  outline: none;
  font-size:18px;
  font-weight: 500;
  color: #222;
}

.search-bar-input::placeholder {
  color: #aaa;
  font-weight: 400;
}

/* 검색 결과 리스트 */
.search-results {
  list-style: none;
  padding: 0;
  margin: 0;
  max-height: 400px;
  overflow-y: auto;
}

.search-results li {
  padding: 12px 8px;
  margin-bottom: 4px;
  cursor: pointer;
  border-radius: 12px;
  transition: all 0.2s ease;
}

.search-results li:hover {
  background: #f1f4ff;
  padding-left: 12px;
}

/* 검색 결과 아이템 */
.search-item {
  display: flex;
  align-items: center;
  gap: 12px;
}

.search-thumb {
  width: 45px;
  height: 45px;
  object-fit: cover;
  border-radius: 6px;
  background: #f1f1f1;
}

.search-info {
  display: flex;
  flex-direction: column;
}

.search-name {
  font-size:17px;
  font-weight: 600;
  color: #222;
}

.search-price {
  font-size:15px;
  color: #074CA1;
  font-weight: bold;
}

.no-result {
  padding: 20px;
  text-align: center;
  font-size:17px;
  color: #999;
}

/* 장바구니 배지 스타일 */
.cart-badge {
  position: absolute;
  top: 0;
  right: 0;
  background-color: #ff5a5a;
  color: #ffffff;
  font-size:15px;
  min-width: 18px;
  height: 18px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
  font-weight: bold;
  pointer-events: none;
  border: 2px solid #fff;
}

/* 드롭다운 메뉴의 기준점 */
.user-dropdown-container {
  position: relative;
}

/* 실제 드롭다운 박스 스타일 */
.dropdown-box {
  position: absolute;
  top: 35px;
  right: 0;
  background: white;
  border: 1px solid #eee;
  padding: 10px 0;
  min-width: 140px;
  display: flex;
  flex-direction: column;
  box-shadow: 0 10px 20px rgba(0,0,0,0.08);
  border-radius: 4px;
}

/* 드롭다운 내부 사용자 이름 표시부 */
.user-info {
  padding: 8px 16px;
  font-size:17px;
  font-weight: 700;
  color: #074CA1;
}

/* 드롭다운 메뉴 구분선 */
.divider {
  height: 1px;
  background-color: #eee;
  margin: 4px 0;
}

/* 드롭다운 내부 링크 및 버튼 스타일 */
.dropdown-box a, .dropdown-box button {
  padding: 10px 16px;
  text-decoration: none;
  color: #444;
  font-size:17px;
  text-align: left;
  background: none;
  border: none;
  cursor: pointer;
}

/* 드롭다운 메뉴 항목 호버 시 효과 */
.dropdown-box a:hover, .dropdown-box button:hover {
  background-color: #f5f5f5;
  transform: none;
}

/* 메인 컨텐츠 영역 */
.content-container {
  margin-top: 80px;
}

/* 관리자 배지 */
.admin-badge {
  padding: 0 16px 8px 16px;
  display: flex;
}

.admin-badge span {
  background-color: #074CA1;
  color: #fff;
  font-size:14px;
  padding: 1px 6px;
  border-radius: 5px;
  text-transform: uppercase;
}

.admin-link {
  color: #074CA1 !important;
  font-weight: bold;
}

/* Top 버튼 스타일 */
.top-button {
  position: fixed;
  bottom: 30px;
  right: 30px;
  width: 50px;
  height: 50px;
  border-radius: 50%;
  background-color: #fff;
  color: #000;
  border: 1px solid #e5e5e5;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 999;
  transition: all 0.3s ease;
}

.top-button:hover {
  background-color: #6a8fe7;
  color: #fff;
  transform: translateY(-5px);
}

.top-icon {
  width: 24px;
  height: 24px;
}

/* 애니메이션 */
@keyframes dropdownSlide {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

@media (max-width: 768px) {
  .discovery-header { height: 112px; }
  .header-inner { flex-wrap: wrap; padding: 0 16px; box-sizing: border-box; }
  .logo-area { order: 0; }
  .icon-menu { order: 1; }
  .category-nav { order: 2; width: 100%; overflow-x: auto; padding: 10px 0; }
  .category-list { gap: 20px; width: max-content; }
  .category-list li a { white-space: nowrap; }
  .content-container { margin-top: 112px; }
  .search-dropdown { position: fixed; top: 58px; left: 12px; right: 12px; width: auto; }
}
.announcement{height:30px;display:flex;align-items:center;justify-content:center;gap:24px;background:#122551;color:#f5f4ed;font-size:13px;letter-spacing:1.7px}.announcement span{font-size:14px;letter-spacing:0}.discovery-header{position:sticky;top:0;height:88px;border-bottom:1px solid #ecece5}.header-inner{max-width:1480px;padding:0 5vw}.logo-text{font:32px Georgia,serif;font-weight:400;letter-spacing:4px;background:none;color:#122551;-webkit-text-fill-color:#122551}.category-list{gap:30px}.category-list li a{font-size:15px;letter-spacing:1.2px;font-weight:400}.category-list a.router-link-active{color:#477358}.content-container{margin-top:0}.icon{width:21px;height:21px;color:#293c2c}.icon-btn{box-shadow:none;border-radius:0}.icon-btn:hover{box-shadow:none;transform:none;background:#f4f4ef}.search-price{color:#345441}.top-button:hover{background:#122551}@media(max-width:768px){.announcement{font-size:12px;gap:12px;height:28px}.announcement span{font-size:13px}.discovery-header{height:104px}.header-inner{padding:10px 20px}.logo-text{font-size:27px}.category-nav{padding-top:14px;padding-bottom:4px}.category-list{gap:24px}.category-list li a{font-size:14px}.content-container{margin-top:0}.search-dropdown{top:78px}}
.announcement{background:#122551;color:#fff;font-size:13px;letter-spacing:1.2px}.discovery-header{height:92px;border-bottom:1px solid #e9f0fa}.header-inner{max-width:1500px;padding:0 4vw}.logo-text{display:flex;align-items:center;gap:10px;background:none;-webkit-text-fill-color:#122551;color:#122551;font-family:Arial,'Malgun Gothic',sans-serif;font-size:27px;letter-spacing:-1px;font-weight:900;white-space:nowrap}.logo-text img{width:48px;height:48px;object-fit:cover;border-radius:50%}.logo-text small{display:block;font-size:11px;letter-spacing:2px;margin-top:3px;font-weight:600}.category-list{gap:23px}.category-list li a{font-size:16px;letter-spacing:0;color:#526a8a;font-weight:500}.category-list a.router-link-active{color:#122551}.icon{color:#34557e}.search-price{color:#122551}.search-dropdown{border:1px solid #e0ebfa;border-radius:15px}.dropdown-box .admin-link{color:#122551!important}.top-button:hover{background:#3977df}.content-container{margin-top:0}@media(max-width:1000px){.category-list{gap:15px}.category-list li a{font-size:15px}}@media(max-width:768px){.announcement{font-size:11px;gap:10px}.announcement span{font-size:12px}.discovery-header{height:114px}.header-inner{padding:10px 18px}.logo-text{font-size:24px;gap:8px}.logo-text img{width:40px;height:40px}.logo-text small{font-size:6px}.category-nav{padding-top:12px;padding-bottom:4px}.category-list{gap:23px}.category-list li a{font-size:15px}.search-dropdown{top:84px}.content-container{margin-top:0}}

/* v3.2: larger navigation and compact brand mark. */
.logo-text{color:#122551;-webkit-text-fill-color:#122551;font-size:32px;letter-spacing:-1px;line-height:1.2;gap:10px}
.logo-text img{width:50px;height:50px;flex-shrink:0}
.category-list{gap:22px}.category-list li a{font-size:18px;font-weight:650;color:#122551;white-space:nowrap;line-height:1.6}
.category-list a.router-link-active{color:#122551;text-decoration:underline;text-underline-offset:7px}
.announcement{min-height:34px;height:auto;padding:7px 16px;flex-wrap:wrap;gap:6px 22px;line-height:1.5;background:#122551;font-size:12px}.announcement span{font-size:13px}
.header-inner{gap:24px}.icon-menu{flex-shrink:0}.category-nav{min-width:0}.content-container{margin-top:0}
@media(max-width:1250px){.discovery-header{height:auto;min-height:132px}.header-inner{flex-wrap:wrap;padding:16px 28px;gap:15px}.logo-area{order:0}.icon-menu{order:1}.category-nav{order:2;width:100%;overflow-x:auto;padding:3px 0 5px}.category-list{width:max-content;gap:28px}.category-list li a{font-size:18px}.content-container{margin-top:0}}
@media(max-width:650px){.header-inner{padding:13px 18px;gap:14px}.discovery-header{min-height:126px}.logo-text{font-size:29px}.logo-text img{width:44px;height:44px}.category-list{gap:23px}.category-list li a{font-size:16px}.announcement{padding:6px 12px;font-size:11px;gap:3px 8px}.announcement span{font-size:11px}.search-dropdown{top:92px}.content-container{margin-top:0}}

.logo-text{font-family:var(--font-cute);font-weight:400;letter-spacing:0.03em;color:#122551;-webkit-text-fill-color:#122551}
.category-list li a{font-family:var(--font-cute);font-weight:400;letter-spacing:0.02em}
</style>

