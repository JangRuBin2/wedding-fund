import { prisma } from "./db";
import { askLLM, LLM_MODEL } from "./llm";
import { getGoalStatus } from "./goal";
import { byCategory, expensesBetween, lateNight, topMerchants, detectRecurring, weekdayVsWeekend } from "./analytics";
import { kstWeekStart, kstMonthStart, DAY, WEEKDAYS, kstParts, manwon } from "./time";

/** 지난주(월~일) 소비를 요약해서 직설 피드백 생성. 이미 있으면 덮어씀 */
export async function generateWeeklyFeedback(now = new Date()) {
  const weekStart = kstWeekStart(now, -1);
  const weekEnd = kstWeekStart(now);
  const prevWeekStart = kstWeekStart(now, -2);

  const [week, prevWeek, quarter, goal, incomeAgg] = await Promise.all([
    expensesBetween(weekStart, weekEnd),
    expensesBetween(prevWeekStart, weekStart),
    expensesBetween(kstMonthStart(now, -3), weekEnd),
    getGoalStatus(now),
    prisma.transaction.aggregate({
      _sum: { amount: true },
      where: { type: "INCOME", status: { not: "IGNORED" }, cancelled: false, occurredAt: { gte: weekStart, lt: weekEnd } },
    }),
  ]);

  const total = week.reduce((s, t) => s + t.amount, 0);
  const prevTotal = prevWeek.reduce((s, t) => s + t.amount, 0);
  const dayTotals = Array(7).fill(0) as number[];
  for (const t of week) dayTotals[kstParts(t.occurredAt).weekday] += t.amount;

  const stats = {
    기간: `${kstParts(weekStart).month + 1}/${kstParts(weekStart).date} ~ ${kstParts(new Date(weekEnd.getTime() - DAY)).month + 1}/${kstParts(new Date(weekEnd.getTime() - DAY)).date}`,
    이번주_지출: total,
    지난주_지출: prevTotal,
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
      현재: goal.current,
      남은일수: goal.daysLeft,
      월_필요저축: Math.round(goal.requiredPerMonth),
      이번달_순저축: goal.monthNet,
      페이스_맞음: goal.onTrack,
    },
  };

  const llm = await askLLM({
    system: [
      "너는 결혼자금을 모으는 20대 후반 직장인의 가계부 코치다.",
      "반말, 직설적, 짧게. 칭찬은 근거 있을 때만 한 줄. 돌려 말하지 말고 숫자로 말해.",
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
  이번주_지출: number;
  지난주_지출: number;
  카테고리별: { category: string; amount: number }[];
  심야소비_23시_4시: { count: number; amount: number };
  평일vs주말_일평균: { weekdayPerDay: number; weekendPerDay: number };
  많이쓴곳: { merchant: string; amount: number; count: number }[];
  목표: null | { 월_필요저축: number; 이번달_순저축: number; 페이스_맞음: boolean; 이름: string };
}) {
  const lines: string[] = [];
  const diff = s.이번주_지출 - s.지난주_지출;
  lines.push(
    `지난주 지출 ${manwon(s.이번주_지출)}원, 전주 대비 ${diff >= 0 ? "+" : ""}${manwon(diff)}원.`
  );
  const top = s.카테고리별[0];
  if (top) lines.push(`- 제일 많이 쓴 건 ${top.category} ${manwon(top.amount)}원 (${Math.round((top.amount / Math.max(1, s.이번주_지출)) * 100)}%)`);
  if (s.심야소비_23시_4시.count > 0)
    lines.push(`- 밤 11시 이후 결제 ${s.심야소비_23시_4시.count}건, ${manwon(s.심야소비_23시_4시.amount)}원. 자기 전 결제 습관 체크`);
  const { weekdayPerDay, weekendPerDay } = s.평일vs주말_일평균;
  if (weekendPerDay > weekdayPerDay * 1.8)
    lines.push(`- 주말 하루 평균 ${manwon(weekendPerDay)}원으로 평일의 ${(weekendPerDay / Math.max(1, weekdayPerDay)).toFixed(1)}배`);
  const m = s.많이쓴곳.find((x) => x.count >= 3);
  if (m) lines.push(`- ${m.merchant} ${m.count}번 방문, ${manwon(m.amount)}원`);
  if (s.목표) {
    lines.push(
      s.목표.페이스_맞음
        ? `- ${s.목표.이름} 페이스는 맞는 중. 이번 달 순저축 ${manwon(s.목표.이번달_순저축)}원`
        : `- ${s.목표.이름} 페이스 밀림. 매달 ${manwon(s.목표.월_필요저축)}원 모아야 하는데 이번 달 순저축 ${manwon(s.목표.이번달_순저축)}원`
    );
  }
  lines.push(`다음 주 목표: ${top ? `${top.category} ${manwon(top.amount * 0.8)}원 이하` : "지출 기록 꾸준히 쌓기"}`);
  return lines.join("\n");
}
