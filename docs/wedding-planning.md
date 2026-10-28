# 모아봄 결혼준비 기능 기획

> 함께 모으는 우리의 봄. 둘이 매주 열어 보는 결혼준비 탭을 목표로 해요.
> 참고 자료: 여자친구가 만든 구글시트(체크리스트·예산·메모 탭), 현재 코드(`server/src/lib/wedding.ts`, `server/src/app/wedding/page.tsx`, `server/src/app/actions.ts`, `server/prisma/schema.prisma`, `server/src/lib/goal.ts`)

## 요약

- 시트의 예산은 숫자 하나가 아니라 **최소 / 기준 / 최대 범위**로 잡혀 있어요. 관리 단위도 항목보다 작은 **세부 추가금**(원본, 야간 촬영, 헬퍼비 등)이고, 묶음 상한("스드메는 추가금까지 500만 이하")과 **식대 뺀 합계**를 함께 봐요.
- 지금 예산표에는 항목마다 예산 숫자가 하나뿐이에요. 범위, 세부 추가금, 상한, 식대 제외, 신랑측·신부측 구분, 체크리스트, 업체 후보가 모두 없어요. 자동으로 모은 결제도 '결혼준비' 합계로만 잡혀서, 어느 항목에 쓴 돈인지 알 수 없어요.
- **P0**는 세 가지예요. 시트와 같은 범위 예산표와 시트 템플릿, 20단계 체크리스트와 체크한 사람 기록, 결혼준비 결제를 세부항목에 연결하기.
- **P1**은 업체 후보 비교, 하객 수로 식대·청첩장 수량 계산, 양가 비용 따로 보기, 홈의 '이번 주 할 일' 카드예요. **P2**는 집·대출 비교와 하객 명단이에요.
- 1차 구현 범위는 범위 예산표, 시트 템플릿, 20단계 체크리스트, 체크한 사람 기록(기기별 쿠키)이에요. 2차는 결제 연결과 업체 후보예요.

## 1. 시트에서 드러난 실제 니즈

| # | 니즈 | 시트 근거 |
|---|---|---|
| N1 | **예산을 범위로 잡기**: 최소, 최대, 내 기준(목표치), 실제 비용을 따로 둬요 | 예산 탭의 열: 내 기준예산 / 최소 / 최대 / 비용(실제) |
| N2 | **세부 추가금 단위로 관리**: 패키지 가격보다 원본, 수정본, 야간 촬영, 헬퍼비 같은 추가금이 예산을 크게 흔들어요 | 스튜디오 세부 11줄, 드레스 5줄 |
| N3 | **묶음 상한**: "세부 기준 350~400, 추가금을 다 합쳐도 500 이하" | 메모 탭 |
| N4 | **식대 뺀 합계**: 식대는 축의금으로 상당 부분 돌아오니 따로 보고 싶어 해요 | 상단의 "식대 뺀 합계" |
| N5 | **신랑측·신부측 비용 분리**: 혼주 메이크업을 男측과 女측으로 나눠 적었어요 | 혼주 메이크업 표 |
| N6 | **순서가 있는 단계별 체크리스트**: 20단계마다 일정, 확인, 비고 칸이 있어요 | 체크리스트 탭 |
| N7 | **단계 사이의 순서**: 하객 수가 정해져야 웨딩홀 계약(보증인원)과 청첩장 수를 정할 수 있어요 | 2번, 10번 단계 비고 |
| N8 | **단계 안의 세부 할 일**: 상견례, 드레스 피팅, 촬영, 본식, 물품, 신혼여행 칸마다 할 일과 체크가 있어요 | 세부 체크리스트 칸 |
| N9 | **업체 후보 비교**: 업체명, 어느 플래너나 중개처에서 봤는지, 대략 가격, 인상 | 메모 탭(스튜디오, 메이크업) |
| N10 | 혼수 목록: 품목, 금액, 비고, 총액 | 오른쪽 혼수 표 |
| N11 | 집·대출 비교: 보증금(우리 돈 + 대출), 월세 + 이자 | 오른쪽 집 표, 행복주택·버팀목 메모 |

혼수(N10)와 집(N11)은 한 번 정하면 끝나는 결정에 가까워서, 매주 쓰는 기능에서는 뒤로 미뤘어요. 혼수는 예산표의 묶음 하나로 넣어요.

## 2. 기존 기능과 비교

**그대로 쓰는 것**
- `WeddingItem`의 name, group, budget, paid, dueDate, memo. budget은 '내 기준예산', paid는 '직접 기록한 낸 돈'으로 계속 써요.
- 잔금 일정(upcoming), 홈 카드, `alignGoalToBudget`(목표를 예산에 맞추기).
- 결혼준비 카테고리 결제는 생활비에서 빠지고 목표 진행에 더해지는 규칙(`goal.ts`). 결제 연결 기능은 이 규칙을 바꾸지 않고 그 위에 더하면 돼요.
- 커플 각자의 이름(`Member`)으로 체크한 사람을 기록해요.

