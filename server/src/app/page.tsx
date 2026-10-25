import Link from "next/link";
import { prisma } from "@/lib/db";
import { ACTIVE, getGoalStatus, type GoalStatus } from "@/lib/goal";
import { byCategory, detectRecurring, expensesBetween } from "@/lib/analytics";
import { normalizeMerchant } from "@/lib/parser";
import { WEDDING_CATEGORY } from "@/lib/categories";
import { dueLabel, weddingOverview } from "@/lib/wedding";
import { kstMonthStart, kstParts, manwon, monthKey, DAY } from "@/lib/time";
import { CategoryBreakdown, DailyBars } from "@/components/Charts";
import { TxRow } from "@/components/TxRow";

export const dynamic = "force-dynamic";

type Cell = { key: string; label: number; year: number; net: number | null; current: boolean };

/** 시작월~목표월까지 월별로 목표 쪽으로 간 돈(수입 − 생활비). 미래 달은 net = null */
async function monthTrack(status: NonNullable<GoalStatus>, now: Date): Promise<Cell[]> {
  const txs = await prisma.transaction.findMany({
    where: { ...ACTIVE, occurredAt: { gte: kstMonthStart(status.goal.startDate) } },
    select: { type: true, amount: true, occurredAt: true, category: true },
  });
  const net = new Map<string, number>();
  for (const t of txs) {
    if (t.type === "EXPENSE" && t.category === WEDDING_CATEGORY) continue;
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
  const [status, living, history, recent, reviewCount, feedback, members, wedding] = await Promise.all([
    getGoalStatus(now),
    expensesBetween(monthStart, kstMonthStart(now, 1), { living: true }),
    expensesBetween(kstMonthStart(now, -4), monthStart, { living: true }),
    prisma.transaction.findMany({ orderBy: { occurredAt: "desc" }, take: 5, include: { member: true } }),
    prisma.transaction.count({ where: { status: "REVIEW" } }),
    prisma.feedback.findFirst({ orderBy: { weekStart: "desc" } }),
    prisma.member.findMany({ include: { transactions: { where: { ...ACTIVE, occurredAt: { gte: monthStart } } } } }),
    weddingOverview(now),
  ]);
  const track = status ? await monthTrack(status, now) : [];

  const { year, month, date } = kstParts(now);
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const daysLeftInMonth = daysInMonth - date + 1;
  // 고정비(월세·통신·구독)는 날짜 되면 어차피 나가는 돈 → 먼저 떼어두고, 하루 단위는 변동 생활비만 봄
  const fixed = detectRecurring([...history, ...living]);
  const fixedKeys = new Set(fixed.map((f) => normalizeMerchant(f.merchant)));
  const isFixed = (m: string) => fixedKeys.has(normalizeMerchant(m));
  const fixedTotal = fixed.reduce((s, f) => s + f.amount, 0);
  const fixedPaid = living.filter((t) => isFixed(t.merchant)).reduce((s, t) => s + t.amount, 0);
  const fixedComing = Math.max(0, fixedTotal - fixedPaid);
  const variable = living.filter((t) => !isFixed(t.merchant));

  const daily = Array.from({ length: daysInMonth }, (_, i) => ({ day: `${i + 1}`, amount: 0 }));
  for (const t of variable) daily[kstParts(t.occurredAt).date - 1].amount += t.amount;
  const livingSpent = living.reduce((s, t) => s + t.amount, 0);
  const variableSpent = variable.reduce((s, t) => s + t.amount, 0);
  const spentToday = daily[date - 1].amount;

  // 이번 달 생활비 한도 = 예상 수입 − 목표 저축. 거기서 고정비 떼고 남은 날짜로 나누면 '오늘 쓸 수 있는 돈'
  const livingBudget = status ? Math.max(0, status.expectedIncome - status.requiredPerMonth) : 0;
  const variableBudget = Math.max(0, livingBudget - fixedTotal);
  const variableLeft = variableBudget - variableSpent; // 오늘 쓴 것까지 포함
  const perDay = (variableLeft + spentToday) / daysLeftInMonth; // 오늘 아침 기준 하루 몫
  const todayLeft = perDay - spentToday;
  const tomorrowPerDay = daysLeftInMonth > 1 ? Math.max(0, variableLeft) / (daysLeftInMonth - 1) : 0;
  const avgPerDay = variableBudget / daysInMonth;
  const overDays = avgPerDay ? daily.slice(0, date).filter((d) => d.amount > avgPerDay).length : 0;

  const baseline = status ? (status.goal.targetAmount - status.goal.startAmount) / Math.max(1, track.length) : 1;
  const pace = status ? paceMessage(status) : null;
  const upcoming = wedding.upcoming.filter((i) => i.daysUntil <= 90).slice(0, 3);

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
            {manwon(status.progressAmount)}
            <span className="ml-0.5 text-[24px] font-bold">원</span>
          </p>
          <p className="mt-2 text-[14px] text-cover-sub">
            <span className="num">{manwon(status.goal.targetAmount)}원</span> 중{" "}
            <b className="num text-cover-ink">{Math.floor(status.progress * 100)}%</b> 모음
          </p>
          {status.weddingSpent > 0 && (
            <p className="num mt-1 text-[12px] text-cover-sub">
              통장 {manwon(status.balance)}원 + 결혼준비에 이미 쓴 {manwon(status.weddingSpent)}원
            </p>
          )}

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
                    title={c.net == null ? `${c.year}.${c.label}` : `${c.year}.${c.label} 저축 ${manwon(c.net)}원`}
                    className={`relative h-full flex-1 overflow-hidden rounded-[4px] ${c.current ? "ring-1 ring-cover-ink" : ""} ${
                      neg ? "bg-spend/70" : "bg-cover-line"
                    }`}
                  >
                    {!neg && <span className="absolute inset-x-0 bottom-0 bg-save" style={{ height: `${ratio * 100}%` }} />}
                  </div>
                );
              })}
            </div>
            <div className="num mt-1.5 flex justify-between text-[11px] text-cover-sub">
              <span>
                {track[0]?.year}.{track[0]?.label}
              </span>
              <span>
                {track.at(-1)?.year}.{track.at(-1)?.label}
              </span>
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

      {status && (
        <section className="card">
          {variableLeft <= 0 ? (
            <>
              <p className="text-[14px] text-sub">이번 달 생활비</p>
              <p className="num mt-1 text-[26px] leading-tight font-extrabold text-spend">{manwon(-variableLeft)}원 넘음</p>
              <p className="mt-1.5 text-[13px] leading-snug text-sub">
                목표 저축 <span className="num">{manwon(status.requiredPerMonth)}원</span>을 지키려면 남은 {daysLeftInMonth}일은 꼭 필요한 데만 쓰자
              </p>
            </>
          ) : todayLeft > 0 ? (
            <>
              <p className="text-[14px] text-sub">오늘 더 쓸 수 있는 돈</p>
              <p className="num mt-1 text-[30px] leading-tight font-extrabold">
                {manwon(todayLeft)}
                <span className="text-[18px] font-bold">원</span>
              </p>
              <p className="mt-1.5 text-[13px] leading-snug text-sub">
                오늘 몫 <span className="num">{manwon(perDay)}원</span>
                {spentToday > 0 ? (
                  <>
                    {" "}중 <span className="num">{manwon(spentToday)}원</span> 씀
                  </>
                ) : null}
                . 이번 달 남은 {daysLeftInMonth}일 동안 <span className="num">{manwon(variableLeft)}원</span>
              </p>
            </>
          ) : (
            <>
              <p className="text-[14px] text-sub">
                오늘 몫 <span className="num">{manwon(perDay)}원</span> 중 <span className="num">{manwon(spentToday)}원</span> 씀
              </p>
              <p className="num mt-1 text-[26px] leading-tight font-extrabold text-spend">{manwon(-todayLeft)}원 넘음</p>
              <p className="mt-1.5 text-[13px] leading-snug text-sub">
                {daysLeftInMonth > 1 ? (
                  <>
                    내일부터는 하루 <b className="num text-ink">{manwon(tomorrowPerDay)}원</b>씩 쓰면 이번 달 목표 지킬 수 있어
                  </>
                ) : (
                  "오늘이 이번 달 마지막 날"
                )}
              </p>
            </>
          )}
          {fixedTotal > 0 && (
            <p className="mt-3 border-t border-line pt-3 text-[12px] text-sub">
              월세·구독 같은 고정비 <span className="num">{manwon(fixedTotal)}원</span>은 따로 뺐어
              {fixedComing > 0 && (
                <>
                  , 이번 달 <span className="num">{manwon(fixedComing)}원</span> 더 나갈 예정
                </>
              )}
            </p>
          )}
        </section>
      )}

      {upcoming.length > 0 && (
        <section>
          <h2 className="section-title">
            다가오는 결혼 준비 결제
            <Link href="/wedding" className="text-[13px] font-semibold text-save">
              예산표
            </Link>
          </h2>
          <ul className="card ledger !py-1">
            {upcoming.map((i) => (
              <li key={i.id} className="flex items-center gap-3 py-3">
                <span className={`num w-14 shrink-0 text-[13px] font-bold ${i.daysUntil < 0 ? "text-spend" : "text-sub"}`}>
                  {dueLabel(i.daysUntil)}
                </span>
                <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">{i.name}</span>
                <span className="num shrink-0 text-[15px] font-bold">{manwon(i.due)}원</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="section-title">
          {month + 1}월 통장
          <small>{date}일째</small>
        </h2>
        <div className="card !py-1">
          <div className="ledger">
            <Row label="들어온 돈" value={`+${manwon(status?.monthIncome ?? 0)}원`} tone="save" />
            <Row label="생활비" value={`−${manwon(livingSpent)}원`} />
            {status && status.monthWedding > 0 && <Row label="결혼준비 결제" value={`−${manwon(status.monthWedding)}원`} muted />}
            {status && (
              <div className="py-3.5">
                <div className="flex items-baseline justify-between">
                  <span className="text-[15px] font-semibold">모은 돈</span>
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
                  {status.monthIncome < status.expectedIncome && ", 월급 들어오기 전"}
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      <section>
        <h2 className="section-title">
          하루 생활비
          {avgPerDay > 0 && <small>고정비 제외, 점선 = 하루 {manwon(avgPerDay)}원</small>}
        </h2>
        <div className="card">
          <DailyBars data={daily} budgetPerDay={avgPerDay || undefined} today={date} />
          {avgPerDay > 0 && (
            <p className="mt-2 text-[13px] text-sub">
              {overDays ? (
                <>
                  이번 달 <b className="text-spend">{overDays}일</b>은 하루 몫을 넘김
                </>
              ) : (
                "아직 하루 몫 넘긴 날 없음"
              )}
            </p>
          )}
        </div>
      </section>

      <section>
        <h2 className="section-title">
          생활비 어디에 썼나
          <small className="num">{manwon(livingSpent)}원</small>
        </h2>
        <div className="card">
          <CategoryBreakdown data={byCategory(living)} limit={6} />
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
            <div className="ledger">
              {recent.map((t) => (
                <TxRow key={t.id} t={t} />
              ))}
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-sub">폰 앱을 연결하면 결제 알림이 여기 쌓여</p>
          )}
        </div>
      </section>
    </main>
  );
}

function Row({ label, value, tone, muted }: { label: string; value: string; tone?: "save"; muted?: boolean }) {
  return (
    <div className="flex items-baseline justify-between py-3.5">
      <span className="text-[15px] text-sub">{label}</span>
      <span className={`num text-[17px] font-bold ${tone === "save" ? "text-save" : ""} ${muted ? "text-sub" : ""}`}>{value}</span>
    </div>
  );
}
