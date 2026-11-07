import axios from 'axios';
import { ref, computed } from 'vue';

export const SESSION_DURATION = 3600 * 1000; // 1시간 (밀리초)

interface User {
  userId: string;
  name: string;
  role: 'user' | 'admin';
}

const user = ref<User | null>(null);
const accessToken = ref<string | null>(null);
let logoutTimer: ReturnType<typeof setTimeout> | null = null; // 타이머 참조 변수

// 로그아웃 처리
const logout = (showAlert = false) => {
  if (accessToken.value) void axios.delete('/api/admin/session', { headers: { Authorization: `Bearer ${accessToken.value}` } }).catch(() => {});
  user.value = null;
  accessToken.value = null;
  localStorage.removeItem('accessToken');
  localStorage.removeItem('user');
  localStorage.removeItem('expireAt');

  // 타이머가 작동 중이면 클리어
  if (logoutTimer) {
    clearTimeout(logoutTimer);
    logoutTimer = null;
  }

  if (showAlert) {
    alert('세션이 만료되어 자동으로 로그아웃되었습니다.');
    window.location.href = '/login'; // 로그인 페이지로 이동 (선택 사항)
  }
};

// 자동 로그아웃 타이머 설정 함수
const setAutoLogout = (duration: number) => {
  if (logoutTimer) clearTimeout(logoutTimer); // 기존 타이머가 있다면 제거

  logoutTimer = setTimeout(() => {
    logout(true); // 1시간 뒤 알림창과 함께 로그아웃 실행
  }, duration);
};

// 로그인 성공 시
const login = (userData: User, token: string) => {
  const expireAt = new Date().getTime() + SESSION_DURATION;

  user.value = userData;
  accessToken.value = token;

  localStorage.setItem('accessToken', token);
  localStorage.setItem('user', JSON.stringify(userData));
  localStorage.setItem('expireAt', expireAt.toString());

  // 로그인 시 타이머 시작
  setAutoLogout(SESSION_DURATION);
};

// 초기화 시 (새로고침 대응)
const initStore = () => {
  const token = localStorage.getItem('accessToken');
  const savedUser = localStorage.getItem('user');
  const expireAt = localStorage.getItem('expireAt');

  if (token && savedUser && expireAt) {
    const now = new Date().getTime();
    const timeLeft = parseInt(expireAt) - now;

    if (!Number.isFinite(timeLeft) || timeLeft <= 0) {
      logout(); // 이미 시간이 지났으면 즉시 로그아웃 (알림 없이)
      return;
    }

    // 상태 복구
    accessToken.value = token;
    try {
      const parsed = JSON.parse(savedUser);
      if (!parsed || typeof parsed.userId !== 'string' || typeof parsed.name !== 'string') {
        logout();
        return;
      }
      user.value = parsed;
    } catch {
      logout();
      return;
    }

    // 남은 시간만큼 다시 타이머 설정
    setAutoLogout(timeLeft);
  }
};

initStore();

const isLoggedIn = computed(() => !!user.value);
const userName = computed(() => user.value ? user.value.name : '');
const isAdmin = computed(() => user.value?.role === 'admin');

export function useUserStore() {
  return {
    user,
    accessToken,
    isLoggedIn,
    userName,
    isAdmin,
    login,
    logout,
  };
}