**없는 것**
- 최소·최대 범위, 확정 비용(계약 금액), 세부항목 소분류(subgroup), 묶음 상한, 식대 표시, 신랑측·신부측 구분
- 체크리스트 전체(단계, 세부 할 일, 체크한 사람)
- 업체 후보
- 결제와 항목의 연결. 지금은 "결혼준비 결제 합계와 낸 돈이 다르면 고쳐 주세요"라는 안내만 있어서 직접 맞춰야 해요.
- 현재 묶음 목록(`WEDDING_GROUPS`: 예식 / 스드메 / 예물·예단 / 신혼여행 / 신혼집·혼수 / 기타)이 시트의 구성과 달라요.

**걸리는 것**
- 대시보드는 비밀번호 하나(Basic Auth)로 들어오기 때문에 지금은 누가 했는지 알 수 없어요. 기기마다 본인을 고르는 쿠키가 필요해요.

## 3. 기능 제안

### P0-1. 범위 예산표 (시트 예산 탭과 같은 구조)

**왜 필요한가**: N1~N5. 시트에서 가장 많이 쓰는 표예요. 견적을 받을 때마다 확정 금액을 채우게 돼서 매주 열게 돼요.

**화면 흐름** (모바일 웹, `/wedding/budget`)
1. 맨 위 요약 카드
   - 큰 숫자: 기준 합계
   - 막대 하나에 최소, 최대, 확정 + 낸 돈 구간을 겹쳐서 보여 줘요.
   - `[식대 포함 | 식대 빼고]` 토글
   - "목표를 기준 합계에 맞추기" 버튼(기존 기능)
2. 묶음 카드: 웨딩홀, 스드메, 혼주, 예복·한복, 본식스냅, 예물, 그 밖의 준비, 신혼여행, 혼수
   - 카드 머리에 묶음 이름, `최소~최대`, 확정 금액을 보여 줘요.
   - 상한이 있는 묶음은 "상한 500만 중 435만" 진행 막대를 핑크로 보여 주고, 넘으면 진한 핑크로 경고해요.
3. 카드를 펼치면 소분류(스튜디오, 드레스, 메이크업 …) 머리 아래에 세부 줄이 나와요.
   - 줄 모양: `원본 비용 · 20만 · [확정 ✓]`
   - 줄을 누르면 아래에서 올라오는 시트가 열리고, 최소 / 최대 / 기준 / 확정 / 낸 돈 / 잔금일 / 신랑·신부측 / 메모를 고칠 수 있어요.
4. 범위를 비워 둔 줄은 연한 회색 '미정'으로 보여 주고, 입력하라고 재촉하지 않아요.

**계산 규칙**
- 최소 합계 = Σ budgetMin ?? 0, 최대 합계 = Σ budgetMax ?? 0
- 기준 합계 = Σ(확정 actual → 기준 budget → 최대 budgetMax → 0 순서로 처음 있는 값). 넉넉하게 잡으려고 기준이 없으면 최대값을 써요. 화면에 "기준을 정하지 않은 항목은 최대 금액으로 계산했어요"라고 보여 줘요.
- 더 낼 돈 = Σ max(0, (actual ?? budget ?? budgetMax ?? 0) − 낸 돈)
- 낸 돈 = paid(직접 기록) + Σ 연결된 결제(P0-3)
- '식대 빼고'를 고르면 `isCatering = true`인 줄만 빼요.

**데이터 모델 (초안)**
```prisma
model WeddingItem {
  id          String   @id @default(cuid())
  name        String              // 세부항목 (예: 원본 비용)
  group       String   @default("기타")   // 묶음 (WeddingGroup.name)
  subgroup    String?             // 시트의 항목2 (스튜디오/드레스/메이크업 …)
  side        String   @default("COMMON") // COMMON | GROOM | BRIDE
  budget      Int      @default(0)        // 내 기준예산 (0 = 미정), 기존 필드
  budgetMin   Int?
  budgetMax   Int?
  actual      Int?                // 확정 비용(계약 금액). 시트의 '비용(실제)'
  paid        Int      @default(0)        // 알림 없이 낸 돈(현금·계좌이체), 기존 필드
  dueDate     DateTime?
  isCatering  Boolean  @default(false)    // 식대 여부
  sortOrder   Int      @default(0)
  templateKey String?  @unique            // 템플릿을 여러 번 불러와도 중복되지 않게 (예: "sdm.studio.original")
  memo        String?
  vendorId    String?                     // P1
  transactions Transaction[]              // P0-3
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

/// 묶음별 설정 (상한, 순서, 메모)
model WeddingGroup {
  name      String  @id
  sortOrder Int     @default(0)
  cap       Int?    // 상한 (스드메 5,000,000)
  note      String? // "세부 기준 350~400, 기타 추가금 다 해도 500 이하"
}
```
- `group`은 지금처럼 문자열로 두기 때문에 기존 데이터가 그대로 남아요. 묶음 이름은 예식 → 웨딩홀, 예물·예단 → 예물, 신혼집·혼수 → 혼수로 바꿔요. 한 번만 도는 스크립트나 '시트 템플릿 불러오기' 동작 안에서 바꾸면 돼요.
- 시트의 3단 구조(항목 / 항목2 / 세부항목)를 group / subgroup / name으로 옮겨요. 부모·자식 트리(parentId)를 쓰지 않아서 화면과 조회가 단순해요.
- 혼수는 `group="혼수"`, 소분류는 가전 / 가구 / 기타로 두고, 혼수 예산은 `WeddingGroup.cap`에 넣어요. 따로 모델을 만들 필요가 없어요.

