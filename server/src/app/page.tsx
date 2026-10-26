import Link from "next/link";
import { prisma } from "@/lib/db";
import { ACTIVE, getGoalStatus, type GoalStatus } from "@/lib/goal";
import { byCategory, detectRecurring, expensesBetween } from "@/lib/analytics";
import { normalizeMerchant } from "@/lib/parser";
import { WEDDING_CATEGORY } from "@/lib/categories";
import { dueLabel, weddingOverview } from "@/lib/wedding";
import { kstMonthStart, kstParts, manwon, monthKey, DAY, WEEKDAYS } from "@/lib/time";
import { CategoryBreakdown, DailyBars } from "@/components/Charts";
import { TxRow } from "@/components/TxRow";
import { Chevron } from "@/components/Chevron";

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
  if (s.remaining === 0) return { ok: true, icon: "🎉", text: "목표 금액을 다 모았어요!" };
  if (!s.projectedDate || s.projectedDate.getTime() - s.goal.targetDate.getTime() > 5 * 365 * DAY) {
    return { ok: false, icon: "🐢", text: `요즘 속도로는 결혼식 전까지 모으기 어려워요. 한 달에 ${manwon(s.requiredPerMonth)}원씩은 남겨야 해요` };
  }
  const p = kstParts(s.projectedDate);
  const gapMonths = Math.round((s.goal.targetDate.getTime() - s.projectedDate.getTime()) / (30.44 * DAY));
  const when = `${p.year}년 ${p.month + 1}월`;
  if (s.onTrack)
    return { ok: true, icon: "👍", text: `지금 속도면 ${when}에 다 모아요${gapMonths > 0 ? `. 목표보다 ${gapMonths}개월 빨라요` : ""}` };
  return { ok: false, icon: "⏳", text: `지금 속도면 ${when}에 다 모아요. 목표보다 ${Math.max(1, -gapMonths)}개월 늦어요` };
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

  const todayUsedRatio = perDay > 0 ? Math.min(1, spentToday / perDay) : 1;
  const monthRatio = status ? Math.max(0, Math.min(1, status.monthNet / Math.max(1, status.requiredPerMonth))) : 0;
  const monthOk = status ? status.monthNet >= status.requiredPerMonth : false;

  return (
    <main className="space-y-8">
      <header className="flex items-end justify-between px-1.5">
        <div>
          <p className="text-[14px] font-semibold text-sub">
            {month + 1}월 {date}일 {WEEKDAYS[kstParts(now).weekday]}요일
          </p>
          <h1 className="page-title mt-0.5">{status?.goal.title ?? "결혼자금"}</h1>
        </div>
        {status && <span className="pill num glass mb-1 !px-3 !py-1.5 !text-[14px]">💍 D-{status.daysLeft}</span>}
      </header>

      {reviewCount > 0 && (
        <Link href="/transactions?status=REVIEW" className="glass flex items-center gap-3 rounded-[22px] px-4 py-3.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-warn-soft text-[18px]">🧐</span>
          <span className="flex-1">
            <span className="block text-[15px] font-bold">분류가 애매한 결제가 {reviewCount}건 있어요</span>
            <span className="block text-[13px] text-sub">눌러서 어디에 쓴 건지 알려주세요</span>
          </span>
          <Chevron />
        </Link>
      )}

      {status ? (
        <section className="glass-tint">
          <p className="text-[15px] font-semibold text-white/80">지금까지 모은 돈</p>
          <p className="num mt-1.5 text-[44px] leading-none font-extrabold">
            {manwon(status.progressAmount)}
            <span className="ml-0.5 text-[26px] font-bold">원</span>
          </p>
          <div className="mt-5 h-3 overflow-hidden rounded-full bg-white/25">
            <div className="h-full rounded-full bg-white" style={{ width: `${Math.min(1, status.progress) * 100}%` }} />
          </div>
          <div className="num mt-2 flex justify-between text-[14px] text-white/85">
            <span className="font-bold text-white">{Math.floor(status.progress * 100)}% 모았어요</span>
            <span>목표 {manwon(status.goal.targetAmount)}원</span>
          </div>
          {status.weddingSpent > 0 && (
            <p className="num mt-1 text-[13px] text-white/70">
              통장에 {manwon(status.balance)}원 + 결혼 준비에 이미 낸 {manwon(status.weddingSpent)}원
            </p>
          )}

          {pace && (
            <p className="mt-5 flex items-start gap-2.5 rounded-[18px] bg-white/15 px-4 py-3 text-[15px] leading-snug font-semibold">
              <span aria-hidden>{pace.icon}</span>
              <span>{pace.text}</span>
            </p>
          )}

          <div className="mt-5">
            <p className="mb-2 text-[13px] text-white/80">
              달마다 모은 돈 <span className="text-white/60">· 칸이 꽉 차면 그달 목표 {manwon(baseline)}원 달성</span>
            </p>
            <div className="flex h-10 items-end gap-[3px]">
              {track.map((c) => {
                const ratio = c.net == null ? 0 : Math.max(0, Math.min(1, c.net / baseline));
                const neg = c.net != null && c.net < 0;
                return (
                  <div
                    key={c.key}
                    title={c.net == null ? `${c.year}.${c.label}` : `${c.year}년 ${c.label}월 ${manwon(c.net)}원`}
                    className={`relative h-full flex-1 overflow-hidden rounded-[5px] ${c.current ? "ring-2 ring-white" : ""} ${
                      neg ? "bg-[#ff8a96]" : "bg-white/20"
                    }`}
                  >
                    {!neg && <span className="absolute inset-x-0 bottom-0 bg-white" style={{ height: `${ratio * 100}%` }} />}
                  </div>
                );
              })}
            </div>
            <div className="num mt-1.5 flex justify-between text-[12px] text-white/70">
              <span>
                {track[0]?.year}.{track[0]?.label}
              </span>
              <span>
                {track.at(-1)?.year}.{track.at(-1)?.label} 결혼식
              </span>
            </div>
          </div>
        </section>
      ) : (
        <Link href="/settings" className="glass-tint block">
          <p className="text-[28px]">🎯</p>
          <p className="mt-2 text-[22px] font-bold">목표부터 정해볼까요?</p>
          <p className="mt-1 text-[15px] leading-relaxed text-white/80">목표 금액이랑 결혼식 날짜만 넣으면 한 달에 얼마씩 모아야 하는지 계산해 드려요</p>
          <span className="mt-4 inline-flex rounded-full bg-white px-4 py-2 text-[15px] font-bold text-[#3b4fd8]">목표 정하기</span>
        </Link>
      )}

      {status && (
        <section>
          <h2 className="section-title">오늘</h2>
          <div className="card">
            {variableLeft <= 0 ? (
              <>
                <p className="text-[15px] font-semibold text-sub">이번 달 생활비를 다 썼어요</p>
                <p className="num mt-1 text-[32px] leading-tight font-extrabold text-spend">{manwon(-variableLeft)}원 넘었어요</p>
                <p className="help mt-2 !text-[14px]">
                  이번 달 저축 목표 <span className="num">{manwon(status.requiredPerMonth)}원</span>을 지키려면 남은 {daysLeftInMonth}일은 꼭 필요한
                  곳에만 써 주세요
                </p>
              </>
            ) : todayLeft > 0 ? (
              <>
                <p className="text-[15px] font-semibold text-sub">오늘 더 써도 되는 돈</p>
                <p className="num mt-1 text-[38px] leading-tight font-extrabold">
                  {manwon(todayLeft)}
                  <span className="text-[22px] font-bold">원</span>
                </p>
                <div className="bar-track mt-4">
                  <div className="h-full rounded-full bg-save" style={{ width: `${todayUsedRatio * 100}%` }} />
                </div>
                <p className="num mt-2 flex justify-between text-[13px] text-sub">
                  <span>오늘 {manwon(spentToday)}원 썼어요</span>
                  <span>하루 몫 {manwon(perDay)}원</span>
                </p>
              </>
            ) : (
              <>
                <p className="text-[15px] font-semibold text-sub">오늘 하루 몫을 넘었어요</p>
                <p className="num mt-1 text-[32px] leading-tight font-extrabold text-spend">{manwon(-todayLeft)}원 더 썼어요</p>
                <div className="bar-track mt-4">
                  <div className="h-full rounded-full bg-spend" style={{ width: "100%" }} />
                </div>
                <p className="help mt-2 !text-[14px]">
                  {daysLeftInMonth > 1 ? (
                    <>
                      괜찮아요. 내일부터 하루 <b className="num text-ink">{manwon(tomorrowPerDay)}원</b>씩만 쓰면 이번 달 목표를 지킬 수 있어요
                    </>
                  ) : (
                    "오늘이 이번 달 마지막 날이에요"
                  )}
                </p>
              </>
            )}
            {fixedTotal > 0 && (
              <p className="help mt-4 flex gap-2 rounded-[16px] bg-fill px-3.5 py-3">
                <span aria-hidden>📌</span>
                <span>
                  월세·통신비·구독 같은 고정비 <span className="num font-semibold text-ink">{manwon(fixedTotal)}원</span>은 미리 빼고 계산했어요
                  {fixedComing > 0 && (
                    <>
                      . 이번 달에 <span className="num font-semibold text-ink">{manwon(fixedComing)}원</span> 더 나갈 예정이에요
                    </>
                  )}
                </span>
              </p>
            )}
          </div>
        </section>
      )}

      {upcoming.length > 0 && (
        <section>
          <h2 className="section-title">
            곧 내야 할 결혼 준비 비용
            <Link href="/wedding" className="text-[14px] font-semibold text-save">
              예산표 보기
            </Link>
          </h2>
          <ul className="card ledger !py-1.5">
            {upcoming.map((i) => (
              <li key={i.id} className="flex items-center gap-3 py-3">
                <span
                  className={`pill num w-[60px] shrink-0 justify-center ${
                    i.daysUntil < 0 ? "bg-spend-soft text-spend" : i.daysUntil <= 30 ? "bg-warn-soft text-warn" : "bg-fill text-sub"
                  }`}
                >
                  {dueLabel(i.daysUntil)}
                </span>
                <span className="min-w-0 flex-1 truncate text-[16px] font-semibold">{i.name}</span>
                <span className="num shrink-0 text-[16px] font-bold">{manwon(i.due)}원</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="section-title">
          {month + 1}월 살림
          <small>{date}일째</small>
        </h2>
        <div className="card">
          <div className="grid grid-cols-3 text-center">
            <Stat label="들어온 돈" value={`+${manwon(status?.monthIncome ?? 0)}`} tone="text-save" />
            <Stat label="생활비" value={`−${manwon(livingSpent)}`} />
            <Stat
              label="남긴 돈"
              value={manwon(status?.monthNet ?? 0)}
              tone={status ? (monthOk ? "text-save" : (status.monthNet ?? 0) < 0 ? "text-spend" : "") : ""}
            />
          </div>
          {status && (
            <div className="mt-5 border-t border-line pt-4">
              <div className="bar-track">
                <div className={`h-full rounded-full ${monthOk ? "bg-save" : "bg-warn"}`} style={{ width: `${monthRatio * 100}%` }} />
              </div>
              <p className="mt-2 text-[14px] text-sub">
                {monthOk ? (
                  <>
                    🎉 이번 달 저축 목표 <span className="num font-semibold text-ink">{manwon(status.requiredPerMonth)}원</span>을 채웠어요
                  </>
                ) : (
                  <>
                    이번 달 저축 목표까지 <b className="num text-ink">{manwon(status.requiredPerMonth - status.monthNet)}원</b> 남았어요
                    {status.monthIncome < status.expectedIncome && " (월급 들어오기 전)"}
                  </>
                )}
              </p>
              {status.monthWedding > 0 && (
                <p className="num mt-1 text-[13px] text-faint">결혼 준비로 낸 {manwon(status.monthWedding)}원은 생활비에서 뺐어요</p>
              )}
            </div>
          )}
        </div>
      </section>

      <section>
        <h2 className="section-title">
          날마다 쓴 생활비
          {avgPerDay > 0 && <small className="num">하루 몫 {manwon(avgPerDay)}원</small>}
        </h2>
        <div className="card">
          <DailyBars data={daily} budgetPerDay={avgPerDay || undefined} today={date} />
          {avgPerDay > 0 && (
            <>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-sub">
                <Legend color="bg-save" text="하루 몫 안에서 씀" />
                <Legend color="bg-spend" text="하루 몫 넘음" />
                <span className="flex items-center gap-1.5">
                  <span className="w-4 border-t-2 border-dashed border-sub" />
                  하루 몫
                </span>
              </div>
              <p className="mt-3 text-[14px] font-semibold">
                {overDays ? (
                  <>
                    이번 달은 <span className="text-spend">{overDays}일</span> 하루 몫을 넘겼어요
                  </>
                ) : (
                  "👏 이번 달은 아직 하루 몫을 넘긴 날이 없어요"
                )}
              </p>
            </>
          )}
          <p className="mt-1 text-[12px] text-faint">월세·구독 같은 고정비는 빼고 보여줘요</p>
        </div>
      </section>

      <section>
        <h2 className="section-title">
          어디에 많이 썼을까요
          <small className="num">생활비 {manwon(livingSpent)}원</small>
        </h2>
        <div className="card !pb-2">
          <CategoryBreakdown data={byCategory(living)} limit={5} />
        </div>
      </section>

      {members.length > 1 && (
        <section>
          <h2 className="section-title">이번 달 우리 둘</h2>
          <ul className="grid grid-cols-2 gap-3">
            {members.map((m) => {
              const inc = m.transactions.filter((t) => t.type === "INCOME").reduce((s, t) => s + t.amount, 0);
              const exp = m.transactions.filter((t) => t.type === "EXPENSE").reduce((s, t) => s + t.amount, 0);
              return (
                <li key={m.id} className="card !p-4">
                  <p className="text-[15px] font-bold">{m.name}</p>
                  <p className={`num mt-1 text-[22px] font-extrabold ${inc - exp >= 0 ? "" : "text-spend"}`}>{manwon(inc - exp)}원</p>
                  <p className="num mt-0.5 text-[12px] text-sub">
                    <span className="text-save">+{manwon(inc)}</span> · −{manwon(exp)}
                  </p>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {feedback && (
        <Link href="/feedback" className="card flex items-start gap-3 !p-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-save-soft text-[20px]">💬</span>
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] font-bold text-save">지난주 한마디</span>
            <span className="mt-0.5 block text-[15px] leading-snug font-semibold">{feedback.content.split("\n")[0]}</span>
          </span>
          <Chevron />
        </Link>
      )}

      <section>
        <h2 className="section-title">
          최근 결제
          <Link href="/transactions" className="text-[14px] font-semibold text-save">
            전체 보기
          </Link>
        </h2>
        <div className="card !py-1.5">
          {recent.length ? (
            <div className="ledger">
              {recent.map((t) => (
                <TxRow key={t.id} t={t} />
              ))}
            </div>
          ) : (
            <p className="py-8 text-center text-[15px] leading-relaxed text-sub">
              📱 폰 앱을 연결하면
              <br />
              카드 결제가 여기에 자동으로 쌓여요
            </p>
          )}
        </div>
      </section>
    </main>
  );
}

function Stat({ label, value, tone = "" }: { label: string; value: string; tone?: string }) {
  return (
    <div className="px-1">
      <p className="text-[13px] font-semibold text-sub">{label}</p>
      <p className={`num mt-1 text-[19px] font-extrabold ${tone}`}>{value}</p>
    </div>
  );
}

function Legend({ color, text }: { color: string; text: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`h-2.5 w-2.5 rounded-[3px] ${color}`} />
      {text}
    </span>
  );
}

