import { prisma } from "./db";
import { ACTIVE } from "./goal";
import { kstParts, kstMonthStart, monthKey, DAY } from "./time";
import { normalizeMerchant } from "./parser";

export async function expensesBetween(from: Date, to: Date) {
  return prisma.transaction.findMany({
    where: { ...ACTIVE, type: "EXPENSE", occurredAt: { gte: from, lt: to } },
    orderBy: { occurredAt: "asc" },
  });
}

type Tx = Awaited<ReturnType<typeof expensesBetween>>[number];

export function byCategory(txs: Tx[]) {
  const map = new Map<string, number>();
  for (const t of txs) map.set(t.category, (map.get(t.category) ?? 0) + t.amount);
  return [...map.entries()].map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount);
}

/** 7(요일) x 24(시) 소비 히트맵 */
export function heatmap(txs: Tx[]) {
  const grid = Array.from({ length: 7 }, () => Array(24).fill(0) as number[]);
  for (const t of txs) {
    const { weekday, hour } = kstParts(t.occurredAt);
    grid[weekday][hour] += t.amount;
  }
  return grid;
}

export function lateNight(txs: Tx[]) {
  const late = txs.filter((t) => {
    const h = kstParts(t.occurredAt).hour;
    return h >= 23 || h < 4;
  });
  return {
    count: late.length,
    amount: late.reduce((s, t) => s + t.amount, 0),
    top: byCategory(late).slice(0, 3),
  };
}

export function weekdayVsWeekend(txs: Tx[], days: number) {
  let weekday = 0;
  let weekend = 0;
  for (const t of txs) {
    const w = kstParts(t.occurredAt).weekday;
    if (w === 0 || w === 6) weekend += t.amount;
    else weekday += t.amount;
  }
  const weeks = Math.max(1, days / 7);
  return { weekdayPerDay: weekday / (weeks * 5), weekendPerDay: weekend / (weeks * 2) };
}

export function topMerchants(txs: Tx[], n = 8) {
  const map = new Map<string, { merchant: string; amount: number; count: number }>();
  for (const t of txs) {
    const k = normalizeMerchant(t.merchant);
    const cur = map.get(k) ?? { merchant: t.merchant, amount: 0, count: 0 };
    cur.amount += t.amount;
    cur.count += 1;
    map.set(k, cur);
  }
  return [...map.values()].sort((a, b) => b.amount - a.amount).slice(0, n);
}

/**
 * 고정비/구독 탐지: 서로 다른 2개월 이상에서 같은 가맹점, 비슷한 금액(±10%), 비슷한 날짜(±4일)
 */
export function detectRecurring(txs: Tx[]) {
  const groups = new Map<string, Tx[]>();
  for (const t of txs) {
    const k = normalizeMerchant(t.merchant);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(t);
  }
  const result: { merchant: string; amount: number; dayOfMonth: number; months: number; lastAt: Date; category: string }[] = [];
  for (const list of groups.values()) {
    const months = new Set(list.map((t) => monthKey(t.occurredAt)));
    if (months.size < 2) continue;
    const amounts = list.map((t) => t.amount).sort((a, b) => a - b);
    const median = amounts[Math.floor(amounts.length / 2)];
    const similar = list.filter((t) => Math.abs(t.amount - median) <= median * 0.1);
    const simMonths = new Set(similar.map((t) => monthKey(t.occurredAt)));
    if (simMonths.size < 2 || similar.length > simMonths.size * 2) continue; // 자주 가는 가게 제외
    const days = similar.map((t) => kstParts(t.occurredAt).date).sort((a, b) => a - b);
    const midDay = days[Math.floor(days.length / 2)];
    if (!days.every((d) => Math.abs(d - midDay) <= 4)) continue;
    const last = similar[similar.length - 1];
    result.push({
      merchant: last.merchant,
      amount: median,
      dayOfMonth: midDay,
      months: simMonths.size,
      lastAt: last.occurredAt,
      category: last.category,
    });
  }
  return result.sort((a, b) => b.amount - a.amount);
}

/** 이번 달 vs 지난 3개월 평균, 카테고리별 증감 */
export async function categoryTrend(now = new Date()) {
  const thisStart = kstMonthStart(now);
  const prevStart = kstMonthStart(now, -3);
  const txs = await expensesBetween(prevStart, new Date(now.getTime() + DAY));
  const cur = byCategory(txs.filter((t) => t.occurredAt >= thisStart));
  const prev = byCategory(txs.filter((t) => t.occurredAt < thisStart));
  // 이번 달은 진행 중이므로 같은 일수 기준으로 비교
  const { date } = kstParts(now);
  const daysInMonth = new Date(Date.UTC(kstParts(now).year, kstParts(now).month + 1, 0)).getUTCDate();
  const elapsedRatio = date / daysInMonth;
  const cats = new Set([...cur.map((c) => c.category), ...prev.map((c) => c.category)]);
  return [...cats]
    .map((category) => {
      const now = cur.find((c) => c.category === category)?.amount ?? 0;
      const avg = (prev.find((c) => c.category === category)?.amount ?? 0) / 3;
      const pace = avg * elapsedRatio;
      return { category, now, avg, diff: now - pace, ratio: pace > 0 ? now / pace : null };
    })
    .sort((a, b) => b.diff - a.diff);
}