**목표 진행률과 연결**
- 결혼준비 탭 맨 위와 홈 목표 카드에 "목표 3,800만 · 예산 기준 4,280만 · 식대 빼면 2,270만"을 함께 보여 줘요.
- `alignGoalToBudget`에 기준을 고르는 옵션을 더해요: 기준 합계(기본) / 최대 합계 / 식대 뺀 기준 합계.

### P0-2. 단계별 체크리스트와 체크한 사람

**왜 필요한가**: N6~N8. "이번 주에 뭘 해야 하지?"를 둘이 같이 보는 화면이라, 매주 쓰는 기능의 중심이에요.

**화면 흐름** (`/wedding`의 기본 탭 '할 일')
1. 맨 위: D-day(결혼식 날짜는 `Goal.targetDate`), 진행 상황 "20단계 중 6단계 완료"
2. **이번 주·다음 달 카드**(핑크 테두리): 일정이 잡혔는데 아직 끝나지 않은 단계를 날짜순으로 최대 3개, 그리고 날짜가 지난 단계
3. 20단계 타임라인: 세로선과 동그라미로 그려요. 끝난 단계는 동그라미를 채우고, 아래에 작은 글씨로 "지은 · 10/21"처럼 누가 언제 했는지 보여 줘요.
   - 단계를 누르면 펼쳐져서 일정 날짜, 비고, 세부 할 일 목록(체크박스와 체크한 사람 이니셜), `+ 할 일 추가`가 나와요.
   - 2번과 10번 단계에는 "하객 수 먼저 정하기 →" 안내 칩을 붙여요. P1에서 하객 수 입력 화면으로 연결해요.
4. 처음 들어오면 "시트 순서대로 20단계 만들기" 버튼이 있어요. "결혼식 날짜에 맞춰 추천 일정 채우기"도 원할 때만 쓸 수 있게 둬요.

**같이 쓰기**
- **이 기기는 누구인지**: 설정 화면이나 처음 들어올 때 Member 이름 중 하나를 고르면 `moabom_me` 쿠키(1년)에 저장해요. 체크하거나 할 일을 추가할 때 이 이름을 `doneBy`와 `createdBy`에 남겨요.
- 쿠키가 없으면 이름 없이 저장하고, "누가 체크했는지 남기려면 이름을 골라 주세요"라고 한 번 안내해요.
- 둘이 동시에 같은 항목을 고칠 일은 드물어서, 나중에 저장한 쪽이 남는 방식이면 충분해요.

**데이터 모델 (초안)**
```prisma
model WeddingStep {
  id          String    @id @default(cuid())
  order       Int
  title       String
  note        String?    // 시트의 '비고'
  hint        String?    // 템플릿에 고정된 안내 (하객 수 → 웨딩홀·청첩장)
  targetDate  DateTime?  // 시트의 '일정'
  done        Boolean   @default(false)
  doneAt      DateTime?
  doneBy      String?    // Member.name
  templateKey String?   @unique
  tasks       WeddingTask[]
}

model WeddingTask {
  id        String    @id @default(cuid())
  step      WeddingStep @relation(fields: [stepId], references: [id], onDelete: Cascade)
  stepId    String
  section   String?    // 시트의 세부 칸 이름 (상견례 / 드레스 피팅 / …)
  content   String
  done      Boolean   @default(false)
  doneAt    DateTime?
  doneBy    String?
  createdBy String?
  sortOrder Int       @default(0)
  createdAt DateTime  @default(now())
}
```
- 단계 사이의 순서를 그래프로 관리하지는 않아요. 시트에 나온 경우가 두 개뿐이라 `hint`와 P1의 하객 수 연결로 충분해요.

### P0-3. 결혼준비 결제를 세부항목에 연결

**왜 필요한가**: 시트와 달리 이 앱은 결제가 자동으로 들어와요. 그런데 지금은 '결혼준비' 합계만 있고 낸 돈은 손으로 적어야 해서, 둘이 자꾸 어긋나요.

**화면 흐름**
1. 예산 탭 맨 위에 "어느 항목에 낸 돈인지 골라 주세요 · 3건" 카드가 나와요. 카테고리가 결혼준비인데 아직 항목(`weddingItemId`)이 없는 결제가 대상이에요.
2. 결제마다 가맹점, 금액, 날짜와 함께 추천 항목 칩 1~2개를 보여 줘요. 추천 순서:
   1. 같은 가맹점을 전에 연결한 항목
   2. 가맹점 이름이 들어간 업체 후보(P1)
   3. 키워드 대응(스튜디오 → 스드메, 반지 → 웨딩밴드, 청첩장 → 종이 청첩장 …)
   - 칩을 누르면 바로 연결돼요. 맞는 칩이 없으면 `다른 항목…`에서 골라요.
3. 내역 탭에서 결제의 카테고리를 결혼준비로 바꾸면 예산 항목도 같이 고를 수 있어요.
4. 항목 시트에서는 연결된 결제 목록과 직접 기록한 낸 돈을 따로 보여 줘서, 같은 돈이 두 번 잡히지 않게 해요.

