import Link from "next/link";
import { byCategory, categoryTrend, detectRecurring, expensesBetween, heatmap, lateNight, topMerchants, weekdayVsWeekend } from "@/lib/analytics";
import { colorOf, emojiOf } from "@/lib/colors";
import { CategoryBreakdown } from "@/components/Charts";
import { DAY, WEEKDAYS, manwon, kstMonthStart } from "@/lib/time";
import { Chevron } from "@/components/Chevron";

export const dynamic = "force-dynamic";

export default async function Patterns({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const sp = await searchParams;
  const days = [30, 90, 180].includes(Number(sp.days)) ? Number(sp.days) : 90;
  const now = new Date();
  const from = new Date(now.getTime() - days * DAY);
  const [txs, longTxs, trend] = await Promise.all([
    expensesBetween(from, now, { living: true }),
    expensesBetween(kstMonthStart(now, -5), now, { living: true }),
    categoryTrend(now),
  ]);

  const grid = heatmap(txs);
  const late = lateNight(txs);
  const wk = weekdayVsWeekend(txs, days);
  const merchants = topMerchants(txs);
  const recurring = detectRecurring(longTxs);
  const recurringTotal = recurring.reduce((s, r) => s + r.amount, 0);
  const total = txs.reduce((s, t) => s + t.amount, 0);
  const cats = byCategory(txs);
  const rising = trend.filter((t) => Math.abs(t.diff) >= 5000).slice(0, 6);

  // 24칸은 폰에서 너무 작아서 하루를 6구간으로 묶음
  const SLOTS = [
    { label: "새벽", from: 0, to: 6 },
    { label: "아침", from: 6, to: 10 },
    { label: "점심", from: 10, to: 14 },
    { label: "오후", from: 14, to: 18 },
    { label: "저녁", from: 18, to: 21 },
    { label: "밤", from: 21, to: 24 },
  ];
  // 월요일부터
  const order = [1, 2, 3, 4, 5, 6, 0];
  const cells = order.map((w) => SLOTS.map((sl) => grid[w].slice(sl.from, sl.to).reduce((a, b) => a + b, 0)));
  const max = Math.max(1, ...cells.flat());
  let peak = { w: 0, s: 0, v: 0 };
  cells.forEach((row, wi) => row.forEach((v, si) => v > peak.v && (peak = { w: wi, s: si, v })));

  // 한눈에 보는 요약 문장
  const latePct = total ? Math.round((late.amount / total) * 100) : 0;
  const ratio = wk.weekendPerDay / Math.max(1, wk.weekdayPerDay);
  const insights: { icon: string; text: React.ReactNode }[] = [];
  if (peak.v > 0)
    insights.push({
      icon: "🕐",
      text: (
        <>
          <b>{WEEKDAYS[order[peak.w]]}요일 {SLOTS[peak.s].label}</b>에 가장 많이 써요
        </>
      ),
    });
  if (ratio >= 1.2)
    insights.push({
      icon: "📅",
      text: (
        <>
          주말엔 평일보다 하루에 <b>{ratio.toFixed(1)}배</b> 더 써요
        </>
      ),
    });
  else if (ratio <= 0.8)
    insights.push({ icon: "📅", text: <>주말엔 평일보다 오히려 덜 써요</> });
  if (latePct >= 10)
    insights.push({
      icon: "🌙",
      text: (
        <>
          밤 11시 넘어서 쓴 돈이 전체의 <b>{latePct}%</b>예요{late.top[0] ? ` (주로 ${late.top[0].category})` : ""}
        </>
      ),
    });
  const up = rising.find((t) => t.diff > 0);
  if (up)
    insights.push({
      icon: "📈",
      text: (
        <>
          이번 달 <b>{up.category}</b>에 평소보다 <b className="text-spend">{manwon(up.diff)}원</b> 더 썼어요
        </>
      ),
    });

  return (
    <main className="space-y-8">
      <header className="space-y-4 px-1.5">
        <div>
          <h1 className="page-title">소비 분석</h1>
          <p className="page-sub">결혼준비·저축을 뺀 생활비만 봐요</p>
        </div>
        <nav className="segment" aria-label="기간">
          {[30, 90, 180].map((d) => (
            <Link key={d} href={`/patterns?days=${d}`} aria-current={d === days ? "page" : undefined} className="num">
              최근 {d === 30 ? "1달" : d === 90 ? "3달" : "6달"}
            </Link>
          ))}
        </nav>
      </header>

      {insights.length > 0 && (
        <section className="card space-y-3.5">
          <p className="text-[13px] font-bold text-save">한눈에 보기</p>
          {insights.map((x, i) => (
            <p key={i} className="flex gap-3 text-[16px] leading-snug">
              <span aria-hidden>{x.icon}</span>
              <span>{x.text}</span>
            </p>
          ))}
        </section>
      )}

      <Link href="/feedback" className="card flex items-center gap-3 !p-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-save-soft text-[20px]">💬</span>
        <span className="flex-1">
          <span className="block text-[16px] font-bold">주간 피드백</span>
          <span className="block text-[13px] text-sub">지난주 소비를 한 번에 정리해 드려요</span>
        </span>
        <Chevron />
      </Link>

      <section>
        <h2 className="section-title">
          언제 많이 쓸까요
          <small>진할수록 많이 씀</small>
        </h2>
        <div className="card">
          <div className="grid grid-cols-[28px_repeat(6,minmax(0,1fr))] gap-1.5 text-[12px] text-sub">
            <span />
            {SLOTS.map((sl) => (
              <span key={sl.label} className="text-center font-semibold">
                {sl.label}
              </span>
            ))}
            {order.map((w, wi) => (
              <div key={w} className="contents">
                <span className={`flex items-center text-[13px] font-semibold ${w === 0 || w === 6 ? "text-spend" : ""}`}>{WEEKDAYS[w]}</span>
                {cells[wi].map((v, si) => (
                  <span
                    key={si}
                    title={`${WEEKDAYS[w]}요일 ${SLOTS[si].label} ${v.toLocaleString("ko-KR")}원`}
                    className="h-8 rounded-[8px]"
                    style={{
                      background: v ? "var(--color-save)" : "var(--color-fill)",
                      opacity: v ? 0.15 + 0.85 * Math.sqrt(v / max) : 1,
                    }}
                  />
                ))}
              </div>
            ))}
          </div>
          <p className="mt-3 text-[12px] text-faint">새벽 0~6시 · 아침 6~10시 · 점심 10~14시 · 오후 14~18시 · 저녁 18~21시 · 밤 21~24시</p>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3">
        <div className="card !p-4">
          <p className="text-[22px]" aria-hidden>
            🌙
          </p>
          <p className="mt-1 text-[13px] font-semibold text-sub">밤 11시~새벽 4시</p>
          <p className="num mt-0.5 text-[22px] font-extrabold">{manwon(late.amount)}원</p>
          <p className="mt-1 text-[13px] leading-snug text-sub">
            {late.count}건 · 전체의 {latePct}%
          </p>
        </div>
        <div className="card !p-4">
          <p className="text-[22px]" aria-hidden>
            📅
          </p>
          <p className="mt-1 text-[13px] font-semibold text-sub">하루 평균</p>
          <p className="num mt-0.5 text-[15px] leading-relaxed">
            평일 <b className="text-[18px]">{manwon(wk.weekdayPerDay)}원</b>
            <br />
            주말 <b className="text-[18px]">{manwon(wk.weekendPerDay)}원</b>
          </p>
        </div>
      </section>

      <section>
        <h2 className="section-title">
          평소랑 비교하면
          <small>지난 3달 같은 날짜까지와 비교</small>
        </h2>
        <ul className="card ledger !py-1">
          {rising.map((t) => (
            <li key={t.category} className="flex items-center gap-3 py-3 text-[15px]">
              <span className="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full text-[15px]">
                <span className="absolute inset-0 opacity-20" style={{ background: colorOf(t.category) }} />
                <span className="relative" aria-hidden>
                  {emojiOf(t.category)}
                </span>
              </span>
              <span className="flex-1">
                <span className="block font-semibold">{t.category}</span>
                <span className="num block text-[12px] text-sub">이번 달 {manwon(t.now)}원</span>
              </span>
              <span className={`pill num ${t.diff > 0 ? "bg-spend-soft text-spend" : "bg-save-soft text-save"}`}>
                {t.diff > 0 ? "▲" : "▼"} {manwon(Math.abs(t.diff))}원
              </span>
            </li>
          ))}
          {rising.length === 0 && <li className="py-8 text-center text-[15px] text-sub">한 달 넘게 쌓이면 비교해 드려요</li>}
        </ul>
      </section>

      <section>
        <h2 className="section-title">
          매달 나가는 돈
          <small className="num">한 달 {manwon(recurringTotal)}원</small>
        </h2>
        <ul className="card ledger !py-1">
          {recurring.map((r) => (
            <li key={r.merchant} className="flex items-center justify-between gap-3 py-3 text-[15px]">
              <div className="min-w-0">
                <p className="truncate font-semibold">{r.merchant}</p>
                <p className="text-[12px] text-sub">
                  매달 {r.dayOfMonth}일쯤 · {r.months}달째
                </p>
              </div>
              <p className="num shrink-0 font-bold">{r.amount.toLocaleString("ko-KR")}원</p>
            </li>
          ))}
          {recurring.length === 0 && <li className="py-8 text-center text-[15px] text-sub">두 달 넘게 쌓이면 알아서 찾아드려요</li>}
        </ul>
        {recurring.length > 0 && <p className="help mt-2 px-1.5">💡 안 쓰는 구독이 있다면 여기서부터 정리해 보세요</p>}
      </section>

      <section>
        <h2 className="section-title">자주 간 곳</h2>
        <ul className="card space-y-4">
          {merchants.map((m, i) => (
            <li key={m.merchant} className="text-[15px]">
              <div className="flex items-baseline justify-between gap-2">
                <span className="min-w-0 truncate font-semibold">
                  <span className="num mr-2 text-faint">{i + 1}</span>
                  {m.merchant}
                </span>
                <span className="num shrink-0 font-bold">
                  {m.amount.toLocaleString("ko-KR")}원 <span className="text-[13px] font-medium text-sub">{m.count}번</span>
                </span>
              </div>
              <div className="bar-track mt-2 !h-1.5">
                <div className="h-full rounded-full bg-save/70" style={{ width: `${(m.amount / (merchants[0]?.amount || 1)) * 100}%` }} />
              </div>
            </li>
          ))}
          {merchants.length === 0 && <li className="py-6 text-center text-[15px] text-sub">아직 데이터가 없어요</li>}
        </ul>
      </section>

      <section>
        <h2 className="section-title">
          분류별로 보기
          <small className="num">{manwon(total)}원</small>
        </h2>
        <div className="card !pb-2">
          <CategoryBreakdown data={cats} limit={20} />
        </div>
      </section>
    </main>
  );
}
