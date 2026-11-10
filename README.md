# 부캉이 굿즈샵 · shopping_mall_v3.3

고객몰·관리자·API를 분리한 Vue 3 + Express + MariaDB 쇼핑몰입니다. 기존 ZIP과 별개로 R1·R2 요구사항을 반영한 수정본입니다.

| 폴더 | 역할 |
|---|---|
| client/ | 고객 전용 Vue 앱. 관리자 화면·관리자 진입 링크를 포함하지 않음 |
| admin/ | 임직원 전용 Vue 앱. 별도 로그인 → 상품·주문·게시판 관리 |
| server/ | 회원·상품·장바구니·주문·게시판 API와 MariaDB 처리 |
| deploy/ | 고객·관리자 Nginx, IP 허용 목록, 서버 직접 배포 설정 |
| scripts/ | 분리된 정적 웹과 API의 로컬 실행 도구 |

## 로컬 실행

### 준비물

- **Node.js** 22.12 이상
- **MariaDB** 11.4 (서비스 실행 중이어야 함)

ZIP·Git으로 받으면 **`server/.env`는 없습니다.** 비밀번호·JWT는 저장소에 넣지 않기 때문에 **자동 생성되지 않으며**, 아래 **3단계**에서 직접 만들어야 합니다. (`*.env.example`만 포함됩니다.)

### 처음 설치 순서 (이 순서대로)

**1. MariaDB에 DB·계정 준비** (한 번만)

MariaDB에 로그인한 뒤, 예시는 아래와 같습니다. 이름·비밀번호는 팀에서 정한 값으로 바꿉니다.

```sql
CREATE DATABASE IF NOT EXISTS bukang_shop_demo CHARACTER SET utf8mb4 COLLATE utf8mb4_bin;
CREATE USER IF NOT EXISTS 'bukang'@'localhost' IDENTIFIED BY '여기에_비밀번호';
GRANT ALL ON bukang_shop_demo.* TO 'bukang'@'localhost';
FLUSH PRIVILEGES;
```

**2. `server/.env` 만들기** (없으면 `db:init`·`start-all` 모두 실패)

프로젝트 **루트**에서:

```powershell
# Windows (PowerShell)
Copy-Item server\.env.example server\.env
```

```sh
# macOS / Linux
cp server/.env.example server/.env
```

`server/.env`를 열고 **최소한** 다음을 채웁니다.

| 항목 | 설명 |
|------|------|
| `MARIADB_URI` | `mariadb://계정:비밀번호@127.0.0.1:3306/bukang_shop_demo` 형식 |
| `DEMO_MARIADB_URI` | 데모 시드용. 보통 `MARIADB_URI`와 같은 DB |
| `JWT_SECRET` | 아무 긴 임의 문자열 (비어 있으면 로그인 실패) |
| `JWT_REFRESH_SECRET` | `JWT_SECRET`과 **다른** 임의 문자열 |

`client/.env`, `admin/.env`는 **로컬 웹 스택(`start-all`)만 쓸 때는 없어도 됩니다.** (브라우저가 각 사이트의 `/api`로 요청합니다.)

**3. 패키지 설치** (프로젝트 루트)

```sh
npm ci
```

(`package-lock.json`이 없거나 오류면 `npm install`)

**4. DB 테이블 생성**

```sh
npm run db:init
```

`MariaDB 연결 성공` 또는 에러 메시지가 나옵니다. `MARIADB_URI` 오류면 2단계를 다시 확인합니다.

**5. 데모 데이터·관리자 계정** (선택이지만 처음엔 권장)

```sh
npm run seed:demo
npm run admin:demo
```

`admin:demo`가 터미널에 **아이디 `demoAdmin`과 로그인 비밀번호**를 한 번 출력합니다. 메모해 두세요. (파일에 저장되지 않습니다.)

**6. 고객몰·관리자 빌드**

```sh
npm run build:local
```

`client/dist`, `admin/dist`가 없으면 `start-all` 후 화면이 비거나 404가 납니다.

**7. 웹 스택 실행**

```sh
npm run start-all
```

이 터미널을 **켜 둔 채** 사용합니다. 종료는 **Ctrl+C**.

| 접속 | 주소 |
|------|------|
| 고객몰 | http://127.0.0.1:8080 |
| 관리자 로그인 | http://localhost:9081/login (Windows 기본 포트 **9081**. macOS/Linux는 8081일 수 있음) |
| 로컬 메일함 | http://127.0.0.1:8025 |
| API | 127.0.0.1:5002 (브라우저는 직접 열지 않고, 각 웹의 `/api` 프록시 사용) |

