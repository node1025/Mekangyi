/**
 * 관리 콘솔에서 변경 API가 성공하면 보호 세션을 15분으로 연장합니다.
 * 예: 게시판 글쓰기·수정·삭제, 리뷰 삭제, 주문 상태 변경, 상품 등록·수정·삭제
 * (클레임·고객 관리 메뉴, 로그인·비밀번호·세션 API는 제외)
 */
import axios, { type AxiosInstance, type AxiosResponse } from 'axios';
import { isConsolePath } from '../config/adminRoutes';

let currentRoutePath = () => '';

type SessionClockHandler = (expiresAt: string) => void;

let onSessionExtended: SessionClockHandler | null = null;

/** 보호 세션 연장 제외 메뉴 (아직 미구현·플레이스홀더) */
const EXCLUDED_CONSOLE_MENUS = new Set(['claims', 'users']);

const MUTATING_METHODS = new Set(['post', 'patch', 'put', 'delete']);

/** 연장하지 않을 API (세션·로그인·비밀번호 변경·로그아웃 등) */
const SKIP_PATH_RE =
  /^\/api\/(?:admin\/session(?:\/|$)|auth\/(?:login|password)(?:\/|$))/;

let consoleMenuId = 'products';

export function setAdminConsoleMenu(menuId: string) {
  consoleMenuId = menuId;
}

/** router 순환 참조 방지 — main.ts에서 등록 */
export function bindAdminSessionRoutePath(getter: () => string) {
  currentRoutePath = getter;
}

export function shouldExtendSessionForMenu(menuId: string) {
  return !EXCLUDED_CONSOLE_MENUS.has(menuId);
}

function requestPath(response: AxiosResponse): string {
  const config = response.config;
  try {
    const uri = axios.getUri(config);
    if (/^https?:\/\//i.test(uri)) return new URL(uri).pathname;
    return uri.startsWith('/') ? uri : `/${uri}`;
  } catch {
    const base = (config.baseURL || '').replace(/\/+$/, '');
    const url = config.url || '';
    const path = url.startsWith('/') ? url : `/${url}`;
    return `${base}${path}`.replace(/\/{2,}/g, '/');
  }
}

export function shouldRefreshSessionAfterMutation(response: AxiosResponse): boolean {
  if (!isConsolePath(currentRoutePath())) return false;
  if (!shouldExtendSessionForMenu(consoleMenuId)) return false;
  const method = (response.config.method || 'get').toLowerCase();
  if (!MUTATING_METHODS.has(method)) return false;
  if (response.status < 200 || response.status >= 300) return false;

  const path = requestPath(response);
  if (SKIP_PATH_RE.test(path)) return false;
  if (method === 'delete' && /^\/api\/auth\/profile(?:\/|$)/.test(path)) return false;

  return true;
}

/** 성공 응답마다 호출 (main.ts 기본 axios 인터셉터에서도 사용) */
export function onAdminApiMutationSucceeded(response: AxiosResponse) {
  if (shouldRefreshSessionAfterMutation(response)) {
    void extendAdminProtectedSession();
  }
}

function attachMutationRefresh(client: AxiosInstance) {
  client.interceptors.response.use((response) => {
    onAdminApiMutationSucceeded(response);
    return response;
  });
}

/** 기본 axios + 게시판 등 별도 인스턴스에 액션 성공 시 15분 연장 */
export function installAdminSessionActionRefresh(clients: AxiosInstance[] = [axios]) {
  const seen = new Set<AxiosInstance>();
  for (const client of clients) {
    if (seen.has(client)) continue;
    seen.add(client);
    attachMutationRefresh(client);
  }
}

/** AdminPage 상단 타이머와 연동 */
export function registerAdminSessionClock(handler: SessionClockHandler) {
  onSessionExtended = handler;
}

export function unregisterAdminSessionClock() {
  onSessionExtended = null;
}

/** 관리자 보호 세션을 15분으로 다시 연장 */
export async function extendAdminProtectedSession(): Promise<boolean> {
  try {
    const { data } = await axios.post('/api/admin/session/refresh');
    if (data?.expiresAt && onSessionExtended) {
      onSessionExtended(String(data.expiresAt));
    }
    return Boolean(data?.expiresAt);
  } catch (error) {
    console.warn('보호 세션 연장 실패', error);
    return false;
  }
}
