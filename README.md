# 부캉이 굿즈샵 · shopping_mall v3.4

Vue 3(고객몰·관리자) + Express API + MariaDB. **로컬 설치·실행** 안내입니다.

> [준비 사항](#준비-사항) 확인 후 [빠른 시작](#빠른-시작) **1~7단계**를 순서대로 진행하세요.  
> VS Code는 **Run Task**에서 `★ VS Code: 처음 설치` 또는 `★ VS Code: 로컬 실행 (빌드+스택+고객몰)`을 사용할 수 있습니다.

## 프로젝트 구조

```text
shopping_mall/
├── client/   # 고객몰
├── admin/    # 관리자
├── server/   # API·DB
├── deploy/   # Nginx·운영 설정
└── scripts/  # 로컬 게이트웨이·스택 실행
```

## 준비 사항

| 항목 | 요구 |
| --- | --- |
| Node.js | 22.12+ |
| MariaDB | 11.4 (실행 중) |
| `server/.env` | `server/.env.example` 복사 후 직접 작성 (저장소·ZIP에 없음) |

## 빠른 시작

명령은 **프로젝트 루트**에서 실행합니다.

### 1. MariaDB

```sql
CREATE DATABASE IF NOT EXISTS bukang_shop_dev
  CHARACTER SET utf8mb4 COLLATE utf8mb4_bin;
CREATE USER IF NOT EXISTS 'bukang'@'127.0.0.1' IDENTIFIED BY '여기에_강력한_비밀번호';
GRANT ALL PRIVILEGES ON bukang_shop_dev.* TO 'bukang'@'127.0.0.1';
```

### 2. `server/.env`

```powershell
Copy-Item server\.env.example server\.env   # Windows
```

```sh
cp server/.env.example server/.env          # macOS / Linux
```

필수: `MARIADB_URI`, `DEV_MARIADB_URI`, `JWT_SECRET`, `JWT_REFRESH_SECRET` (서로 다른 랜덤 값).

```sh
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

### 3. 설치 및 실행

```sh
npm ci                    # 또는 npm install
npm run db:init
npm run seed:dev          # 선택
npm run admin:dev         # 선택, 기본 관리자 ID mekang1223
npm run build:local
npm run start-all
```

스택 재시작 전 `npm run stop-local` (포트 점유 시).  
코드 수정 후에는 **`build:local` → `start-all`**.  
404·50x·API JSON: VS Code `★ VS Code: 고객몰 404·오류 페이지 반영`, `★ VS Code: API 오류 JSON 반영`.

## 접속 주소

| 서비스 | 주소 |
| --- | --- |
| 고객몰 | http://127.0.0.1:8080 |
| 관리자 | http://localhost:9081/login (Windows 기본; macOS/Linux는 로그상 8081일 수 있음) |
| API | 내부 5002 — 브라우저는 각 사이트의 `/api` 사용 |

```text
브라우저 → 게이트웨이(8080 / 9081) → Express(5002) → MariaDB(3306)
```

`npm run dev:shop` / `dev:admin`은 Vite 개발용입니다. IP 제한·프록시 동작은 `start-all` 기준으로 확인하세요.

비밀번호 재설정(로컬): `RESET_MAIL_MODE=local`이면 링크는 `server/.local-mail`에 저장됩니다. **8025 웹 메일함**은 기본으로 뜨지 않으며, 필요할 때만 `server/.env`에 `LOCAL_MAILBOX=1`을 넣고 `start-all` 하세요.

## 문제 해결

| 증상 | 조치 |
| --- | --- |
| `MARIADB_URI` 오류 | `server/.env` 생성·URI 확인 |
| MariaDB 연결 실패 | DB 서비스·계정·DB 이름 확인 |
| 빈 화면 | `npm run build:local` |
| 없는 고객몰 URL | NotFound 화면(정상) |
| API 502 | Express 실행 여부; `/api/*`는 JSON 오류 |
| `EADDRINUSE` | `npm run stop-local` |
| 관리자 접속 불가 | 로그의 관리자 포트·루프백(127.0.0.1) 확인 |

관리자 비밀번호 재설정: `npm run admin:reset-password` (VS Code: `Admin: reset password`).

## 테스트

```sh
npm test
npm run test:http-errors   # 404·502 JSON (Express·게이트웨이)
npm run test:mariadb       # TEST_MARIADB_URI 전용 DB만, 초기화됨
```

## 운영 배포

기본 설정은 **로컬용**입니다. 공개 운영 전 TLS·관리자 접근 제한(VPN/IP)·`.env`·시드 스크립트 미사용·HTTPS 검증을 별도로 준비하세요. Nginx 예시는 `deploy/` (고객몰 `shop.conf`, 관리자 `admin.conf`, [관리자-접근-설정.md](./deploy/관리자-접근-설정.md)).