코드를 수정했으면 **6→7**을 다시 하거나 VS Code 작업 **★ VS Code: 로컬 실행 (빌드+스택+고객몰)** 을 사용합니다.

### 자주 안 되는 이유

| 증상 | 원인 | 조치 |
|------|------|------|
| `MARIADB_URI를 … 설정해주세요` | `server/.env` 없음 또는 URI 비어 있음 | 2단계 복사·수정 |
| MariaDB 연결 실패 | DB·계정·비밀번호 불일치, MariaDB 미실행 | 1·2단계, Windows 서비스에서 MariaDB 확인 |
| 로그인·API 403/500 | `JWT_SECRET` 비어 있음 | `.env`에 JWT 두 값 입력 후 `start-all` 재시작 |
| 빈 페이지·404 | `dist` 없음 | `npm run build:local` 후 재실행 |
| 포트 사용 중 | 8080/9081/5002 점유 | 다른 터미널 `npm run stop-local` 또는 `LOCAL_*_PORT` 변경 |

관리자 비밀번호를 잊었으면: `npm run admin:reset-password` (VS Code **Admin: reset password** 작업 동일).

### 동작 방식 (요약)

빌드된 정적 파일을 Node **웹 게이트웨이**(고객/관리자)가 제공하고, API는 별도 Express가 담당합니다. 관리자 사이트는 기본적으로 **루프백(127.0.0.1)** 만 허용합니다. 운영 Nginx 설정은 `deploy/`에 있습니다. 화면만 빠르게 볼 때는 `npm run dev:shop` / `dev:admin`(Vite)을 쓸 수 있으나, **IP 제한·운영과 동일한 경로 검증**은 `start-all` 기준입니다.

## 기능과 데이터

캐러셀 3종, 굿즈 7종, 상품 사진 28장과 부캉이 캐릭터 사진을 포함합니다. 상품·가격은 API에서 조회하며 `regular`·`always`·`event` 가격 모드를 유지합니다. 관리자 저장 후 고객 탭 복귀·포커스·30초 주기 조회로 가격이 갱신됩니다.

관리 기능은 관리자 역할과 15분 재인증 세션을 모두 검사합니다. 동일 비밀번호를 다시 확인하는 방식이며 OTP 인증은 아닙니다. 게시판의 작성자·비밀글·관리자 권한 검사와 주문 재고 트랜잭션을 유지합니다. 실제 결제·메일 발송은 별도 서비스 설정이 필요합니다.

## 운영 배포와 요구사항

- [개정 이력](개정이력.md) (v1.0 ~ v3.3)
- [TLS·사내망·VPN·허용 IP 설정 및 서버 배포](deploy/운영배포.md)
- [관리자 IP 허용 목록](deploy/nginx/admin-allowlist.conf)
- 상품 7종 데이터: server/data/demo-products.json

실제 도메인·인증서·허용 IP가 주어지지 않아 외부 배포나 VPN 서버 설치는 수행하지 않았습니다. 기본 운영 구성은 루프백에만 바인딩하고 관리자 허용 목록도 기본 차단이므로 실제 환경의 값을 설정해야 합니다. API·DB는 호스트에 직접 공개하지 않습니다.

## 검증

```sh

npm test
npm run build
npm run test:mariadb
```

MariaDB 통합 테스트는 `TEST_MARIADB_URI`에 애플리케이션 DB와 다른 `_test_demo` 전용 DB를 지정해야 하며 해당 테스트 DB의 데이터를 초기화합니다. 일반 DB에는 실행하지 않습니다.

기반 v3.1 기능 검증 기록: MariaDB 통합·단위 테스트 104개 통과(실패·생략 0), 고객/관리자 각각 빌드 통과, 실제 Nginx TLS·정적 사진·API·IP 차단 13개 검사 통과, 관리자 로그인·재인증·상품 목록 브라우저 확인.

공유 ZIP에는 .env, 인증서 개인키, DB 파일, node_modules, dist를 포함하지 않습니다. 상품 원본 사진과 캐러셀 PNG는 포함합니다.

## v3.2 · 2026.11.07

로고를 캐릭터 이미지 + 부캉이로 간소화하고 브랜드 색상을 #122551로 조정했습니다. 메뉴는 데스크톱 18px, 모바일 16px로 키웠으며 작은 본문·상품·게시판·폼·푸터 글자와 대비도 개선했습니다. 캐러셀 아래의 별표 멘트 영역은 삭제했습니다. 고객·관리자·API 분리 구조는 유지합니다.

