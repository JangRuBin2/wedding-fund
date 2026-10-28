import { prisma } from "./db";
import { DAY } from "./time";

/**
 * 결혼 준비 체크리스트 템플릿. 순서와 이름은 여자친구가 만든 시트의 '전체 흐름' 20단계 그대로.
 * offset: 결혼식 날짜 기준 추천 일정(일). 시트에는 날짜가 없어서 순서를 보고 잡은 값이고,
 * '추천 일정 채우기'를 눌렀을 때만 적용함
 */
export const WEDDING_STEPS = [
  { key: "s01", order: 1, title: "양가 인사", offset: -365 },
  { key: "s02", order: 2, title: "택일 → 웨딩홀 계약", offset: -330, hint: "하객 수가 어느 정도인지 먼저 확인해 주세요 (보증인원)" },
  { key: "s03", order: 3, title: "스드메·본식 스냅 계약", offset: -300 },
  { key: "s04", order: 4, title: "예물", offset: -240 },
  { key: "s05", order: 5, title: "헤어변형·헬퍼 관련", offset: -210 },
  { key: "s06", order: 6, title: "스튜디오 촬영", offset: -150 },
  { key: "s07", order: 7, title: "신혼여행 예약", offset: -150 },
  { key: "s08", order: 8, title: "식전 관리", offset: -120 },
  { key: "s09", order: 9, title: "상견례", offset: -120 },
  { key: "s10", order: 10, title: "하객 리스트 작성", offset: -100, hint: "하객 수로 청첩장 수를 정해요" },
  { key: "s11", order: 11, title: "청첩장", offset: -90 },
  { key: "s12", order: 12, title: "혼주 양장·한복·헤메", offset: -60 },
  { key: "s13", order: 13, title: "청모 + 모청 전달", offset: -45, note: "청첩장 모임 + 모바일 청첩장" },
  { key: "s14", order: 14, title: "사회자 & 축가 준비", offset: -45 },
  { key: "s15", order: 15, title: "결혼식순 정리", offset: -30 },
  { key: "s16", order: 16, title: "부케·식전 영상 등 준비", offset: -30 },
  { key: "s17", order: 17, title: "축의대 준비", offset: -14 },
  { key: "s18", order: 18, title: "결혼식 당일", offset: 0 },
  { key: "s19", order: 19, title: "신혼여행", offset: 1 },
  { key: "s20", order: 20, title: "양가 인사", offset: 14 },
] as const;

/** 단계별 추천 할 일. 시트의 세부 칸은 비어 있어서 '추천 할 일 넣기'를 눌렀을 때만 들어감 */
export const SUGGESTED_TASKS: { stepKey: string; section: string; content: string }[] = [
  ...[
    ["s09", "상견례", ["장소 예약", "양가 일정 맞추기", "선물 준비", "대화 주제·호칭 정리"]],
    ["s06", "드레스 피팅", ["드레스 투어 예약", "촬영 드레스 고르기", "본식 드레스 가봉", "2부 드레스 고르기"]],
    ["s06", "스튜디오 촬영", ["촬영 콘셉트 정하기", "소품 준비", "원본 받기", "앨범 셀렉"]],
    ["s18", "본식", ["식순 최종 확인", "축의대 담당 정하기", "사례비 봉투", "폐백 여부", "BGM 전달"]],
    ["s08", "기타 관리 및 물품 구매", ["피부 관리", "웨딩슈즈", "속옷·소품"]],
    ["s19", "신혼여행", ["항공권", "숙소", "환전·로밍", "여행자 보험"]],
  ].flatMap(([stepKey, section, items]) =>
    (items as string[]).map((content) => ({ stepKey: stepKey as string, section: section as string, content })),
  ),
  // 결혼과 같이 챙기면 돈이 되는 행정 (같은 내용이 '오늘의 팁'에도 있음)
  ...(
    [
      ["s02", "하객 수 대략 정하기 (웨딩홀 보증인원·청첩장 수 기준)"],
      ["s03", "계약 전에 추가금 목록 받기 (원본·수정본·헬퍼비·연출료)"],
      ["s07", "두 사람 여권 만료일 확인"],
      ["s07", "회사 경조휴가 일수 확인"],
      ["s10", "혼인신고 시기 정하기 (결혼세액공제·신혼부부 대출·청약 자격)"],
      ["s10", "신혼집 대출 비교 (버팀목·디딤돌 요건, 신용점수 확인)"],
      ["s14", "사회자·축가·축의대 사례 봉투 준비"],
      ["s18", "축의금 명단·금액 당일 정리"],
      ["s20", "전입신고·확정일자 (이사 당일)"],
      ["s20", "연말정산: 결혼세액공제, 의료비는 소득 적은 쪽으로"],
    ] as const
  ).map(([stepKey, content]) => ({ stepKey, section: "행정·혜택", content })),
];

export async function checklistOverview(now = new Date()) {
  const steps = await prisma.weddingStep.findMany({
    orderBy: { order: "asc" },
    include: {
      tasks: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
      payments: { select: { amount: true, method: true } },
    },
  });
  const done = steps.filter((s) => s.done).length;
  const daysUntil = (d: Date) => Math.ceil((d.getTime() - now.getTime()) / DAY);
  // 날짜 잡힌 것 중 아직 안 끝난 것: 지난 것(밀림) + 30일 안
  const dated = steps
    .filter((s) => !s.done && s.targetDate)
    .map((s) => ({ ...s, daysUntil: daysUntil(s.targetDate!) }))
    .sort((a, b) => a.targetDate!.getTime() - b.targetDate!.getTime());
  const overdue = dated.filter((s) => s.daysUntil < 0);
  const soon = dated.filter((s) => s.daysUntil >= 0 && s.daysUntil <= 30);
  // 날짜가 없으면 순서상 다음 단계
  const next = steps.find((s) => !s.done) ?? null;
  return { steps, done, total: steps.length, overdue, soon, next };
}

export function suggestionsFor(stepKey: string | null) {
  return stepKey ? SUGGESTED_TASKS.filter((t) => t.stepKey === stepKey) : [];
}

/** 캘린더 한 달치: 이벤트 날짜, 할 일 소규모 일정, 결제(예정)일 */
export async function calendarMonth(from: Date, to: Date) {
  const range = { gte: from, lt: to };
  const [steps, tasks, payments] = await Promise.all([
    prisma.weddingStep.findMany({ where: { targetDate: range }, select: { id: true, title: true, targetDate: true, done: true } }),
    prisma.weddingTask.findMany({
      where: { dueDate: range },
      select: { id: true, content: true, dueDate: true, done: true, step: { select: { id: true, title: true } } },
    }),
    prisma.weddingPayment.findMany({
      where: { paidAt: range },
      select: { id: true, content: true, amount: true, method: true, category: true, paidAt: true, stepId: true },
    }),
  ]);
  return { steps, tasks, payments };
}
