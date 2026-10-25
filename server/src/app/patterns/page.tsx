import Link from "next/link";
import { byCategory, categoryTrend, detectRecurring, expensesBetween, heatmap, lateNight, topMerchants, weekdayVsWeekend } from "@/lib/analytics";
import { colorOf } from "@/lib/colors";
import { CategoryBreakdown } from "@/components/Charts";
import { DAY, WEEKDAYS, manwon, kstMonthStart } from "@/lib/time";

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
  const max = Math.max(1, ...grid.flat());
  const late = lateNight(txs);
  const wk = weekdayVsWeekend(txs, days);
  const merchants = topMerchants(txs);
  const recurring = detectRecurring(longTxs);
  const recurringTotal = recurring.reduce((s, r) => s + r.amount, 0);
  const total = txs.reduce((s, t) => s + t.amount, 0);
  const cats = byCategory(txs);
  // 히트맵은 월요일부터
  const order = [1, 2, 3, 4, 5, 6, 0];

  return (
    <main className="space-y-7">
      <header className="flex items-center justify-between">
        <h1 className="text-[22px] font-bold">소비 분석</h1>
        <div className="flex rounded-[10px] bg-card p-1" role="tablist" aria-label="기간">
          {[30, 90, 180].map((d) => (
            <a
              key={d}
              href={`/patterns?days=${d}`}
              aria-current={d === days ? "page" : undefined}
              className={`num rounded-[7px] px-3 py-1.5 text-[13px] font-semibold ${d === days ? "bg-ink text-card" : "text-sub"}`}
            >
              {d}일
            </a>
          ))}
        </div>
      </header>

      <Link href="/feedback" className="flex items-center justify-between rounded-2xl border-l-4 border-save bg-card px-4 py-3.5">
        <span>
          <span className="block text-[15px] font-semibold">주간 피드백</span>
          <span className="block text-[12px] text-sub">지난주 소비를 AI가 짚어줌</span>
        </span>
        <span className="text-[13px] font-semibold text-save">보기</span>
      </Link>

      <section>
        <h2 className="section-title">언제 쓰나<small>진할수록 많이 씀</small></h2>
        <div className="card">
          <div className="grid grid-cols-[20px_repeat(24,minmax(0,1fr))] gap-[2px] text-[9px] text-sub">
            <span />
            {Array.from({ length: 24 }, (_, h) => (
              <span key={h} className="text-center">{h % 3 === 0 ? h : ""}</span>
            ))}
            {order.map((w) => (
              <div key={w} className="contents">
                <span className="flex items-center text-[11px]">{WEEKDAYS[w]}</span>
                {grid[w].map((v, h) => (
                  <span
                    key={h}
                    title={`${WEEKDAYS[w]} ${h}시 ${v.toLocaleString("ko-KR")}원`}
                    className="aspect-square rounded-[3px]"
                    style={{
                      background: v ? "var(--color-save)" : "var(--color-paper)",
                      opacity: v ? 0.12 + 0.88 * Math.sqrt(v / max) : 1,
                    }}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3">
        <div className="card">
          <p className="label">밤 11시~새벽 4시</p>
          <p className="num mt-1 text-[20px] font-bold">{manwon(late.amount)}원</p>
          <p className="mt-1 text-[12px] leading-snug text-sub">
            {late.count}건, 전체의 {total ? Math.round((late.amount / total) * 100) : 0}%
            {late.top[0] ? `. 주로 ${late.top[0].category}` : ""}
          </p>
        </div>
        <div className="card">
          <p className="label">하루 평균, 평일과 주말</p>
          <p className="num mt-1 text-[20px] font-bold">
            {manwon(wk.weekdayPerDay)} <span className="text-faint">/</span> {manwon(wk.weekendPerDay)}
          </p>
          <p className="mt-1 text-[12px] text-sub">
            주말이 평일의 {(wk.weekendPerDay / Math.max(1, wk.weekdayPerDay)).toFixed(1)}배
          </p>
        </div>
      </section>

      <section>
        <h2 className="section-title">평소보다 더 쓰는 것<small>지난 3개월 같은 날짜까지와 비교</small></h2>
        <div className="card !py-1">
        <ul className="ledger">
          {trend.filter((t) => Math.abs(t.diff) >= 5000).slice(0, 8).map((t) => (
            <li key={t.category} className="flex items-center gap-2.5 py-2.5 text-[14px]">
              <span className="h-2 w-2 rounded-full" style={{ background: colorOf(t.category) }} />
              <span className="flex-1 font-medium">{t.category}</span>
              <span className="num text-sub">{manwon(t.now)}</span>
              <span className={`num w-20 text-right font-bold ${t.diff > 0 ? "text-spend" : "text-save"}`}>
                {t.diff > 0 ? "+" : ""}
                {manwon(t.diff)}
              </span>
            </li>
          ))}
          {trend.length === 0 && <li className="py-6 text-center text-sm text-sub">한 달 넘게 쌓이면 비교해줄게</li>}
        </ul>
        </div>
      </section>

      <section>
        <h2 className="section-title">매달 나가는 돈<small className="num">월 {manwon(recurringTotal)}원</small></h2>
        <div className="card !py-1">
        <ul className="ledger">
          {recurring.map((r) => (
            <li key={r.merchant} className="flex items-center justify-between py-3 text-[14px]">
              <div>
                <p className="font-semibold">{r.merchant}</p>
                <p className="text-[12px] text-sub">매달 {r.dayOfMonth}일쯤, {r.months}개월째</p>
              </div>
              <p className="num font-bold">{r.amount.toLocaleString("ko-KR")}원</p>
            </li>
          ))}
          {recurring.length === 0 && <li className="py-6 text-center text-sm text-sub">두 달 넘게 쌓이면 자동으로 찾아줌</li>}
        </ul>
        </div>
        {recurring.length > 0 && <p className="mt-2 px-1 text-[12px] text-sub">안 쓰는 구독이 있으면 여기서부터 끊자</p>}
      </section>

      <section>
        <h2 className="section-title">많이 쓴 곳</h2>
        <div className="card">
        <ul className="space-y-3.5">
          {merchants.map((m) => (
            <li key={m.merchant} className="text-[14px]">
              <div className="flex justify-between">
                <span className="font-semibold">{m.merchant}</span>
                <span className="num font-semibold">{m.amount.toLocaleString("ko-KR")}원 <span className="font-normal text-sub">{m.count}회</span></span>
              </div>
              <div className="mt-1.5 h-1.5 rounded-full bg-paper">
                <div className="h-full rounded-full bg-ink/70" style={{ width: `${(m.amount / (merchants[0]?.amount || 1)) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
        </div>
      </section>

      <section>
        <h2 className="section-title">최근 {days}일 카테고리<small className="num">{manwon(total)}원</small></h2>
        <div className="card">
          <CategoryBreakdown data={cats} limit={20} />
        </div>
      </section>
    </main>
  );
}
