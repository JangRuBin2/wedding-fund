# 결혼자금 대시보드

갤럭시에 뜨는 카드·은행 결제 알림을 자동으로 긁어서, 지출/수입/목표 페이스/소비 패턴을 대시보드로 보여주는 개인용 가계부.

```
[갤럭시] 카드앱 푸시 / 문자 / 카톡 알림톡
   │  NotificationListenerService (네이티브, 앱 꺼져 있어도 동작)
   │  1차 필터: "금액+원" & "승인/결제/입금…" 둘 다 있을 때만
   ▼
[서버] POST /api/ingest  (Bearer INGEST_TOKEN)
   │  파서 → 중복 제거(푸시+문자 이중 수신) → 취소 매칭 → 카테고리 분류(학습 규칙 → 키워드 → Gemini)
   │  큰 결제면 "목표 N일 밀림" 넛지 응답 → 폰에 알림
   ▼
[대시보드] Next.js — 홈 / 내역 / 패턴 / 주간 피드백 / 설정
```

```
server/   Next.js 15 + Prisma 7 + Postgres  (대시보드 + API + 파서 + 분석)
app/      Expo SDK 58 + 로컬 네이티브 모듈 modules/payment-listener (Kotlin)
```

---

## 1. 서버

### 배포: Vercel + Neon (무료)