**데이터 모델**
```prisma
model Transaction {
  // …기존 필드
  weddingItem   WeddingItem? @relation(fields: [weddingItemId], references: [id], onDelete: SetNull)
  weddingItemId String?
}
```

**계산**
- 항목의 낸 돈 = `paid` + Σ 연결된 결제(ACTIVE 조건, 취소된 결제 제외)
- 지금 적혀 있는 `paid` 값은 직접 기록한 금액으로 그대로 둬요. 결제를 연결할 때 직접 기록한 금액이 이미 확정 비용 이상이면 "직접 적은 낸 돈과 겹칠 수 있어요"라고 알려 줘요.
- `goal.ts`의 weddingSpent는 지금처럼 카테고리 기준으로 계산해요. 대신 예산 탭에 "항목을 고르지 않은 결혼준비 결제 X원"을 보여 줘서 연결을 마치도록 이끌어요.

### P1

**P1-1. 업체 후보 비교** (N9)
- 위치: 예산 탭의 묶음 카드 안 '후보' 줄, 또는 `/wedding/vendors`
- 분류 칩: 스튜디오 / 드레스 / 메이크업 / 웨딩홀 / 스냅 / 기타
- 업체 카드: 업체명, 출처 칩(헬로웨딩, 메스웨딩, 아이니웨딩, 직접), 견적, 한 줄 메모, 상태(`후보 → 상담 → 계약 / 탈락`)
- "계약했어요"를 누르면 해당 예산 항목의 `vendorId`와 확정 비용(`actual`, 견적 금액)을 채워요.
```prisma
model WeddingVendor {
  id        String   @id @default(cuid())
  category  String
  name      String
  sources   String[] // 헬로웨딩, 메스웨딩 …
  quote     Int?
  status    String   @default("CANDIDATE") // CANDIDATE | CONSULTED | CONTRACTED | DROPPED
  memo      String?
  addedBy   String?
  createdAt DateTime @default(now())
}
```
- 메모 탭에서 가져올 기본 데이터:
  - 스튜디오: 프리베스(헬로·메스), 르에비(헬로·메스), 아브로세하우스(원판, 메스), 르안스튜디오(메스·아이니)
  - 메이크업: 다교메이크업(연계 없음, 120만 원대), 비올(헬로·메스)

**P1-2. 하객 수로 식대·청첩장·답례품 계산** (N7)
- `WeddingInfo`(레코드 하나): 신랑측 하객 `guestsGroom`, 신부측 하객 `guestsBride`, 보증인원 `guaranteed`, 1인 식대 `mealPrice`, 청첩장 여분 비율 `invitationExtraRate`(기본 1.2)
- 식대 기준 예산을 `mealPrice × guaranteed`로 제안해요. 자동으로 덮어쓰지 않고 '적용' 버튼을 눌러야 반영돼요.
- 종이 청첩장 수량은 `(하객 수 ÷ 2.5) × 여분 비율`로 제안해요. 가정한 값이라 계산식을 화면에 그대로 보여 주고 고칠 수 있게 해요. 답례품 수량은 하객 수를 그대로 써요.
- 체크리스트 2번과 10번 단계의 안내 칩에서 이 입력 화면으로 이동해요.

**P1-3. 양가 비용 따로 보기** (N5): 예산 요약에 `공동 / 신랑측 / 신부측` 토글을 두고, `side` 값으로 합계를 나눠 보여 줘요.

**P1-4. 홈 카드**: 홈의 잔금 일정 카드 옆에 '이번 주 결혼 준비 할 일'(단계 2개)을 보여 줘요. 항목을 고르지 않은 결혼준비 결제가 있으면 "결제 3건 항목 고르기" 배지도 띄워요.

### P2 (나중에)
- 집·대출 비교 `HousingOption`: 이름, 보증금, 우리 돈, 대출, 금리, 월세. 월 부담은 월세 + 대출 × 금리 ÷ 12로 계산해요. 행복주택과 버팀목 전세대출 메모 칸을 둬요.
- 하객 명단(사람 단위), 분할 납부(계약금 / 중도금 / 잔금), 업체 링크와 사진, 체크가 바뀌면 폰으로 알림

## 4. 디자인 톤 (모아봄에 이미 적용됨)
- 새 화면도 `server/src/app/globals.css`에 있는 토큰 클래스를 그대로 써요. 페리윙클 `save`, 핑크 `pink`, 라벤더 `save-soft`, 그라데이션 표지 `.hero`, 유리 느낌 `.glass`, 둥근 그림자 카드 `.card`가 있어요.
- 완료 표시와 진행 막대는 `save`(페리윙클)를 써요. 상한 초과나 날짜가 지난 일 같은 경고는 `spend`(로즈)를 써요. 이번 주 카드는 핑크 테두리로 구분해요.

## 5. 기본 템플릿 데이터

