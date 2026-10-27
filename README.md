# Dorm Laundry Monitor

기숙사 공용 세탁기를 QR로 열고 상태를 확인하는 모바일 우선 PWA MVP입니다. 완료 Push는 해당 세탁 세션의 사용자 구독에만 전송합니다. 실제 센서는 아직 연결하지 않고 Hardware Simulator가 backend 이벤트 API와 같은 상태 서비스를 호출합니다.

## Architecture

```text
PWA (사용자 UI, Service Worker, Push subscription)
        ↓
Next.js server in Docker (API, state machine, Push, Device API, reminder scheduler)
        ↓
PostgreSQL (Drizzle schema, SQL migrations)

Hardware Simulator ─┐
                    ├→ Device event API → washer event service
ESP32 (추후 연결) ──┘
```

Simulator 및 향후 ESP32는 같은 washer service/state machine 경로를 이용합니다. Device API는 `POST /api/device/washers/:washerId/event`이며 `Authorization: Bearer <DEVICE_API_SECRET>`을 요구합니다.

## Hardware plan (스마트 세탁실)

아직 구현 전인 계획입니다. 세탁기 노드는 기존 Device API를 그대로 쓰고, 서버에 새로 필요한 것은 현황판용 읽기 API 하나입니다.

| 장치 | 수량 | 구성 | 역할 |
|---|---|---|---|
| 세탁기 노드 | 2 | ESP32, MPU6050(진동), I2C LCD 16x2, 상태 LED 3색, 수거 확인 버튼, 진동 모터(+ 2N2222A, 1N4007) | 진동으로 시작·종료를 판정해 Device API로 전송하고 LCD·LED로 현장에 표시 |
| 서보 도어락 | 세탁기 노드마다 1 | SG90 서보 + 리드 스위치(문 열림 감지) | 세탁 중 잠금, 완료 시 해제, 문 열림 시 주인에게 알림 |
| 스피커 | 세탁기 노드마다 1 | PAM8403 앰프(ESP32 DAC GPIO25) + 3W 8Ω 스피커 | 완료 시 멜로디 |
| 층별 현황판 | 1 | ESP32 + ILI9341 2.8인치 터치 TFT | 서버 상태를 5초마다 받아 표시 |
| 예비 | 1 | ESP32 | 고장 대비, 펌웨어 개발용 |

진동 모터는 발표용으로 세탁기 진동을 흉내 내는 용도이고, 센서와 같은 판에 고정합니다. 케이스는 3D 프린팅입니다. 1호기와 2호기는 부품과 기능이 완전히 같고 서버의 `washerId`만 다릅니다.

배선도: 전체 [docs/wiring-system.svg](docs/wiring-system.svg), 세탁기 노드 상세 [docs/wiring-washer-node.svg](docs/wiring-washer-node.svg). ESP32는 노드 2대와 현황판 1대가 각각 독립이고, 세탁기는 장난감 없이 3D 프린팅 케이스에 실제 진동 모터를 넣어 시연합니다.

| ESP32 | 연결 |
|---|---|
| GPIO21 / GPIO22 | I2C SDA / SCL (MPU6050, LCD1602) |
| GPIO23 | 리드 스위치 (INPUT_PULLUP, 반대쪽 GND) |
| GPIO19 | 수거 버튼 (INPUT_PULLUP, 반대쪽 GND) |
| GPIO16 / 17 / 18 | 빨강 / 노랑 / 초록 LED (각 220Ω) |
| GPIO27 | 1kΩ → 2N2222A 베이스 (진동 모터, 모터 전원은 3V3) |
| GPIO13 | SG90 서보 신호 (전원 5V, 1000µF) |
| GPIO25 | PAM8403 입력 (DAC) |
| VIN(5V) / 3V3 / GND | 서보·앰프·LCD / MPU6050·모터 / 공통 |

### 현황판 화면

```text
기본 화면                          세탁기를 누르면
┌───────────────────────┐          ┌───────────────────────┐
│       YYYY-MM-DD      │          │  ┌─────────────────┐  │
│  사용 가능한 세탁기: N대 │          │  │ 세탁기 N         │  │
│                       │          │  │ 남은 세탁 시간:   │  │
│   [1]       [2]       │          │  │   N시간 N분      │  │
│  사용가능    사용중     │          │  │ N시 N분 종료예정  │  │
└───────────────────────┘          │  │     [닫기]       │  │
                                   │  └─────────────────┘  │
                                   └───────────────────────┘
```