추가 반영: 상품 버튼을 바로 구매·장바구니 담기·찜하기로 변경하고 캐러셀 자동 재생 정지 아이콘을 ■로 변경했습니다. 고객몰 빌드와 브라우저 표시를 확인했습니다.

## 색상 옵션 추가

티셔츠는 화이트·블랙, 봉제 인형·인형 키링은 블루·핑크로 선택합니다. 선택 색상에 맞는 대표 사진이 표시되며 티셔츠 사이즈는 S → M → L → XL 순입니다. 상품 카드의 OPTIONS 개수 표시는 제거했습니다.

신규 DB는 seed:demo로 7개 상품·10개 색상·16개 사이즈별 재고 행을 생성합니다. 기존 데모 DB에는 .env의 DEMO_MARIADB_URI가 원하는 DB인지 확인한 다음 `npm run options:update`를 한 번 실행합니다. 기존 상품 ID·가격·남은 재고를 유지하며 누락된 색상·재고만 추가합니다. 반복 실행해도 기존 재고를 초기화하지 않습니다. 운영 DB에 대한 자동 이관은 이 데모 명령으로 수행하지 않습니다.

검증: MariaDB 통합·단위 테스트 106개 통과, 고객몰 빌드 통과, 세 상품의 색상 선택·사진 전환 및 티셔츠 사이즈 순서를 브라우저로 확인했습니다.

## 비밀번호 재설정 메일과 배송지 수정

`npm run start-all`의 로컬 개발 실행은 기본적으로 RESET_MAIL_MODE=local로 동작하며, 실제 이메일을 보내지 않고 http://127.0.0.1:8025/ 메일함에 저장합니다. 회원가입 시 입력한 이름(아이디가 아님)과 등록 이메일 또는 휴대폰 번호로 재설정 링크를 요청한 뒤 이 메일함을 열면 됩니다. 동일 계정의 요청은 60초 간격으로 제한되며 링크는 15분 동안 한 번만 사용할 수 있습니다. 현재 미리보기 실행 주소는 고객몰 8082, 관리자 8083입니다.

로컬 메일함은 루프백 주소에서만 열리며, 메일은 server/.local-mail/에 보관합니다. 만료 메일을 정리하고 최대 50개로 제한합니다. 이 폴더는 ZIP과 Git에서 제외합니다. 메일함에는 재설정 링크가 들어 있으므로 외부에 공개하지 않습니다. 운영 환경에서는 로컬 메일 모드를 사용할 수 없습니다.

실제 이메일로 발송하려면 server/.env에서 RESET_MAIL_MODE=smtp와 SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM을 설정하고 FRONTEND_URL을 실제 사이트 주소로 지정합니다. 운영 Compose에서는 루트 .env의 SMTP 값을 주입하며 모드는 smtp로 고정됩니다. 발송 계정이 제공되지 않아 실제 외부 SMTP 발송은 연결하지 않았습니다.

마이페이지 → 배송지 관리 → 배송지 수정에서 받는 분·연락처·우편번호·기본/상세 주소를 수정할 수 있습니다. 회원 이름·연락처·가입 주소는 그대로 두고 별도의 기본 배송지로 저장합니다. 새 주문에는 수정한 배송지가 기본 입력되며 이미 접수된 주문은 바뀌지 않습니다. User.shippingAddress JSON 열은 API 시작 시 멱등적으로 추가하고 기존 데이터를 보존합니다.

검증: 통합·단위 테스트 112개 통과(실패·생략 0), 고객몰 빌드 통과. 배송지 소유권·회원정보 보존·입력 검증, 로컬 메일 캡처·메일함 접근 제한·운영 모드 차단, 실제 HTTP 재설정 요청→메일 링크→새 비밀번호 로그인→토큰 재사용 거부를 검증했습니다. 관리자 비밀번호 변경과 새 비밀번호 재인증도 로컬 실행에서 확인했습니다. 비밀번호 평문이나 로컬 메일은 공유 ZIP에 넣지 않습니다.

## v3.3 · 2026.11.09

찜(위시리스트), 관리자 1·2차 비밀번호 분리, 로컬 테스트 결제, 장바구니 수량 변경 수정, VS Code 로컬 실행 작업 등 상세 항목은 [개정 이력](개정이력.md) v3.3 행을 참고합니다.

로컬 실행은 `npm run build:local` 후 `npm run start-all` 또는 VS Code 작업 **★ VS Code: 로컬 실행 (빌드+스택+고객몰)** 을 사용합니다. Windows 기본 관리자 포트는 9081입니다.
