# 부캉이 굿즈샵 · shopping_mall v3.4

**Vue 3 (고객몰·관리자) + Express API + MariaDB**

## 준비물
- Node.js 22.12 이상
- MariaDB 11.4 (실행 중이어야 함)
- `server/.env`: `.env.example`을 복사해서 작성

## 빠른 시작 (프로젝트 루트에서 실행)
**1. DB 생성**
```sql
CREATE DATABASE IF NOT EXISTS bukang_shop_dev CHARACTER SET utf8mb4 COLLATE utf8mb4_bin;
CREATE USER IF NOT EXISTS 'bukang'@'127.0.0.1' IDENTIFIED BY '강력한_비밀번호';
GRANT ALL PRIVILEGES ON bukang_shop_dev.* TO 'bukang'@'127.0.0.1';
```

**2. 환경변수**
```powershell
Copy-Item server\.env.example server\.env
```
필수 항목은 `MARIADB_URI`, `DEV_MARIADB_URI`, `JWT_SECRET`, `JWT_REFRESH_SECRET`입니다. JWT 값 두 개는 서로 다른 랜덤 값으로 넣습니다. 아래 코드를 이용해 생성합니다. (2개 생성합니다.)
```sh
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

**3. 설치·실행**
```sh
npm ci
npm run db:init
npm --prefix server run admin:dev    # 관리자(mekang1223) 생성
npm run build:local
npm run start-all
```

## 접속 주소

| 서비스 | 주소 |
| --- | --- |
| 고객몰 | http://127.0.0.1:8080 |
| 관리자 | http://localhost:9081/login |
| API | 내부 5002 (각 사이트의 `/api`로 접근) |

## 코드 수정 후

| 수정 대상 | 할 일 |
| --- | --- |
| 전체·API | `build:local` → `start-all` 재시작 |
| 고객몰·관리자 화면만 | 해당 앱 `npm run build` 후 새로고침 |

## 문제 해결

| 증상 | 조치 |
| --- | --- |
| `MARIADB_URI` 오류 | `server/.env` 확인 |
| DB 연결 실패 | DB 서비스·계정·DB명 확인 |
| 빈 화면 | `npm run build:local` |
| `EADDRINUSE` | `node scripts/stop-local-stack.cjs` 후 재실행 |
| API 502 | Express 실행 여부 확인 |
| 관리자 접속 불가 | 로그의 관리자 포트 확인 (macOS/Linux는 8081일 수 있음) |

관리자 비밀번호 재설정: `npm run admin:reset-password`

## 계정 복구 규칙

- **아이디 찾기**: 이름과 휴대폰 번호가 일치하면 일부만 표시합니다. 예: `test001` → `te****1`
- **비밀번호 찾기**: 아이디와 휴대폰 번호를 확인한 뒤 변경 창이 열립니다.
  - 현재 비밀번호가 맞아야 하고, 새 비밀번호는 현재 것과 달라야 합니다.
  - 형식: 영문+숫자+특수문자(`!@#$%^&*`) 포함, 10자 이상, 72바이트 이하
- 복구 API는 IP당 15분에 10회로 제한됩니다.
- 관리자 계정은 이 화면으로 복구할 수 없습니다.

## 운영 배포 전

기본 설정은 로컬용입니다. 공개 운영 전에 다음을 준비하세요.
- TLS(HTTPS)
- 관리자 접근 제한(VPN/IP)
- `.env` 점검
- 시드 스크립트 사용 금지

Nginx 예시는 `deploy/`에 있습니다.