- **상태 표시(제안):** `IDLE`은 사용가능, `RESERVED`·`RUNNING`·`MAYBE_FINISHED`는 사용중, `FINISHED`(수거 대기)는 사용불가로 보여줍니다.
- **개인정보:** 사용자 이름과 학번은 현황판에 표시하지 않습니다.
- **읽기 API:** `GET /api/display/washers`를 새로 만들고 장치 키로 보호합니다. 지금 `GET /api/washers`는 응답에 `currentUserId`가 들어 있고 `GET /api/overview`는 사용자 인증이 필요해서 현황판에 쓰지 않습니다. 남은 시간과 종료 예정 시각은 서버가 계산해 내려줍니다.

## Stack

Next.js App Router, TypeScript, Tailwind CSS, Lucide, PostgreSQL (`pg`), Drizzle ORM, Zod, Web Push (`web-push`), Service Worker.

## Environment

`.env.example`을 `.env.local`로 복사하고 아래 값을 채웁니다. secret은 client bundle에 들어가지 않도록 `NEXT_PUBLIC_` 접두사를 사용하지 않습니다(VAPID public key만 예외).

| 변수 | 용도 |
|---|---|
| `DATABASE_URL` | PostgreSQL 연결 URL (docker compose에서는 자동 설정) |
| `POSTGRES_PASSWORD` | docker compose의 DB 비밀번호 (`openssl rand -hex 24`) |
| `ENABLE_SCHEDULER` | `true`이면 서버가 1분마다 완료·수거 알림을 처리 (compose에서 자동 설정) |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | 브라우저 Push 구독용 공개 키 |
| `VAPID_PRIVATE_KEY` | 서버 Push 서명 키 |
| `VAPID_SUBJECT` | `mailto:` 또는 서비스 URL |
| `DEVICE_API_SECRET` | ESP32/내부 reminder endpoint Bearer 인증 |
| `ADMIN_PASSWORD` | 운영 시뮬레이터 보호 비밀번호 |

VAPID 키는 `npm run push:vapid`로 생성합니다. 공개 키와 개인 키 쌍을 각각 환경변수에 저장하세요.

## Local development

개발용 PostgreSQL이 필요합니다. 예: `docker run -d --name laundry-pg -p 5432:5432 -e POSTGRES_USER=laundry -e POSTGRES_PASSWORD=password -e POSTGRES_DB=laundry postgres:17-alpine` 후 `.env.example`의 기본 `DATABASE_URL`을 그대로 사용합니다.

```bash
npm install
cp .env.example .env.local   # Windows PowerShell: Copy-Item .env.example .env.local
npm run db:migrate
npm run db:seed
npm run dev
```

기본 Washer ID는 `1`, `2`이며 QR 링크는 `/washer/1`, `/washer/2`입니다. 운영 도구는 `/admin`, 시뮬레이터는 `/admin/simulator`입니다. Simulator와 QR 생성 화면은 `ADMIN_PASSWORD`로 보호됩니다. 운영 도구에 로그인한 뒤 세탁기별 QR을 PNG로 저장하거나 안내 카드를 한 번에 인쇄해 세탁기 앞에 붙일 수 있습니다. 사용자는 앱을 처음 열었을 때 이름과 학번을 한 번 등록하고, 이후 QR을 스캔해 세탁기를 예약합니다. 학번은 DB에 저장하며 공개 화면에는 표시하지 않습니다.

사용자 홈과 세탁기 상세 화면은 세탁 시작 시각을 기준으로 48분 세탁 과정을 12초로 압축해 진행률과 남은 분을 표시합니다. 사용자 화면에는 가속 사실을 표시하지 않으며, 완료 예정 시각은 실제 종료 예정 시각을 오전/오후 시·분 형식으로 보여줍니다. 종료 이벤트가 도착하기 전에는 예정 시각이 지나도 완료 상태로 바꾸지 않습니다. QR 스캔 화면은 카메라 스캔에 집중하며 세탁기 직접 선택은 홈과 세탁기 목록에서 할 수 있습니다.

## Device API (ESP32 contract)

기기는 아래 요청 하나로 상태를 보고합니다. `event`는 `START`, `ACTIVITY`, `NO_ACTIVITY`, `RESUME`, `FINISH`, `DOOR_OPEN`, `PICKUP`, `RESET` 중 하나이고, `sensors`와 `timestamp`(ISO 8601)는 선택입니다. 현재 상태에서 허용되지 않는 이벤트는 `409`로 거절되어 센서 오탐이 상태를 망가뜨리지 않습니다.

```bash
curl -X POST "$APP_URL/api/device/washers/1/event" \
  -H "Authorization: Bearer $DEVICE_API_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"event":"ACTIVITY","sensors":{"vibration":16,"current":0.42,"doorOpen":false}}'
```

