import Link from "next/link";
import { prisma } from "@/lib/db";
import { ACTIVE, getGoalStatus, type GoalStatus } from "@/lib/goal";
import { byCategory, expensesBetween } from "@/lib/analytics";
import { kstMonthStart, kstParts, manwon, monthKey, DAY } from "@/lib/time";
import { CategoryBreakdown, DailyBars } from "@/components/Charts";
import { TxRow } from "@/components/TxRow";

export const dynamic = "force-dynamic";

type Cell = { key: string; label: number; year: number; net: number | null; current: boolean };

/** 시작월~목표월까지 월별 순저축. 미래 달은 net = null */
async function monthTrack(status: NonNullable<GoalStatus>, now: Date): Promise<Cell[]> {
  const txs = await prisma.transaction.findMany({
    where: { ...ACTIVE, occurredAt: { gte: kstMonthStart(status.goal.startDate) } },
    select: { type: true, amount: true, occurredAt: true },
  });
  const net = new Map<string, number>();
  for (const t of txs) {
    const k = monthKey(t.occurredAt);
    net.set(k, (net.get(k) ?? 0) + (t.type === "INCOME" ? t.amount : -t.amount));
  }
  const nowKey = monthKey(now);
  const endKey = monthKey(status.goal.targetDate);
  const cells: Cell[] = [];
  for (let i = 0; i < 120; i++) {
    const d = new Date(kstMonthStart(status.goal.startDate, i).getTime() + DAY);
    const key = monthKey(d);
    const p = kstParts(d);
    cells.push({ key, label: p.month + 1, year: p.year, net: key <= nowKey ? net.get(key) ?? 0 : null, current: key === nowKey });
    if (key >= endKey) break;
  }
  return cells;
}

function paceMessage(s: NonNullable<GoalStatus>) {
  if (s.remaining === 0) return { ok: true, text: "목표 금액 다 모았어" };
  if (!s.projectedDate || s.projectedDate.getTime() - s.goal.targetDate.getTime() > 5 * 365 * DAY) {
    return { ok: false, text: `최근 페이스로는 목표일까지 못 모아. 매달 ${manwon(s.requiredPerMonth)}원은 남겨야 함` };
  }
  const p = kstParts(s.projectedDate);
  const gapMonths = Math.round((s.goal.targetDate.getTime() - s.projectedDate.getTime()) / (30.44 * DAY));
  const when = `${p.year}년 ${p.month + 1}월`;
  if (s.onTrack) return { ok: true, text: `이 페이스면 ${when}에 다 모음${gapMonths > 0 ? `, 목표보다 ${gapMonths}개월 빠름` : ""}` };
  return { ok: false, text: `이 페이스면 ${when}에 다 모음, 목표보다 ${Math.max(1, -gapMonths)}개월 늦음` };
}

