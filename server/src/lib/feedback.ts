import { prisma } from "./db";
import { askLLM, LLM_MODEL } from "./llm";
import { ACTIVE, getGoalStatus } from "./goal";
import { WEDDING_CATEGORY } from "./categories";
import { weddingOverview } from "./wedding";
import { byCategory, expensesBetween, lateNight, topMerchants, detectRecurring, weekdayVsWeekend } from "./analytics";
import { kstWeekStart, kstMonthStart, DAY, WEEKDAYS, kstParts, manwon } from "./time";

/** 지난주(월~일) 소비를 요약해서 직설 피드백 생성. 이미 있으면 덮어씀 */
export async function generateWeeklyFeedback(now = new Date()) {
  const weekStart = kstWeekStart(now, -1);
  const weekEnd = kstWeekStart(now);
  const prevWeekStart = kstWeekStart(now, -2);

  const [week, prevWeek, quarter, goal, incomeAgg] = await Promise.all([
    expensesBetween(weekStart, weekEnd, { living: true }),
    expensesBetween(prevWeekStart, weekStart, { living: true }),
    expensesBetween(kstMonthStart(now, -3), weekEnd, { living: true }),
    getGoalStatus(now),
    prisma.transaction.aggregate({
      _sum: { amount: true },
      where: { type: "INCOME", status: { not: "IGNORED" }, cancelled: false, occurredAt: { gte: weekStart, lt: weekEnd } },
    }),
  ]);

  const wedding = await weddingOverview(now);
  const weddingPaidThisWeek = await prisma.transaction.aggregate({
    _sum: { amount: true },
    where: { ...ACTIVE, type: "EXPENSE", category: WEDDING_CATEGORY, occurredAt: { gte: weekStart, lt: weekEnd } },
  });
  const total = week.reduce((s, t) => s + t.amount, 0);
  const prevTotal = prevWeek.reduce((s, t) => s + t.amount, 0);
  const dayTotals = Array(7).fill(0) as number[];
  for (const t of week) dayTotals[kstParts(t.occurredAt).weekday] += t.amount;

  const stats = {
    기간: `${kstParts(weekStart).month + 1}/${kstParts(weekStart).date} ~ ${kstParts(new Date(weekEnd.getTime() - DAY)).month + 1}/${kstParts(new Date(weekEnd.getTime() - DAY)).date}`,
    이번주_생활비: total,
    지난주_생활비: prevTotal,
    이번주_결혼준비_결제: weddingPaidThisWeek._sum.amount ?? 0,
    이번주_수입: incomeAgg._sum.amount ?? 0,
    카테고리별: byCategory(week),
    요일별: WEEKDAYS.map((w, i) => ({ 요일: w, 금액: dayTotals[i] })),
    심야소비_23시_4시: lateNight(week),
    평일vs주말_일평균: weekdayVsWeekend(week, 7),
    많이쓴곳: topMerchants(week, 5),
    결제건수: week.length,
    고정비_구독: detectRecurring(quarter).map((r) => ({ 가맹점: r.merchant, 금액: r.amount, 매월: `${r.dayOfMonth}일` })),
    목표: goal && {
      이름: goal.goal.title,
      목표액: goal.goal.targetAmount,
      현재_목표진행: goal.progressAmount,
      이미_결혼준비에_쓴돈: goal.weddingSpent,
      남은일수: goal.daysLeft,
      월_필요저축: Math.round(goal.requiredPerMonth),
      이번달_순저축: goal.monthNet,
      페이스_맞음: goal.onTrack,
    },
    결혼예산: wedding.items.length
      ? {
          총예산: wedding.budget,
          낸돈: wedding.paid,
          남은돈: wedding.remaining,
          예산_미정_항목수: wedding.undecided,
          다가오는_잔금: wedding.upcoming
            .filter((i) => i.daysUntil <= 60)
            .map((i) => ({ 항목: i.name, 금액: i.due, 남은일수: i.daysUntil })),
        }
      : null,
  };

  const llm = await askLLM({
    system: [
      "너는 결혼자금을 모으는 20대 후반 직장인의 가계부 코치다.",
      "생활비만 평가해. 결혼준비 결제(계약금·잔금)는 낭비가 아니라 계획된 지출이니 지적하지 말고, 다가오는 잔금이 있으면 그 돈이 준비돼 있는지만 짚어.",
      "토스 앱처럼 친절한 존댓말(~해요, ~해 보세요)로, 짧고 분명하게 써. 비난하거나 훈계하지 말고, 잘한 점은 근거 있을 때 한 줄 칭찬해. 개선점은 숫자로 구체적으로 제안해.",
      "형식: 첫 줄에 한 줄 총평. 그 다음 '- '로 시작하는 불릿 3~5개 (패턴 지적, 원인 추정, 다음 주 구체적 행동 1개 이상).",
      "마지막 줄은 '다음 주 목표: ...' 한 줄. 마크다운 헤더, 이모지 남발 금지. 금액은 '만원' 단위로 반올림.",
      "데이터에 없는 사실은 지어내지 마.",
    ].join("\n"),
    user: `지난주 가계부 데이터(JSON):\n${JSON.stringify(stats)}`,
    maxTokens: 700,
  });

  const content = llm ?? ruleBasedFeedback(stats);
  const saved = await prisma.feedback.upsert({
    where: { weekStart },
    create: { weekStart, content, model: llm ? LLM_MODEL : "rule-based" },
    update: { content, model: llm ? LLM_MODEL : "rule-based", createdAt: new Date() },
  });
  return saved;
}

