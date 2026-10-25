import { prisma } from "./db";
import { DAY, kstMonthStart } from "./time";

export const ACTIVE = { status: { not: "IGNORED" }, cancelled: false } as const;

async function sumBy(type: "INCOME" | "EXPENSE", from: Date, to?: Date) {
  const r = await prisma.transaction.aggregate({
    _sum: { amount: true },
    where: { ...ACTIVE, type, occurredAt: { gte: from, ...(to ? { lt: to } : {}) } },
  });
  return r._sum.amount ?? 0;
}

export type GoalStatus = Awaited<ReturnType<typeof getGoalStatus>>;

export async function getGoalStatus(now = new Date()) {
  const goal = await prisma.goal.findUnique({ where: { id: 1 } });
  if (!goal) return null;

  const [incomeSince, expenseSince] = await Promise.all([
    sumBy("INCOME", goal.startDate),
    sumBy("EXPENSE", goal.startDate),
  ]);
  const current = goal.startAmount + incomeSince - expenseSince;
  const remaining = Math.max(0, goal.targetAmount - current);
  const daysLeft = Math.max(0, Math.ceil((goal.targetDate.getTime() - now.getTime()) / DAY));
  const monthsLeft = Math.max(daysLeft / 30.44, 0.03);
  const requiredPerMonth = remaining / monthsLeft;

  const monthStart = kstMonthStart(now);
  const [monthIncome, monthExpense] = await Promise.all([sumBy("INCOME", monthStart), sumBy("EXPENSE", monthStart)]);

  // 최근 90일(또는 시작 이후) 평균 일일 순저축으로 도달 예상일 계산
  const windowStart = new Date(Math.max(goal.startDate.getTime(), now.getTime() - 90 * DAY));
  const windowDays = Math.max(1, (now.getTime() - windowStart.getTime()) / DAY);
  const [wIn, wOut] = await Promise.all([sumBy("INCOME", windowStart), sumBy("EXPENSE", windowStart)]);
  const dailyNet = (wIn - wOut) / windowDays;
  const projectedDate = dailyNet > 0 ? new Date(now.getTime() + (remaining / dailyNet) * DAY) : null;
  const onTrack = remaining === 0 || (projectedDate != null && projectedDate <= goal.targetDate);

  return {
    goal,
    current,
    remaining,
    progress: Math.min(1, current / goal.targetAmount),
    daysLeft,
    requiredPerMonth,
    monthIncome,
    monthExpense,
    monthNet: monthIncome - monthExpense,
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
    return `${merchant} ${won}원 결제됨. 지금 페이스로는 ${s.goal.title} 목표 못 맞춤. 이번 달 남은 지출 다시 봐야 함`;
  }
  const delay = Math.max(1, Math.round(amount / s.dailyNet));
  return `${merchant} ${won}원 → ${s.goal.title} 목표 약 ${delay}일 밀림`;
}