### 5-1. 체크리스트 20단계 (`WEDDING_STEPS`)
`offset`은 결혼식 날짜를 기준으로 한 **추천 일정**(일 단위)이에요. 시트에는 날짜가 없어서 시트의 순서를 보고 제안한 값이에요. '추천 일정 채우기' 버튼을 누를 때만 적용해요.
```ts
export const WEDDING_STEPS = [
  { key: "s01", order: 1,  title: "양가 인사",               offset: -365 },
  { key: "s02", order: 2,  title: "택일 → 웨딩홀 계약",        offset: -330, hint: "하객 수가 어느 정도인지 먼저 확인해 주세요 (보증인원)" },
  { key: "s03", order: 3,  title: "스드메·본식 스냅 계약",      offset: -300 },
  { key: "s04", order: 4,  title: "예물",                    offset: -240 },
  { key: "s05", order: 5,  title: "헤어변형·헬퍼 관련",        offset: -210 },
  { key: "s06", order: 6,  title: "스튜디오 촬영",            offset: -150 },
  { key: "s07", order: 7,  title: "신혼여행 예약",            offset: -150 },
  { key: "s08", order: 8,  title: "식전 관리",                offset: -120 },
  { key: "s09", order: 9,  title: "상견례",                  offset: -120 },
  { key: "s10", order: 10, title: "하객 리스트 작성",          offset: -100, hint: "하객 수로 청첩장 수를 정해요" },
  { key: "s11", order: 11, title: "청첩장",                  offset: -90 },
  { key: "s12", order: 12, title: "혼주 양장·한복·헤메",        offset: -60 },
  { key: "s13", order: 13, title: "청모 + 모청 전달",          offset: -45, note: "청첩장 모임 + 모바일 청첩장" },
  { key: "s14", order: 14, title: "사회자 & 축가 준비",        offset: -45 },
  { key: "s15", order: 15, title: "결혼식순 정리",             offset: -30 },
  { key: "s16", order: 16, title: "부케·식전 영상 등 준비",     offset: -30 },
  { key: "s17", order: 17, title: "축의대 준비",              offset: -14 },
  { key: "s18", order: 18, title: "결혼식 당일",              offset: 0 },
  { key: "s19", order: 19, title: "신혼여행",                 offset: 1 },
  { key: "s20", order: 20, title: "양가 인사",                offset: 14 },
] as const;
```

### 5-2. 세부 체크리스트 칸 (`WEDDING_TASK_SECTIONS`)
시트의 세부 칸은 아직 비어 있어서 칸 이름, 연결할 단계, 시트의 줄 수만 옮겼어요. `suggest`는 시트에 없던 제안이고, '추천 할 일 넣기'를 눌렀을 때만 추가돼요.
```ts
export const WEDDING_TASK_SECTIONS = [
  { section: "상견례",              stepKey: "s09", slots: 4,  suggest: ["장소 예약", "양가 일정 맞추기", "선물 준비", "대화 주제·호칭 정리"] },
  { section: "드레스 피팅",          stepKey: "s06", slots: 5,  suggest: ["드레스 투어 예약", "촬영 드레스 고르기", "본식 드레스 가봉", "2부 드레스 고르기"] },
  { section: "스튜디오 촬영",        stepKey: "s06", slots: 5,  suggest: ["촬영 콘셉트 정하기", "소품 준비", "원본 받기", "앨범 셀렉"] },
  { section: "본식",                stepKey: "s18", slots: 20, suggest: ["식순 최종 확인", "축의대 담당 정하기", "사례비 봉투", "폐백 여부", "BGM 전달"] },
  { section: "기타 관리 및 물품 구매", stepKey: "s08", slots: 7,  suggest: ["피부 관리", "웨딩슈즈", "속옷·소품"] },
  { section: "신혼여행",             stepKey: "s19", slots: 10, suggest: ["여권 만료일 확인", "항공권", "숙소", "환전·로밍", "여행자 보험"] },
] as const;
```

### 5-2-1. 행정·돈 챙길 것 칸 (`WEDDING_ADMIN_TASKS`)
결혼과 같이 챙기면 돈이 되는 행정 항목이에요. 체크리스트에 '행정·혜택' 칸으로 넣고, 같은 내용은 매일 아침 '오늘의 팁' 알림(`server/src/lib/tips.ts`)에도 들어가 있어요.
```ts
export const WEDDING_ADMIN_TASKS = [
  { stepKey: "s02", content: "하객 수 대략 정하기 (웨딩홀 보증인원·청첩장 수 기준)" },
  { stepKey: "s03", content: "계약 전에 추가금 목록 받기 (원본·수정본·헬퍼비·연출료)" },
  { stepKey: "s07", content: "두 사람 여권 만료일 확인" },
  { stepKey: "s07", content: "회사 경조휴가 일수 확인" },
  { stepKey: "s10", content: "혼인신고 시기 정하기 (결혼세액공제·신혼부부 대출·청약 자격 확인)" },
  { stepKey: "s10", content: "신혼집 대출 비교 (버팀목·디딤돌 요건, 신용점수 확인)" },
  { stepKey: "s14", content: "사회자·축가·축의대 사례 봉투 준비" },
  { stepKey: "s18", content: "축의금 명단·금액 당일 정리" },
  { stepKey: "s20", content: "전입신고·확정일자 (이사 당일)" },
  { stepKey: "s20", content: "연말정산: 결혼세액공제, 의료비는 소득 적은 쪽으로" },
] as const;
```

