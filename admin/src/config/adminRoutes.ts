/**
 * 관리자 화면 경로 (추측 방지)
 * VITE_ADMIN_ROUTE_ROOT=/buk-8f3c 처럼 설정하면
 * /buk-8f3c/sign-in · /buk-8f3c/verify · /buk-8f3c/desk 로 동작합니다.
 * 비우면 로컬 개발용 기본 경로(/login, /admin/…)를 유지합니다.
 */
function normalizeRoot(raw: string | undefined) {
  const trimmed = (raw || '').trim().replace(/\/+$/, '');
  if (!trimmed || trimmed === '/') return '';
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

const routeRoot = normalizeRoot(import.meta.env.VITE_ADMIN_ROUTE_ROOT);

export const adminPaths = routeRoot
  ? {
      login: `${routeRoot}/sign-in`,
      gate: `${routeRoot}/verify`,
      console: `${routeRoot}/desk`,
    }
  : {
      login: '/login',
      gate: '/admin/access',
      console: '/admin',
    };

export const adminUsesObscureRoutes = Boolean(routeRoot);

export function isConsolePath(path: string) {
  return path === adminPaths.console || path.startsWith(`${adminPaths.console}/`);
}