`/admin/simulator`의 **기기 이벤트 직접 전송** 패널은 같은 endpoint를 호출하므로, 펌웨어를 만들기 전에 payload와 상태 전이를 그대로 검증할 수 있습니다. **대기 중인 알림 처리** 버튼은 스케줄러를 기다리지 않고 완료·수거 알림을 즉시 처리합니다.

## 뽀득이 (규칙 기반 세탁실 도우미)

사용자 화면 오른쪽 아래 마스코트 버튼으로 여는 도우미 **뽀득이**입니다. **LLM을 쓰지 않는 규칙 기반**이며, 추천 질문(남는 세탁기, 내 세탁 종료 시각, 세탁 추천 시간, 사용 방법)과 간단한 키워드 입력을 `POST /api/assistant`의 고정된 조회 함수로 연결합니다. 모든 숫자는 DB에서 계산하고, 이해하지 못한 질문은 추천 질문으로 안내합니다. 추천 시간은 최근 30일의 세탁 시작 시각을 한국 시간 기준 시간대별로 집계하며, 기록이 10건 미만이면 추천하지 않고 현재 상태를 대신 알려줍니다. 답변 로직은 `lib/assistant/answers.ts`(순수 함수)에 있어 `tests/assistant.test.ts`에서 검증합니다.

## 발표용 데모 데이터 (선택)

홈의 시간대별 혼잡도와 도우미의 추천 시간은 최근 30일 이용 기록으로 계산합니다. 새 DB는 기록이 없어 안내 문구만 보이므로, 시연 환경에서는 가상의 이용 기록을 채울 수 있습니다.

```bash
npm run db:seed-demo    # 최근 30일 가상 세탁 기록 약 100건 추가 (입실 시간 규칙 반영)
npm run db:clean-demo   # 위 스크립트가 만든 데이터만 삭제
# 서버 컨테이너에서: docker compose exec app node scripts/seed-demo.mjs [--clean]
```

가상 기록은 닉네임이 `[데모]`로 시작하는 사용자에 묶이며 실제 데이터는 건드리지 않습니다. 기숙사 입실 규칙(오전 입실 불가, 수요일 17:30부터, 그 외 요일 20:20부터)에 맞춰 시간대를 만들고, 요일별 이용량과 세탁기별 사용 시간이 겹치지 않도록 구성합니다.

## Quality checks

```bash
npm run lint && npm run typecheck && npm test && npm run build
```

`tests/`는 상태 머신 전이, 인증 비교, 에러 응답, 기기 payload 검증을 다룹니다. 같은 검사가 PR과 `main` push마다 GitHub Actions(`ci.yml`)에서 실행됩니다. `push-reminders.yml`의 호출 주소는 저장소 변수 `APP_URL`로 바꿀 수 있습니다.

## Database

`npm run db:migrate`는 `drizzle/*.sql`을 순서대로, 각각 트랜잭션으로 적용하며 이미 적용한 파일은 건너뜁니다(`app_migrations` 테이블). `npm run db:seed`는 같은 마이그레이션에 세탁기 1·2번 seed를 더합니다. 두 명령 모두 `.env.local`의 `DATABASE_URL`을 읽습니다. 스키마를 바꿀 때는 Drizzle schema와 migration SQL을 함께 갱신하세요. 컨테이너는 시작할 때마다 `scripts/migrate.mjs --seed`를 실행하므로 배포만 하면 스키마가 맞춰집니다.

## Push setup

1. VAPID 키를 생성하고 서버의 `.env`에 저장합니다.
2. HTTPS로 배포합니다. 로컬 개발의 localhost도 Service Worker 테스트에 사용할 수 있습니다.
3. 앱 첫 실행 때 이름과 학번을 입력하고 **등록하고 시작하기**를 누르면 알림 권한을 요청하고, 허용한 경우 이 기기의 Push 구독을 저장합니다.
4. iPhone/iPad는 Safari 공유 메뉴에서 **홈 화면에 추가**한 뒤 설치된 앱을 열어 등록해야 Push 권한을 요청할 수 있습니다.
5. `/admin/simulator`에서 앱 알림이 연결된 사용자를 선택해 등록한 뒤 세탁 시작을 누릅니다. 약 12초 뒤 자동 종료되며 해당 사용자에게 완료 알림이 전송됩니다. 수거 완료 전까지 종료 후 2분이 지나면 수거 알림을 한 번 전송합니다. 새 테스트 사용자는 Push 구독이 없어 앱에서 알림을 허용하기 전까지 알림을 받을 수 없습니다.