### 5-3. 예산 묶음과 세부항목 (`WEDDING_GROUPS_V2`, `WEDDING_BUDGET_TEMPLATE`)
금액 단위는 원이에요. `null`은 시트에서 비어 있는 칸이고, 금액이 하나만 적힌 항목은 최소와 최대에 같은 값을 넣었어요.
```ts
export const WEDDING_GROUPS_V2 = [
  { name: "웨딩홀", sortOrder: 1 },
  { name: "스드메", sortOrder: 2, cap: 5_000_000, note: "세부 기준 350~400, 기타 추가금 다 해도 500 이하였으면 좋겠음" },
  { name: "혼주", sortOrder: 3 },
  { name: "예복·한복", sortOrder: 4 },
  { name: "본식스냅", sortOrder: 5 },
  { name: "예물", sortOrder: 6 },
  { name: "그 밖의 준비", sortOrder: 7 },
  { name: "신혼여행", sortOrder: 8 },
  { name: "혼수", sortOrder: 9 },   // 기본 세부항목 없이 품목을 직접 추가 (subgroup: 가전/가구/기타)
] as const;

type T = { key: string; group: string; subgroup?: string; name: string; min: number | null; max: number | null;
           side?: "COMMON" | "GROOM" | "BRIDE"; isCatering?: boolean; memo?: string };

export const WEDDING_BUDGET_TEMPLATE: T[] = [
  // 웨딩홀 (26,600,000 ~ 43,000,000)
  { key: "hall.rent",    group: "웨딩홀", name: "대관료",          min: 6_500_000,  max: 16_000_000 },
  { key: "hall.deco",    group: "웨딩홀", name: "연출료·생화장식",   min: null, max: null },
  { key: "hall.meal",    group: "웨딩홀", name: "식대",            min: 20_100_000, max: 27_000_000, isCatering: true },
  { key: "hall.extra",   group: "웨딩홀", name: "기타 추가요금",     min: null, max: null },

  // 스드메 (3,155,000 ~ 4,355,000)
  { key: "sdm.package",        group: "스드메", subgroup: "패키지",  name: "스드메 패키지",         min: 2_100_000, max: 3_000_000 },
  { key: "sdm.studio.shoot",   group: "스드메", subgroup: "스튜디오", name: "촬영 비용",             min: null, max: null },
  { key: "sdm.studio.original",group: "스드메", subgroup: "스튜디오", name: "원본 비용",             min: 200_000, max: 200_000 },
  { key: "sdm.studio.hm",      group: "스드메", subgroup: "스튜디오", name: "촬영 H/M 비용",         min: null, max: null },
  { key: "sdm.studio.dress",   group: "스드메", subgroup: "스튜디오", name: "촬영 드레스 추가",       min: 0, max: 300_000 },
  { key: "sdm.studio.tux",     group: "스드메", subgroup: "스튜디오", name: "촬영 턱시도 추가",       min: null, max: null },
  { key: "sdm.studio.bouquet", group: "스드메", subgroup: "스튜디오", name: "촬영 부케",             min: null, max: null },
  { key: "sdm.studio.album",   group: "스드메", subgroup: "스튜디오", name: "앨범 페이지 추가·수정본", min: 440_000, max: 440_000 },
  { key: "sdm.studio.frame",   group: "스드메", subgroup: "스튜디오", name: "추가 액자/앨범",         min: null, max: null },
  { key: "sdm.studio.preedit", group: "스드메", subgroup: "스튜디오", name: "선수정본 비용",          min: null, max: null },
  { key: "sdm.studio.albumx",  group: "스드메", subgroup: "스튜디오", name: "앨범 추가비용",          min: null, max: null },
  { key: "sdm.studio.night",   group: "스드메", subgroup: "스튜디오", name: "야간 촬영 비용",         min: 110_000, max: 110_000 },
  { key: "sdm.dress.tour",     group: "스드메", subgroup: "드레스",  name: "드레스 투어비",          min: 55_000, max: 55_000 },
  { key: "sdm.dress.main",     group: "스드메", subgroup: "드레스",  name: "본식 드레스 추가금",      min: null, max: null },
  { key: "sdm.dress.tour2",    group: "스드메", subgroup: "드레스",  name: "2부 드레스 투어",         min: null, max: null },
  { key: "sdm.dress.second",   group: "스드메", subgroup: "드레스",  name: "2부 드레스 추가금",       min: null, max: null },
  { key: "sdm.dress.helper",   group: "스드메", subgroup: "드레스",  name: "본식 헬퍼비용",          min: 250_000, max: 250_000 },
  { key: "sdm.makeup.couple",  group: "스드메", subgroup: "메이크업", name: "신랑+신부 H/M",          min: null, max: null },
  { key: "sdm.makeup.extra",   group: "스드메", subgroup: "메이크업", name: "기타 추가 비용",         min: null, max: null },

  // 혼주 (한쪽 484,000 ~ 930,000, 양쪽 합계 968,000 ~ 1,860,000)
  { key: "parents.g.f", group: "혼주", subgroup: "혼주 메이크업", side: "GROOM", name: "혼주 H/M 여성", min: 242_000, max: 410_000 },
  { key: "parents.g.m", group: "혼주", subgroup: "혼주 메이크업", side: "GROOM", name: "혼주 H/M 남성", min: 242_000, max: 470_000 },
  { key: "parents.g.x", group: "혼주", subgroup: "혼주 메이크업", side: "GROOM", name: "기타 추가요금", min: 0, max: 50_000 },
  { key: "parents.b.f", group: "혼주", subgroup: "혼주 메이크업", side: "BRIDE", name: "혼주 H/M 여성", min: 242_000, max: 410_000 },
  { key: "parents.b.m", group: "혼주", subgroup: "혼주 메이크업", side: "BRIDE", name: "혼주 H/M 남성", min: 242_000, max: 470_000 },
  { key: "parents.b.x", group: "혼주", subgroup: "혼주 메이크업", side: "BRIDE", name: "기타 추가요금", min: 0, max: 50_000 },

  // 예복·한복 (1,900,000 ~ 3,800,000)
  { key: "attire.groom",    group: "예복·한복", subgroup: "예복",     name: "본식 예복",      min: 600_000, max: 800_000 },
  { key: "attire.hanbok.f", group: "예복·한복", subgroup: "한복·정장", name: "혼주 한복 여성",  min: 500_000, max: 1_300_000 },
  { key: "attire.hanbok.m", group: "예복·한복", subgroup: "한복·정장", name: "혼주 한복 남성",  min: 500_000, max: 1_300_000 },
  { key: "attire.suit",     group: "예복·한복", subgroup: "한복·정장", name: "혼주 정장",      min: 300_000, max: 400_000 },

  // 본식스냅 (500,000 ~ 1,300,000)
  { key: "snap.main",     group: "본식스냅", name: "메인 스냅촬영",  min: 500_000, max: 1_300_000, memo: "시트 세부항목은 0~130만, 묶음 합계는 50만부터라 확인 필요" },
  { key: "snap.original", group: "본식스냅", name: "원본 추가비용",  min: null, max: null },
  { key: "snap.sub",      group: "본식스냅", name: "서브 스냅촬영",  min: null, max: null },
  { key: "snap.iphone",   group: "본식스냅", name: "아이폰 스냅촬영", min: null, max: null },
  { key: "snap.dvd",      group: "본식스냅", name: "DVD 촬영",      min: null, max: null },
  { key: "snap.edit",     group: "본식스냅", name: "추가 수정 비용",  min: null, max: null },
  { key: "snap.album",    group: "본식스냅", name: "앨범 추가 비용",  min: null, max: null },

  // 예물 (3,000,000 ~ 6,000,000)
  { key: "ring.band", group: "예물", name: "웨딩밴드", min: 3_000_000, max: 6_000_000 },

  // 그 밖의 준비 (1,670,000 ~ 2,100,000)
  { key: "etc.meeting",   group: "그 밖의 준비", name: "상견례",       min: 500_000, max: 500_000, memo: "선물 포함" },
  { key: "etc.bouquet",   group: "그 밖의 준비", name: "본식 부케",     min: 200_000, max: 300_000 },
  { key: "etc.mobileinv", group: "그 밖의 준비", subgroup: "청첩장", name: "모바일 청첩장", min: null, max: null },
  { key: "etc.paperinv",  group: "그 밖의 준비", subgroup: "청첩장", name: "종이 청첩장",  min: 120_000, max: 200_000 },
  { key: "etc.ticket",    group: "그 밖의 준비", subgroup: "청첩장", name: "식권",        min: 50_000, max: 100_000 },
  { key: "etc.invparty",  group: "그 밖의 준비", name: "청첩장 모임",   min: null, max: null },
  { key: "etc.bgm",       group: "그 밖의 준비", name: "BGM",         min: null, max: null },
  { key: "etc.video",     group: "그 밖의 준비", name: "식전 영상",     min: null, max: null },
  { key: "etc.mc",        group: "그 밖의 준비", name: "사회자",       min: 300_000, max: 300_000 },
  { key: "etc.song",      group: "그 밖의 준비", name: "축가",         min: 200_000, max: 200_000 },
  { key: "etc.car",       group: "그 밖의 준비", name: "웨딩카",       min: null, max: null },
  { key: "etc.gift",      group: "그 밖의 준비", name: "답례품",       min: 300_000, max: 500_000 },

  // 신혼여행 (5,000,000 ~ 6,000,000)
  { key: "trip.all", group: "신혼여행", name: "신혼여행 (항공·숙소·경비)", min: 5_000_000, max: 6_000_000,
    memo: "시트 세부항목: 항공비 400만 / 숙소비 300만~ / 여행경비 200~300만. 합계(500~600만)와 맞지 않아 확인한 뒤 나누기" },
];
```