export default async function Home() {
  const now = new Date();
  const monthStart = kstMonthStart(now);
  const [status, monthExpenses, recent, reviewCount, feedback, members] = await Promise.all([
    getGoalStatus(now),
    expensesBetween(monthStart, kstMonthStart(now, 1)),
    prisma.transaction.findMany({ orderBy: { occurredAt: "desc" }, take: 6, include: { member: true } }),
    prisma.transaction.count({ where: { status: "REVIEW" } }),
    prisma.feedback.findFirst({ orderBy: { weekStart: "desc" } }),
    prisma.member.findMany({ include: { transactions: { where: { status: { not: "IGNORED" }, cancelled: false, occurredAt: { gte: monthStart } } } } }),
  ]);
  const track = status ? await monthTrack(status, now) : [];

  const { year, month, date } = kstParts(now);
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const daily = Array.from({ length: daysInMonth }, (_, i) => ({ day: `${i + 1}`, amount: 0 }));
  for (const t of monthExpenses) daily[kstParts(t.occurredAt).date - 1].amount += t.amount;

  // 이번 달 목표 저축을 맞추려면 하루에 쓸 수 있는 돈
  const budgetPerDay = status ? Math.max(0, (status.monthIncome - status.requiredPerMonth) / daysInMonth) : 0;
  const monthSpent = monthExpenses.reduce((s, t) => s + t.amount, 0);
  const overDays = budgetPerDay ? daily.slice(0, date).filter((d) => d.amount > budgetPerDay).length : 0;
  const baseline = status ? (status.goal.targetAmount - status.goal.startAmount) / Math.max(1, track.length) : 1;
  const pace = status ? paceMessage(status) : null;

  return (
    <main className="space-y-7">
      {reviewCount > 0 && (
        <Link
          href="/transactions?status=REVIEW"
          className="flex items-center justify-between rounded-xl bg-spend-soft px-4 py-3 text-sm font-semibold text-spend"
        >
          <span>카테고리 확인이 필요한 결제 {reviewCount}건</span>
          <span className="text-xs">확인하기</span>
        </Link>
      )}

      {status ? (
        <section className="rounded-[20px] bg-cover p-5 text-cover-ink">
          <div className="flex items-baseline justify-between">
            <p className="text-[15px] font-semibold text-cover-sub">{status.goal.title}</p>
            <p className="num text-[15px] font-bold">D-{status.daysLeft}</p>
          </div>
          <p className="num mt-3 text-[40px] leading-none font-extrabold">
            {manwon(status.current)}
            <span className="ml-0.5 text-[24px] font-bold">원</span>
          </p>
          <p className="mt-2 text-[14px] text-cover-sub">
            <span className="num">{manwon(status.goal.targetAmount)}원</span> 중{" "}
            <b className="num text-cover-ink">{Math.floor(status.progress * 100)}%</b> 모음
          </p>

          <div className="mt-6">
            <div className="mb-2 flex items-baseline justify-between text-[12px] text-cover-sub">
              <span>월별 저축</span>
              <span className="num">한 칸 기준 {manwon(baseline)}원</span>
            </div>
            <div className="flex h-9 items-end gap-[3px]">
              {track.map((c) => {
                const ratio = c.net == null ? 0 : Math.max(0, Math.min(1, c.net / baseline));
                const neg = c.net != null && c.net < 0;
                return (
                  <div
                    key={c.key}
                    title={c.net == null ? `${c.year}.${c.label}` : `${c.year}.${c.label} 순저축 ${manwon(c.net)}원`}
                    className={`relative h-full flex-1 overflow-hidden rounded-[4px] ${
                      c.current ? "ring-1 ring-cover-ink ring-offset-0" : ""
                    } ${neg ? "bg-spend/70" : "bg-cover-line"}`}
                  >
                    {!neg && <span className="absolute inset-x-0 bottom-0 bg-save" style={{ height: `${ratio * 100}%` }} />}
                  </div>
                );
              })}
            </div>
            <div className="num mt-1.5 flex justify-between text-[11px] text-cover-sub">
              <span>{track[0]?.year}.{track[0]?.label}</span>
              <span>{track.at(-1)?.year}.{track.at(-1)?.label}</span>
            </div>
          </div>

          {pace && (
            <p className="mt-5 flex items-start gap-2 border-t border-cover-line pt-4 text-[14px] leading-snug">
              <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${pace.ok ? "bg-save" : "bg-spend"}`} />
              {pace.text}
            </p>
          )}
        </section>
      ) : (
        <Link href="/settings" className="block rounded-[20px] bg-cover p-6 text-cover-ink">
          <p className="text-lg font-bold">목표부터 정하자</p>
          <p className="mt-1 text-sm text-cover-sub">목표 금액이랑 날짜를 넣으면 매달 얼마 모아야 하는지 계산해줌</p>
        </Link>
      )}

      <section>
        <h2 className="section-title">
          {month + 1}월 통장
          <small>{date}일째</small>
        </h2>
        <div className="card !py-1">
          <div className="ledger">
            <Row label="들어온 돈" value={`+${manwon(status?.monthIncome ?? 0)}원`} tone="save" />
            <Row label="나간 돈" value={`−${manwon(monthSpent)}원`} />
            {status && (
              <div className="py-3.5">
                <div className="flex items-baseline justify-between">
                  <span className="text-[15px] font-semibold">남은 돈</span>
                  <span className={`num text-[17px] font-bold ${status.monthNet >= status.requiredPerMonth ? "text-save" : "text-spend"}`}>
                    {manwon(status.monthNet)}원
                  </span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-paper">
                  <div
                    className={`h-full rounded-full ${status.monthNet >= status.requiredPerMonth ? "bg-save" : "bg-spend"}`}
                    style={{ width: `${Math.max(0, Math.min(1, status.monthNet / Math.max(1, status.requiredPerMonth))) * 100}%` }}
                  />
                </div>
                <p className="mt-1.5 text-[12px] text-sub">
                  이번 달 목표 <span className="num">{manwon(status.requiredPerMonth)}원</span>
                  {status.monthNet >= status.requiredPerMonth
                    ? " 채움"
                    : `까지 ${manwon(status.requiredPerMonth - status.monthNet)}원 남음`}
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      <section>
        <h2 className="section-title">
          하루 지출
          {budgetPerDay > 0 && <small>점선 = 하루 {manwon(budgetPerDay)}원</small>}
        </h2>
        <div className="card">
          <DailyBars data={daily} budgetPerDay={budgetPerDay || undefined} today={date} />
          {budgetPerDay > 0 && (
            <p className="mt-2 text-[13px] text-sub">
              {overDays ? (
                <>이번 달 <b className="text-spend">{overDays}일</b>은 하루 권장액을 넘김</>
              ) : (
                "아직 하루 권장액 넘긴 날 없음"
              )}
            </p>
          )}
        </div>
      </section>

      <section>
        <h2 className="section-title">어디에 썼나</h2>
        <div className="card">
          <CategoryBreakdown data={byCategory(monthExpenses)} />
        </div>
      </section>

      {members.length > 1 && (
        <section>
          <h2 className="section-title">이번 달 각자</h2>
          <div className="card !py-1">
            <ul className="ledger">
              {members.map((m) => {
                const inc = m.transactions.filter((t) => t.type === "INCOME").reduce((s, t) => s + t.amount, 0);
                const exp = m.transactions.filter((t) => t.type === "EXPENSE").reduce((s, t) => s + t.amount, 0);
                return (
                  <li key={m.id} className="flex items-center justify-between py-3 text-[14px]">
                    <span className="font-semibold">{m.name}</span>
                    <span className="num text-sub">
                      <span className="text-save">+{manwon(inc)}</span> <span>−{manwon(exp)}</span>
                      <b className={`ml-2 ${inc - exp >= 0 ? "text-ink" : "text-spend"}`}>{manwon(inc - exp)}</b>
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>
      )}

      {feedback && (
        <Link href="/feedback" className="block rounded-2xl border-l-4 border-save bg-card px-4 py-3.5">
          <p className="text-[12px] font-semibold text-save">지난주 코멘트</p>
          <p className="mt-1 text-[15px] leading-snug font-semibold">{feedback.content.split("\n")[0]}</p>
        </Link>
      )}

      <section>
        <h2 className="section-title">
          최근 결제
          <Link href="/transactions" className="text-[13px] font-semibold text-save">
            전체 보기
          </Link>
        </h2>
        <div className="card !py-1">
          {recent.length ? (
            <div className="ledger">{recent.map((t) => <TxRow key={t.id} t={t} />)}</div>
          ) : (
            <p className="py-8 text-center text-sm text-sub">폰 앱을 연결하면 결제 알림이 여기 쌓여</p>
          )}
        </div>
      </section>
    </main>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: "save" }) {
  return (
    <div className="flex items-baseline justify-between py-3.5">
      <span className="text-[15px] text-sub">{label}</span>
      <span className={`num text-[17px] font-bold ${tone === "save" ? "text-save" : ""}`}>{value}</span>
    </div>
  );
}