1. [vercel.com](https://vercel.com)에 GitHub로 로그인 → **Add New → Project** → 이 레포 Import
2. **Root Directory를 `server`로** 지정 (Framework는 Next.js 자동 인식)
3. Environment Variables에 추가 (값은 `openssl rand -hex 32` 등으로 길고 랜덤하게)
   - `INGEST_TOKEN` — 폰 앱에 넣을 토큰
   - `DASHBOARD_PASSWORD` — 대시보드 비밀번호 (브라우저 로그인 창, 아이디는 아무거나)
   - `CRON_SECRET` — 주간 피드백 크론용
   - `GEMINI_API_KEY` — (선택)
4. 첫 배포는 DB가 없어서 실패해도 괜찮음. 프로젝트 → **Storage → Create Database → Neon (Postgres)** → 이 프로젝트에 연결
   → `DATABASE_URL` / `DATABASE_URL_UNPOOLED`가 자동으로 들어감
5. **Deployments → 최신 배포 ⋯ → Redeploy**. 빌드할 때 `prisma db push`가 테이블을 자동으로 만듦 (스키마가 바뀌어도 푸시하면 반영, 데이터가 지워지는 변경이면 빌드가 멈춰서 안전)
6. 나온 주소 `https://xxx.vercel.app`를 폰 앱의 서버 주소에 넣으면 끝

주간 피드백은 `server/vercel.json`의 Vercel Cron이 매주 월요일 아침(08:41 KST 근처, 무료 플랜은 그 시간대 안에서 아무 때나) 자동 호출. `CRON_SECRET`만 넣어두면 Vercel이 알아서 인증 헤더를 붙임.

### 로컬 개발

```bash
cd server
npm install
cp .env.example .env          # DATABASE_URL에 Neon 주소(개발용 브랜치 추천) 또는 로컬 Postgres
npm run db:push               # DB 테이블 생성 (스키마 바뀌면 다시 실행)
npm run db:seed               # (선택) 4개월치 데모 데이터. 지우려면 npx prisma db push --force-reset
npm run dev                   # http://localhost:3000
```

Vercel 말고 홈서버에 올려도 됨: Postgres 하나 띄우고 `npm run build && npm start` + Cloudflare Tunnel로 https 연결.
그때 주간 피드백 크론은 직접 등록:
```cron
41 8 * * 1  curl -s -H "Authorization: Bearer $CRON_SECRET" https://money.내도메인/api/cron/weekly-feedback
```

`GEMINI_API_KEY` 있으면 Gemini가 직설 피드백 + 모르는 가맹점 자동 분류. 없으면 규칙 기반으로 동작.
키는 [Google AI Studio](https://aistudio.google.com/apikey)에서 카드 없이 무료 발급(프리티어). 한도(429)에 걸리면 그 호출만 규칙 기반으로 폴백하고, 분류 실패한 가맹점은 다음 결제 때 다시 시도함.
프리티어는 입력·출력이 Google 모델 개선에 쓰일 수 있음 (가맹점명·금액 통계가 넘어감).

## 2. 안드로이드 앱

**그냥 설치만 할 거면:** 레포 [Releases](../../releases)에서 최신 `apk-*`의 `wedding-fund.apk`를 폰으로 받아서 설치 (출처를 알 수 없는 앱 허용 필요).
`app/`이 main에 푸시되면 GitHub Actions가 자동으로 새 APK를 올림.

직접 빌드하려면 — 알림 리스너는 커스텀 네이티브 코드라 Expo Go로는 안 되고 직접 빌드해야 함.

```bash
cd app
npm install
npx expo run:android          # USB 연결된 갤럭시에 바로 설치 (Android Studio/SDK 필요)
# 또는 PC에 SDK 없으면:
npx eas build -p android --profile preview   # 클라우드에서 APK 빌드 → 폰에 설치
```

폰에서:
1. 앱 열고 **알림 접근 허용** (설정 화면으로 이동함)
2. **배터리 최적화 제외** — 갤럭시는 이거 안 하면 며칠 뒤 수집이 끊김
3. 서버 주소 + 토큰 + 이름 입력 → "저장하고 연결 테스트"
4. 카드 한 번 긁어보고 앱의 "최근 전송 기록" / 대시보드 설정 탭의 "최근 받은 알림 원문" 확인

카드사 알림은 문자보다 **카드사 앱 푸시**가 잘 잡힘 (무료). 문자 알림 서비스는 유료라 안 켜도 됨.

## 3. 파서 튜닝

카드사마다 문구가 조금씩 달라서 처음엔 몇 건 안 잡힐 수 있음.
1. 대시보드 **설정 → 최근 받은 알림 원문**에서 `SKIPPED`인데 결제 알림인 거 찾기
2. 원문을 `server/scripts/test-parser.ts`에 케이스로 추가
3. `server/src/lib/parser.ts` 고치고 `npm run test:parser` 통과 확인

파서가 애매하게 잡은 건 **확인 필요**로 들어가니까 내역 탭에서 가맹점/카테고리 고쳐주면 됨. "이 가맹점은 앞으로도 이 카테고리로" 체크하면 과거 건까지 일괄 변경 + 이후 자동 적용.

## 기능

- **결혼 예산표** (결혼준비 탭): 항목별 예산·낸 돈·잔금일. 다가오는 잔금은 홈에 뜨고, 목표 금액을 예산 합계로 맞출 수 있음
- **결혼준비 결제는 낭비가 아님**: 카테고리가 결혼준비인 결제는 생활비·하루 권장액·패턴·큰 지출 알림에서 빠지고, 목표 진행에는 '이미 쓴 결혼자금'으로 더해짐
- **저축 이동 자동 제외**: 적금·청약·증권 계좌로 보낸 돈은 '저축'으로 분류돼 지출로 안 잡힘
- **오늘 더 쓸 수 있는 돈**: (예상 수입 − 월 목표 저축 − 고정비 − 이번 달 쓴 돈) ÷ 남은 날

- **목표 트래커**: 모은 돈 = 이미 모아둔 돈 + 시작일 이후 (수입 − 지출). 매달 필요 저축액, 최근 90일 페이스 기준 달성 예상일
- **하루 생활비 차트**: 고정비 뺀 변동 생활비만. 하루 몫 넘은 날은 빨간 막대
- **패턴**: 요일×시간 히트맵, 심야(23~4시) 소비, 평일/주말 하루 평균, 카테고리별 평소 대비 증감
- **고정비·구독 자동 탐지**: 2개월 이상 같은 가맹점·비슷한 금액·비슷한 날짜
- **충동구매 넛지**: 설정 금액 이상 결제 시 "목표 약 N일 밀림" 폰 알림
- **커플 공유**: 각자 폰에 앱 깔고 이름만 다르게 → 홈에 각자 기여분 표시
- **중복/취소 처리**: 같은 결제가 앱 푸시+문자로 오면 1건으로, 승인취소는 원 결제에 취소 표시
- 자동으로 못 잡은 내 계좌 간 이체는 내역에서 카테고리를 **저축**으로 바꾸면 집계 제외됨

## 보안

- 알림 원문(카드 끝 4자리, 마스킹된 이름 포함)이 서버 DB에 저장됨 → 서버는 본인만 접근하게
- 대시보드 Basic Auth(`DASHBOARD_PASSWORD`), 수집 API는 `INGEST_TOKEN` 별도
- 폰 앱은 금액+결제 키워드 없는 알림은 아예 안 보냄. 카톡은 카드사/은행 채널만