**검산** (위 데이터의 합계가 시트 상단 합계와 같아요)

| 묶음 | 최소 | 최대 |
|---|---:|---:|
| 웨딩홀 | 26,600,000 | 43,000,000 |
| 스드메 | 3,155,000 | 4,355,000 |
| 혼주(양쪽) | 968,000 | 1,860,000 |
| 예복·한복 | 1,900,000 | 3,800,000 |
| 본식스냅 | 500,000 | 1,300,000 |
| 예물 | 3,000,000 | 6,000,000 |
| 그 밖의 준비 | 1,670,000 | 2,100,000 |
| 신혼여행 | 5,000,000 | 6,000,000 |
| **총합** | **42,793,000** | **68,415,000** |
| **식대 뺀 합계** | **22,693,000** | **41,415,000** |

시트 비고 칸의 '호텔경비', '추천업체'는 어느 줄에 붙어 있는지 확인하지 못해서 템플릿에 넣지 않았어요. 필요하면 해당 줄의 메모에 직접 적으면 돼요.

**템플릿 불러오기 규칙**
- 같은 `templateKey`가 이미 있는 줄은 건너뛰어요. 여러 번 눌러도 중복되지 않아요.
- 이름이 같은 기존 항목(예: 신혼여행)이 있으면 새로 만들지 않고, 그 항목에 `templateKey`와 범위만 채워요.
- 기존 10개 템플릿 항목 중 시트에 대응하는 줄이 없는 것(예단·한복, 가전, 가구 등)은 지우지 않고 알맞은 묶음으로 옮기기만 해요.

