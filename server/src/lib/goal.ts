import { prisma } from "./db";
import { DAY, kstMonthStart } from "./time";
import { WEDDING_CATEGORY } from "./categories";

export const ACTIVE = { status: { not: "IGNORED" }, cancelled: false } as const;

async function sumBy(type: "INCOME" | "EXPENSE", from: Date, to?: Date, category?: string) {
  const r = await prisma.transaction.aggregate({
    _sum: { amount: true },
    where: { ...ACTIVE, type, ...(category ? { category } : {}), occurredAt: { gte: from, ...(to ? { lt: to } : {}) } },
  });
  return r._sum.amount ?? 0;
}

export type GoalStatus = Awaited<ReturnType<typeof getGoalStatus>>;

/**
 * 돈 모델
 * - 통장 잔액(balance) = 이미 모아둔 돈 + 시작 후 (수입 − 지출)
 * - 결혼준비 카테고리 지출은 '결혼자금을 쓴 것'이라 낭비가 아님 → 목표 진행(progressAmount)에 다시 더함
 * - 생활비(living) = 지출 − 결혼준비. 페이스·하루 권장액은 생활비 기준
 * - 저축 카테고리(적금·청약 이체)는 IGNORED라 애초에 집계에 안 들어감
 */
export async function getGoalStatus(now = new Date()) {
  const goal = await prisma.goal.findUnique({ where: { id: 1 } });
  if (!goal) return null;

  const monthStart = kstMonthStart(now);
  const windowStart = new Date(Math.max(goal.startDate.getTime(), now.getTime() - 90 * DAY));
  const [incomeSince, expenseSince, weddingSpent, monthIncome, monthExpense, monthWedding, wIn, wOut, wWed, pastIncome] =
    await Promise.all([
      sumBy("INCOME", goal.startDate),
      sumBy("EXPENSE", goal.startDate),
      sumBy("EXPENSE", goal.startDate, undefined, WEDDING_CATEGORY),
      sumBy("INCOME", monthStart),
      sumBy("EXPENSE", monthStart),
      sumBy("EXPENSE", monthStart, undefined, WEDDING_CATEGORY),
      sumBy("INCOME", windowStart),
      sumBy("EXPENSE", windowStart),
      sumBy("EXPENSE", windowStart, undefined, WEDDING_CATEGORY),
      sumBy("INCOME", kstMonthStart(now, -3), monthStart),
    ]);

  const balance = goal.startAmount + incomeSince - expenseSince;
  const progressAmount = balance + weddingSpent;
  const remaining = Math.max(0, goal.targetAmount - progressAmount);
  const daysLeft = Math.max(0, Math.ceil((goal.targetDate.getTime() - now.getTime()) / DAY));
  const monthsLeft = Math.max(daysLeft / 30.44, 0.03);
  const requiredPerMonth = remaining / monthsLeft;

  const monthLiving = monthExpense - monthWedding;
  // 월급날 전이면 이번 달 수입이 0이라 계산이 무너짐 → 최근 3개월 평균 수입과 비교해 큰 쪽
  const expectedIncome = Math.max(monthIncome, pastIncome / 3);

  // 최근 90일(또는 시작 이후) 생활비 기준 일평균 순저축으로 도달 예상일
  const windowDays = Math.max(1, (now.getTime() - windowStart.getTime()) / DAY);
  const dailyNet = (wIn - (wOut - wWed)) / windowDays;
  const projectedDate = remaining === 0 ? now : dailyNet > 0 ? new Date(now.getTime() + (remaining / dailyNet) * DAY) : null;
  const onTrack = remaining === 0 || (projectedDate != null && projectedDate <= goal.targetDate);

  return {
    goal,
    /** 통장에 실제로 남은 돈 */
    balance,
    /** 목표 진행 = 잔액 + 이미 결혼에 쓴 돈 */
    progressAmount,
    /** 하위 호환 */
    current: progressAmount,
    weddingSpent,
    remaining,
    progress: Math.min(1, Math.max(0, progressAmount / goal.targetAmount)),
    daysLeft,
    requiredPerMonth,
    monthIncome,
    expectedIncome,
    monthExpense,
    monthWedding,
    monthLiving,
    /** 이번 달 목표 쪽으로 간 돈 (결혼준비 결제 포함) */
    monthNet: monthIncome - monthLiving,
    dailyNet,
    projectedDate,
    onTrack,
  };
}

/** 큰 결제 직후 '목표가 며칠 밀렸는지' 넛지 문구 */
export async function buildNudge(amount: number, merchant: string): Promise<string | null> {
  const s = await getGoalStatus();
  if (!s || amount < s.goal.bigSpendThreshold) return null;
  const won = amount.toLocaleString("ko-KR");
  if (s.dailyNet <= 0) {
    return `${merchant}에서 ${won}원 결제했어요. 지금 페이스로는 ${s.goal.title} 목표를 맞추기 어려워요. 이번 달 남은 지출을 한번 살펴봐 주세요`;
  }
  const delay = Math.max(1, Math.round(amount / s.dailyNet));
  return `${merchant}에서 ${won}원 결제했어요. ${s.goal.title} 목표가 약 ${delay}일 늦어져요`;
}
