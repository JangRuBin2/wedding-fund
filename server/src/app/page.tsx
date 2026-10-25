import Link from "next/link";
import { prisma } from "@/lib/db";
import { getGoalStatus } from "@/lib/goal";
import { byCategory, expensesBetween } from "@/lib/analytics";
import { kstMonthStart, kstParts, manwon, DAY } from "@/lib/time";
import { CategoryDonut, DailyBars } from "@/components/Charts";
import { TxRow } from "@/components/TxRow";

export const dynamic = "force-dynamic";

export default async function Home() {
  const now = new Date();
  const monthStart = kstMonthStart(now);
  const [status, monthExpenses, recent, reviewCount, feedback, members] = await Promise.all([
    getGoalStatus(now),
    expensesBetween(monthStart, kstMonthStart(now, 1)),
    prisma.transaction.findMany({ orderBy: { occurredAt: "desc" }, take: 8, include: { member: true } }),
    prisma.transaction.count({ where: { status: "REVIEW" } }),
    prisma.feedback.findFirst({ orderBy: { weekStart: "desc" } }),
    prisma.member.findMany({ include: { transactions: { where: { status: { not: "IGNORED" }, cancelled: false, occurredAt: { gte: monthStart } } } } }),
  ]);

  const { year, month, date } = kstParts(now);
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const daily = Array.from({ length: daysInMonth }, (_, i) => ({ day: `${i + 1}`, amount: 0 }));
  for (const t of monthExpenses) daily[kstParts(t.occurredAt).date - 1].amount += t.amount;

  // 이번 달 목표 저축을 맞추려면 하루에 쓸 수 있는 돈
  const budgetPerDay = status
    ? Math.max(0, (status.monthIncome - status.requiredPerMonth) / daysInMonth)
    : undefined;
  const monthSpent = monthExpenses.reduce((s, t) => s + t.amount, 0);

  return (
    <main className="space-y-4">
      <header className="flex items-end justify-between">
        <div>
          <p className="label">{year}년 {month + 1}월 {date}일</p>
          <h1 className="text-2xl font-bold tracking-tight">{status?.goal.title ?? "결혼자금"} 대시보드</h1>
        </div>
        {reviewCount > 0 && (
          <Link href="/transactions?status=REVIEW" className="rounded-full bg-spend-soft px-3 py-1.5 text-xs font-bold text-spend">
            확인 필요 {reviewCount}
          </Link>
        )}
      </header>

      {status ? (
        <section className="card space-y-4">
          <div className="flex items-baseline justify-between">
            <div>
              <p className="label">지금까지 모은 돈</p>
              <p className="num text-3xl font-bold">{manwon(status.current)}원</p>
            </div>
            <div className="text-right">
              <p className="label">목표 {manwon(status.goal.targetAmount)}원</p>
              <p className="num text-lg font-bold">D-{status.daysLeft}</p>
            </div>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-save-soft">
            <div className="h-full rounded-full bg-save transition-all" style={{ width: `${status.progress * 100}%` }} />
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl bg-paper p-3">
              <p className="label">매달 모아야 할 돈</p>
              <p className="num text-lg font-bold">{manwon(status.requiredPerMonth)}원</p>
            </div>
            <div className="rounded-xl bg-paper p-3">
              <p className="label">이번 달 순저축</p>
              <p className={`num text-lg font-bold ${status.monthNet >= status.requiredPerMonth ? "text-save" : "text-spend"}`}>
                {manwon(status.monthNet)}원
              </p>
            </div>
          </div>
          <p className={`rounded-xl px-3 py-2.5 text-sm font-medium ${status.onTrack ? "bg-save-soft text-save" : "bg-spend-soft text-spend"}`}>
            {status.remaining === 0
              ? "목표 달성! 🎉"
              : status.projectedDate && status.projectedDate.getTime() - status.goal.targetDate.getTime() > 5 * 365 * DAY
                ? `지금 순저축 페이스(하루 ${manwon(status.dailyNet)}원)로는 사실상 도달 불가. 매달 ${manwon(status.requiredPerMonth)}원은 남겨야 함`
                : status.projectedDate
                ? `지금 페이스면 ${kstParts(status.projectedDate).year}년 ${kstParts(status.projectedDate).month + 1}월 달성 예상 — ${status.onTrack ? "여유 있음" : `목표보다 ${Math.round((status.projectedDate.getTime() - status.goal.targetDate.getTime()) / DAY)}일 늦음`}`
                : "최근 지출이 수입보다 많아서 이 페이스론 목표 도달 불가"}
          </p>
        </section>
      ) : (
        <Link href="/settings" className="card block text-center">
          <p className="font-bold">목표부터 설정하자</p>
          <p className="mt-1 text-sm text-sub">목표 금액이랑 날짜 넣으면 페이스 계산해줌 →</p>
        </Link>
      )}

      <section className="grid grid-cols-2 gap-3">
        <div className="card">
          <p className="label">이번 달 수입</p>
          <p className="num text-xl font-bold text-save">{manwon(status?.monthIncome ?? 0)}원</p>
        </div>
        <div className="card">
          <p className="label">이번 달 지출</p>
          <p className="num text-xl font-bold text-spend">{manwon(monthSpent)}원</p>
          {budgetPerDay !== undefined && budgetPerDay > 0 && (
            <p className="mt-1 text-xs text-sub">하루 권장 {manwon(budgetPerDay)}원</p>
          )}
        </div>
      </section>

      <section className="card">
        <p className="mb-2 font-bold">일별 지출</p>
        <DailyBars data={daily} budgetPerDay={budgetPerDay && budgetPerDay > 0 ? budgetPerDay : undefined} />
        {budgetPerDay !== undefined && budgetPerDay > 0 && <p className="mt-1 text-xs text-sub">빨간 막대 = 하루 권장액 초과한 날</p>}
      </section>

      <section className="card">
        <p className="mb-3 font-bold">카테고리</p>
        <CategoryDonut data={byCategory(monthExpenses)} />
      </section>

      {members.length > 1 && (
        <section className="card">
          <p className="mb-3 font-bold">이번 달 각자 기여</p>
          <ul className="space-y-2">
            {members.map((m) => {
              const inc = m.transactions.filter((t) => t.type === "INCOME").reduce((s, t) => s + t.amount, 0);
              const exp = m.transactions.filter((t) => t.type === "EXPENSE").reduce((s, t) => s + t.amount, 0);
              return (
                <li key={m.id} className="flex items-center justify-between text-sm">
                  <span className="font-semibold">{m.name}</span>
                  <span className="num text-sub">
                    수입 {manwon(inc)} · 지출 {manwon(exp)} ·{" "}
                    <b className={inc - exp >= 0 ? "text-save" : "text-spend"}>순 {manwon(inc - exp)}</b>
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {feedback && (
        <Link href="/feedback" className="card block">
          <p className="label mb-1">이번 주 코치 한마디</p>
          <p className="text-[15px] font-semibold leading-snug">{feedback.content.split("\n")[0]}</p>
        </Link>
      )}

      <section className="card">
        <div className="mb-1 flex items-center justify-between">
          <p className="font-bold">최근 내역</p>
          <Link href="/transactions" className="text-xs font-semibold text-sub">전체 →</Link>
        </div>
        {recent.length ? (
          <div className="divide-y divide-line">{recent.map((t) => <TxRow key={t.id} t={t} />)}</div>
        ) : (
          <p className="py-6 text-center text-sm text-sub">폰 앱 연결하면 결제 알림이 여기 쌓임</p>
        )}
      </section>
    </main>
  );
}