## 6. 둘이 매주 쓰는 모습 (확인용 시나리오)
1. 일요일 밤에 결혼준비 탭을 열어 '이번 주 할 일' 2개(예: 드레스 투어 예약, 신혼여행 항공권 알아보기)를 확인해요.
2. 주중에 스튜디오 계약금을 카드로 결제하면 자동으로 결혼준비로 분류돼요. 예산 탭에서 추천 칩을 눌러 '스드메 패키지'에 연결해요.
3. 견적을 받으면 해당 줄의 확정 비용을 채워요. 스드메 상한 막대에서 500만 원 중 얼마를 썼는지 둘이 같은 화면으로 봐요.
4. 여자친구가 할 일을 체크하면 남자친구 화면에도 "지은 · 10/27"이 보여요.

## 7. 1차 구현 범위와 순서

- **1차** (가장 작으면서 바로 쓸모 있는 묶음): P0-1 범위 예산표와 시트 템플릿, P0-2 체크리스트와 체크한 사람 기록
- **2차**: P0-3 결제 연결, P1-1 업체 후보(기본 데이터 포함), P1-4 홈 카드
- **3차**: P1-2 하객 수 연결, P1-3 양가 비용 따로 보기, P2

**1차 구현 순서**
1. **스키마**: `WeddingItem`에 subgroup, side, budgetMin, budgetMax, actual, isCatering, sortOrder, templateKey를 더하고 `WeddingGroup`, `WeddingStep`, `WeddingTask` 모델을 추가해요. 전부 추가만 하는 변경이라 `prisma db push`로 데이터 손실 없이 반영돼요.
2. **`lib/wedding.ts`**
   - 상수 `WEDDING_GROUPS_V2`, `WEDDING_BUDGET_TEMPLATE`, `WEDDING_STEPS`, `WEDDING_TASK_SECTIONS`를 추가해요.
   - `weddingOverview`가 묶음별 최소 / 최대 / 기준 / 확정 / 낸 돈 / 식대 제외 합계를 돌려주게 확장해요. `upcoming`은 그대로 두고 금액 계산만 `actual ?? budget`으로 바꿔요.
   - `checklistOverview(now)`를 추가해서 이번 주 할 일, 날짜가 지난 일, 진행률을 계산해요.
3. **본인 식별**: `lib/me.ts`에서 쿠키를 읽고 써요. 설정 화면에 '이 기기는 누구' 선택을 추가해요.
4. **`actions.ts`**
   - `importWeddingTemplate`: 기존 `addWeddingTemplate`을 대체하고, 여러 번 실행해도 결과가 같게 만들어요.
   - `updateWeddingItem`에 새 필드를 반영해요.
   - `saveWeddingGroup`: 묶음 상한과 메모를 저장해요.
   - `createSteps`, `toggleStep`, `setStepDate`, `fillStepDates(weddingDate)`
   - `addTask`, `toggleTask`, `deleteTask`
   - `alignGoalToBudget(mode)`
5. **화면**: `/wedding`(할 일 탭, 기본)과 `/wedding/budget`(예산 탭)을 위쪽 탭으로 오가게 만들어요. 기존 page.tsx의 예산 화면은 예산 탭으로 옮겨요.
6. **홈 연동**은 최소로 해요. 기존 잔금 카드의 금액 계산만 새 규칙(`actual ?? budget`)에 맞춰요.
7. **데모 데이터**: `npm run db:seed`에 템플릿과 체크 3~4개를 넣어서 화면을 확인해요.

**주의할 점**
- 지금 묶음 이름을 `WEDDING_GROUPS`로 검사하는 로직(`groupOf`)은 V2 목록과 기존 이름을 모두 허용하게 바꿔야 해요. 그러지 않으면 기존 데이터가 '기타'로 빠져요.
- 5-3 데이터에서 시트 값끼리 맞지 않는 두 곳(본식 메인 스냅 최소 금액, 신혼여행 세부 금액)은 여자친구분께 확인한 뒤 템플릿 값을 확정해요.
