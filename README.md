# Dorm Laundry Monitor

기숙사 공용 세탁기를 QR로 열고 상태를 확인하는 모바일 우선 PWA MVP입니다. 완료 Push는 해당 세탁 세션의 사용자 구독에만 전송합니다. 실제 센서는 아직 연결하지 않고 Hardware Simulator가 backend 이벤트 API와 같은 상태 서비스를 호출합니다.

## Architecture

```text
PWA (사용자 UI, Service Worker, Push subscription)
        ↓
Next.js / Vercel (API, state machine, Push, Device API)
        ↓
Neon PostgreSQL (Drizzle schema/migration)

Hardware Simulator ─┐
                    ├→ Device event API → washer event service
ESP32 (추후 연결) ──┘
```

Simulator 및 향후 ESP32는 같은 washer service/state machine 경로를 이용합니다. Device API는 `POST /api/device/washers/:washerId/event`이며 `Authorization: Bearer <DEVICE_API_SECRET>`을 요구합니다.

## Stack

Next.js App Router, TypeScript, Tailwind CSS, Lucide, Neon PostgreSQL, Drizzle ORM, Zod, Web Push (`web-push`), Service Worker.

## Environment

`.env.example`을 `.env.local`로 복사하고 아래 값을 채웁니다. secret은 client bundle에 들어가지 않도록 `NEXT_PUBLIC_` 접두사를 사용하지 않습니다(VAPID public key만 예외).

| 변수 | 용도 |
|---|---|
| `DATABASE_URL` | Neon PostgreSQL 연결 URL |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | 브라우저 Push 구독용 공개 키 |
| `VAPID_PRIVATE_KEY` | 서버 Push 서명 키 |
| `VAPID_SUBJECT` | `mailto:` 또는 서비스 URL |
| `DEVICE_API_SECRET` | ESP32/내부 reminder endpoint Bearer 인증 |
| `ADMIN_PASSWORD` | 운영 시뮬레이터 보호 비밀번호 |

VAPID 키는 `npm run push:vapid`로 생성합니다. 공개 키와 개인 키 쌍을 각각 환경변수에 저장하세요.

## Local development

```bash
npm install
Copy-Item .env.example .env.local
npm run db:migrate
npm run db:seed
npm run dev
```

기본 Washer ID는 `1`, `2`이며 QR 링크는 `/washer/1`, `/washer/2`입니다. 운영 도구는 `/admin`, 시뮬레이터는 `/admin/simulator`입니다. Simulator와 QR 생성 화면은 `ADMIN_PASSWORD`로 보호됩니다. 운영 도구에 로그인한 뒤 세탁기별 QR을 PNG로 저장하거나 안내 카드를 한 번에 인쇄해 세탁기 앞에 붙일 수 있습니다. 사용자는 앱을 처음 열었을 때 이름과 학번을 한 번 등록하고, 이후 QR을 스캔해 세탁기를 예약합니다. 학번은 DB에 저장하며 공개 화면에는 표시하지 않습니다.

## Neon setup

Neon에서 PostgreSQL 프로젝트를 만들고 연결 문자열을 `DATABASE_URL`에 입력합니다. `npm run db:migrate`는 `drizzle/0000_initial.sql`을 적용하고 세탁기 2대를 seed합니다. `npm run db:seed`는 해당 세탁기 행이 없는 경우 추가합니다. 스키마 변경은 Drizzle schema와 migration SQL을 함께 갱신합니다.

## Push setup

1. VAPID 키를 생성하고 Vercel 환경변수에 저장합니다.
2. HTTPS로 배포합니다. 로컬 개발의 localhost도 Service Worker 테스트에 사용할 수 있습니다.
3. 앱 첫 실행 때 이름과 학번을 입력하고 **등록하고 시작하기**를 누르면 알림 권한을 요청하고, 허용한 경우 이 기기의 Push 구독을 저장합니다.
4. iPhone/iPad는 Safari 공유 메뉴에서 **홈 화면에 추가**한 뒤 설치된 앱을 열어 등록해야 Push 권한을 요청할 수 있습니다.
5. `/admin/simulator`에서 테스트 사용자를 만들고 시뮬레이션을 실행합니다. FINISHED 전이는 활성 세션의 사용자 구독만 대상으로 전송합니다.

기기가 offline/expired subscription 응답(410)을 보내면 해당 구독은 제거됩니다. 배달 확인 여부는 Push 서비스 제공자와 OS 설정에 좌우됩니다.

## Vercel deployment

Production: https://iotwashingmachine.vercel.app

`vercel.json`은 Vercel Functions를 싱가포르(`sin1`)에서 실행하도록 설정합니다. Vercel 환경에는 `DATABASE_URL`, VAPID 변수, `DEVICE_API_SECRET`, `ADMIN_PASSWORD`가 필요합니다. 실제 도메인 HTTPS에서 PWA 설치 및 Push 구독을 확인합니다. 내부 reminder endpoint는 `POST /api/internal/process-reminders`이며 `DEVICE_API_SECRET` bearer 인증을 사용합니다. Vercel Cron/worker가 자동 실행된다고 가정하지 않습니다.

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

- Neon/VAPID 계정과 실제 스마트폰은 실행 환경 외부에서 제공해야 합니다. 이 저장소만으로 실기기 Push 전달을 확인할 수는 없습니다.
- Device API의 Bearer shared secret은 기본 인증 경계입니다. 실 배포 전 장치별 키/회전과 rate limiting을 추가하는 것이 좋습니다.
- 네트워크 mutation은 offline 상태에서 실행하지 않으며, 화면은 서버 polling으로 갱신됩니다.