기기가 offline/expired subscription 응답(410)을 보내면 해당 구독은 제거됩니다. 배달 확인 여부는 Push 서비스 제공자와 OS 설정에 좌우됩니다.

## Self-hosted deployment (docker compose)

Ubuntu 서버에서 `docker compose`로 **앱 + PostgreSQL + 일일 백업** 세 컨테이너를 실행합니다. 외부에는 Cloudflare Tunnel이 HTTPS로 연결하므로 서버 포트를 인터넷에 열지 않습니다(앱은 `127.0.0.1:3000`에만 바인딩). PWA 설치와 Push는 HTTPS가 필요합니다.

```bash
cp .env.example .env        # POSTGRES_PASSWORD, VAPID, DEVICE_API_SECRET, ADMIN_PASSWORD 채우기
chmod 600 .env
docker compose up -d --build
docker compose logs -f app  # "Reminder scheduler started" 확인
```

- **"곧 끝나요" 알림:** 세탁이 시작되면 끝나기 5분 전(화면 기준, 시뮬레이터에서는 약 10.75초 뒤) 한 번 알려요. 서버 타이머가 정확한 시각에 보내고, 서버가 재시작돼 타이머가 사라져도 1분 주기 확인이 같은 알림을 놓치지 않고 한 번만 보냅니다.
- **알림 자동 처리:** `ENABLE_SCHEDULER=true`이면 앱 프로세스가 1분마다 완료 알림과 수거 리마인더(종료 2분 후)를 처리합니다(`instrumentation.ts`, `lib/washer/scheduler.ts`). 외부 cron이 필요 없고, 모든 처리는 중복 실행에도 안전합니다. 앱 컨테이너는 한 개만 실행하세요.
- **업데이트:** `git pull && docker compose up -d --build`. DB 볼륨(`db-data`)은 유지됩니다.
- **백업:** `backup` 컨테이너가 하루 한 번 `./backups/laundry-YYYY-MM-DD.dump`를 만들고 7일치를 보관합니다. 복원은 `docker compose exec -T db pg_restore -U laundry -d laundry --clean < backups/<파일>.dump`입니다.
- **Cloudflare Tunnel:** 이미 운영 중인 터널의 Public Hostname에 도메인을 추가하고 service를 앱 주소로 지정합니다(레코드가 같은 Cloudflare 계정에 있어야 합니다). 커넥터가 호스트에서 직접 실행되면 `http://localhost:3000`이면 되고, k3s 파드나 컨테이너처럼 다른 네트워크 네임스페이스에서 실행되면 서버 LAN IP(`http://<LAN IP>:3000`)를 쓰고 `.env`에 `APP_BIND=<LAN IP>`를 지정해 그 주소로 포트를 엽니다(기본값은 `127.0.0.1`).
- **수동 알림 처리:** `/admin/simulator`의 **대기 중인 알림 처리** 버튼, 또는 `POST /api/internal/process-reminders`(`DEVICE_API_SECRET` bearer 인증)로도 실행할 수 있습니다.

## PWA test checklist

### Android Chrome

- [ ] HTTPS 사이트 접속 및 홈 화면 설치
- [ ] 앱 첫 실행에서 이름/학번 등록 및 알림 허용
- [ ] 구독 저장과 설정의 테스트 Push 확인
- [ ] 앱을 닫고 테스트 Push 수신
- [ ] 알림 클릭 시 올바른 세탁기 화면 열기

### iOS Safari / Home Screen

- [ ] Safari 공유 메뉴에서 홈 화면에 추가
- [ ] 홈 화면 앱 첫 실행에서 이름/학번 등록 및 알림 허용
- [ ] Push 구독 저장과 테스트 Push 확인
- [ ] 앱을 닫고 Push 및 알림 클릭 확인

### Laundry flow

- [ ] Washer 1/2에 서로 다른 사용자 등록
- [ ] RESERVED → RUNNING → MAYBE_FINISHED → RUNNING 확인
- [ ] FINISHED에서 등록 사용자만 Push 수신
- [ ] 수거 처리 후 IDLE 확인

## Known MVP boundaries

- VAPID 키와 실제 스마트폰은 실행 환경 외부에서 제공해야 합니다. 이 저장소만으로 실기기 Push 전달을 확인할 수는 없습니다.
- Device API의 Bearer shared secret은 기본 인증 경계입니다. 실 배포 전 장치별 키/회전과 rate limiting을 추가하는 것이 좋습니다.
- 네트워크 mutation은 offline 상태에서 실행하지 않으며, 화면은 서버 polling으로 갱신됩니다.