/** API 키 없을 때 쓰는 규칙 기반 피드백 */
function ruleBasedFeedback(s: {
  이번주_생활비: number;
  지난주_생활비: number;
  카테고리별: { category: string; amount: number }[];
  심야소비_23시_4시: { count: number; amount: number };
  평일vs주말_일평균: { weekdayPerDay: number; weekendPerDay: number };
  많이쓴곳: { merchant: string; amount: number; count: number }[];
  목표: null | { 월_필요저축: number; 이번달_순저축: number; 페이스_맞음: boolean; 이름: string };
  결혼예산: null | { 다가오는_잔금: { 항목: string; 금액: number; 남은일수: number }[] };
}) {
  const lines: string[] = [];
  const diff = s.이번주_생활비 - s.지난주_생활비;
  lines.push(
    `지난주 생활비는 ${manwon(s.이번주_생활비)}원이에요. 전주보다 ${manwon(Math.abs(diff))}원 ${diff >= 0 ? "더 썼어요" : "덜 썼어요"}.`
  );
  const top = s.카테고리별[0];
  if (top) lines.push(`- 가장 많이 쓴 곳은 ${top.category}예요. ${manwon(top.amount)}원 (${Math.round((top.amount / Math.max(1, s.이번주_생활비)) * 100)}%)`);
  if (s.심야소비_23시_4시.count > 0)
    lines.push(`- 밤 11시 이후에 ${s.심야소비_23시_4시.count}건, ${manwon(s.심야소비_23시_4시.amount)}원을 결제했어요. 자기 전 결제 습관을 한번 살펴봐 주세요`);
  const { weekdayPerDay, weekendPerDay } = s.평일vs주말_일평균;
  if (weekendPerDay > weekdayPerDay * 1.8)
    lines.push(`- 주말에는 하루 평균 ${manwon(weekendPerDay)}원으로 평일의 ${(weekendPerDay / Math.max(1, weekdayPerDay)).toFixed(1)}배를 썼어요`);
  const m = s.많이쓴곳.find((x) => x.count >= 3);
  if (m) lines.push(`- ${m.merchant}에 ${m.count}번 방문해서 ${manwon(m.amount)}원을 썼어요`);
  if (s.목표) {
    lines.push(
      s.목표.페이스_맞음
        ? `- ${s.목표.이름} 페이스를 잘 지키고 있어요. 이번 달 순저축은 ${manwon(s.목표.이번달_순저축)}원이에요`
        : `- ${s.목표.이름} 페이스보다 조금 늦어요. 매달 ${manwon(s.목표.월_필요저축)}원이 필요한데, 이번 달 순저축은 ${manwon(s.목표.이번달_순저축)}원이에요`
    );
  }
  for (const d of s.결혼예산?.다가오는_잔금 ?? []) {
    lines.push(`- ${d.항목} ${manwon(d.금액)}원 ${d.남은일수 < 0 ? `납부일이 ${-d.남은일수}일 지났어요` : `납부까지 ${d.남은일수}일 남았어요`}. 이 돈은 미리 따로 빼 두세요`);
  }
  lines.push(`다음 주 목표: ${top ? `${top.category} ${manwon(top.amount * 0.8)}원 이하로 써 보기` : "지출 기록 꾸준히 쌓아 보기"}`);
  return lines.join("\n");
}
