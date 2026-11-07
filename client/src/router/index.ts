import CollectionPage from '../components/product/CollectionPage.vue';
import { createRouter, createWebHistory } from 'vue-router';          // 라우터 생성
import { useUserStore } from '../utils/userStore';

// 컴포넌트 불러오기
import HomePage from '../views/HomePage.vue';
import RegisterForm from '../components/auth/RegisterForm.vue';
import LoginForm from '../components/auth/LoginForm.vue';
import FindId from '../components/auth/FindId.vue';
import ResetPassword from '../components/auth/ResetPassword.vue';
import ProfileView from '../components/auth/ProfileView.vue';
import About from '../views/About.vue';
import ProductDetail from '../components/product/ProductDetail.vue';
import CartView from '../components/cart/CartView.vue';
import OrderForm from '../components/cart/OrderForm.vue';
import OrderSuccess from '../components/cart/OrderSuccess.vue';
import BestPage from '../views/category/BestPage.vue';
import AccPage from '../views/category/AccPage.vue';
import BoardDetail from '../components/board/BoardDetail.vue';
import BoardPage from '../components/board/BoardPage.vue';
import SearchView from '../views/SearchView.vue';

// 라우터 경로 설정
const routes = [
  ...['plush','living','stationery','apparel'].map(category=>({path:'/category/'+category,component:CollectionPage,props:{category}})),
  { path: '/search', name: 'Search', component: SearchView },
  {
    path: '/',                // 기본 경로
    name: 'Home',             // 라우터 이름
    component: HomePage,      // 메인 페이지
  },
  {
    path: '/register',
    name: 'Register',
    component: RegisterForm,  // 회원가입
  },
  {
    path: '/login',
    name: 'Login',
    component: LoginForm,     // 로그인
  },
  {
    path: '/find-id',
    name: 'FindId',
    component: FindId,        // 아이디 찾기
  },
  {
    path: '/reset-password',
    name: 'ResetPassword',
    component: ResetPassword, // 비밀번호 재설정
  },
  {
    path: '/profile',
    name: 'Profile',
    component: ProfileView,   // 마이페이지
  },
  {
    path: '/about',
    name: 'About',
    component: About,         // 회사 소개 페이지
  },

  {
    path: '/product/:id',
    name: 'ProductDetail',
    component: ProductDetail, // 상품 상세 페이지
  },
  {
    path: '/cart',
    name: 'cart',
    component: CartView,      // 장바구니
  },
  {
    path: '/order',
    name: 'OrderForm',
    component: OrderForm,     // 주문 페이지
  },
  {
    path: '/order-success',
    name: 'OrderSuccess',
    component: OrderSuccess   // 주문 완료
  },
  {
    path: '/category/best',
    name: 'BestPage',
    component: BestPage
  },
  { path: '/category/women', redirect: '/category/best' },
  { path: '/category/men', redirect: '/category/best' },
  {
    path: '/category/acc',
    name: 'AccPage',
    component: AccPage
  },
  {
    path: '/board',
    name: 'BoardPage',
    component: BoardPage
  },
  {
    path:'/board/:id',        // 게시글 상세
    name: 'BoardDetail',
    component: BoardDetail
  }
];

// 라우터 생성
const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),  // 히스토리 모드
  routes,

  // 페이지 이동 시 스크롤 위치 제어
  scrollBehavior(_to, _from, savedPosition) {
    if (savedPosition) {
      return savedPosition;                   // 뒤로가기 시 이전 위치 유지
    } else {
      return { top: 0, behavior: 'smooth' };  // 새 페이지는 상단으로
    }
  },
});

// 네비게이션 가드: 인증 및 권한 체크
router.beforeEach(async (_to, _from, next) => {
  const userStore = useUserStore();                   // 사용자 상태 store
  const expireAt = localStorage.getItem('expireAt');  // 세션 만료 시간
  const now = new Date().getTime();                   // 현재 시간

  // 세션 만료 체크 (로그인 상태일 때만)
  if (userStore.isLoggedIn.value && expireAt) {
    const expirationTime = parseInt(expireAt);        // 만료 시간 숫자로 변환

    if (now > expirationTime) {
      userStore.logout();   // 로그아웃 처리
      alert("세션이 만료되었습니다. 다시 로그인해주세요.");
      return next('/login');
    }

    // JWT는 페이지 이동으로 갱신되지 않으므로 로컬 만료 시간도 연장하지 않습니다.
  }

  next();
});

export default router;
