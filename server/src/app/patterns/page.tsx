import { byCategory, categoryTrend, detectRecurring, expensesBetween, heatmap, lateNight, topMerchants, weekdayVsWeekend } from "@/lib/analytics";
import { colorOf } from "@/lib/colors";
import { DAY, WEEKDAYS, manwon, kstMonthStart } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function Patterns({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const sp = await searchParams;
  const days = [30, 90, 180].includes(Number(sp.days)) ? Number(sp.days) : 90;
  const now = new Date();
  const from = new Date(now.getTime() - days * DAY);
  const [txs, longTxs, trend] = await Promise.all([
    expensesBetween(from, now),
    expensesBetween(kstMonthStart(now, -5), now),
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
    <main className="space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">소비 패턴</h1>
        <div className="flex gap-1">
          {[30, 90, 180].map((d) => (
            <a key={d} href={`/patterns?days=${d}`} className={`btn-ghost ${d === days ? "bg-ink text-paper" : ""}`}>
              {d}일
            </a>
          ))}
        </div>
      </header>

      <section className="card">
        <p className="font-bold">언제 돈을 쓰나</p>
        <p className="mb-3 text-xs text-sub">요일 × 시간대, 진할수록 많이 씀</p>
        <div>
          <div className="grid grid-cols-[24px_repeat(24,1fr)] gap-[2px] text-[9px] text-sub">
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
                      background: v ? "var(--color-spend)" : "var(--color-line)",
                      opacity: v ? 0.15 + 0.85 * Math.sqrt(v / max) : 0.5,
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
          <p className="label">심야 소비 (23~4시)</p>
          <p className="num text-xl font-bold">{manwon(late.amount)}원</p>
          <p className="text-xs text-sub">
            {late.count}건 · 전체의 {total ? Math.round((late.amount / total) * 100) : 0}%
            {late.top[0] ? ` · 주로 ${late.top[0].category}` : ""}
          </p>
        </div>
        <div className="card">
          <p className="label">하루 평균 (평일 / 주말)</p>
          <p className="num text-xl font-bold">
            {manwon(wk.weekdayPerDay)} / {manwon(wk.weekendPerDay)}
          </p>
          <p className="text-xs text-sub">
            주말이 평일의 {(wk.weekendPerDay / Math.max(1, wk.weekdayPerDay)).toFixed(1)}배
          </p>
        </div>
      </section>

      <section className="card">
        <p className="font-bold">이번 달 페이스 vs 지난 3개월</p>
        <p className="mb-3 text-xs text-sub">오늘까지 같은 일수 기준. 빨간 게 평소보다 더 쓰는 중</p>
        <ul className="space-y-2">
          {trend.filter((t) => Math.abs(t.diff) >= 5000).slice(0, 8).map((t) => (
            <li key={t.category} className="flex items-center gap-2 text-sm">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: colorOf(t.category) }} />
              <span className="flex-1">{t.category}</span>
              <span className="num text-sub">{manwon(t.now)}</span>
              <span className={`num w-20 text-right font-bold ${t.diff > 0 ? "text-spend" : "text-save"}`}>
                {t.diff > 0 ? "+" : ""}
                {manwon(t.diff)}
              </span>
            </li>
          ))}
          {trend.length === 0 && <li className="text-sm text-sub">데이터가 더 쌓이면 보여줄게</li>}
        </ul>
      </section>

      <section className="card">
        <div className="mb-1 flex items-baseline justify-between">
          <p className="font-bold">고정비 · 구독</p>
          <p className="num text-sm font-bold">월 {manwon(recurringTotal)}원</p>
        </div>
        <p className="mb-3 text-xs text-sub">매달 비슷한 날 비슷한 금액으로 나가는 것들. 안 쓰는 거 있으면 끊자</p>
        <ul className="divide-y divide-line">
          {recurring.map((r) => (
            <li key={r.merchant} className="flex items-center justify-between py-2 text-sm">
              <div>
                <p className="font-semibold">{r.merchant}</p>
                <p className="text-xs text-sub">매달 {r.dayOfMonth}일쯤 · {r.months}개월째 · {r.category}</p>
              </div>
              <p className="num font-bold">{r.amount.toLocaleString("ko-KR")}원</p>
            </li>
          ))}
          {recurring.length === 0 && <li className="py-2 text-sm text-sub">2개월 이상 데이터가 쌓이면 자동으로 잡아줌</li>}
        </ul>
      </section>

      <section className="card">
        <p className="mb-3 font-bold">많이 쓴 곳</p>
        <ul className="space-y-2">
          {merchants.map((m) => (
            <li key={m.merchant} className="text-sm">
              <div className="flex justify-between">
                <span className="font-semibold">{m.merchant}</span>
                <span className="num">{m.amount.toLocaleString("ko-KR")}원 <span className="text-sub">· {m.count}회</span></span>
              </div>
              <div className="mt-1 h-1.5 rounded-full bg-line">
                <div className="h-full rounded-full bg-spend" style={{ width: `${(m.amount / (merchants[0]?.amount || 1)) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <p className="mb-3 font-bold">{days}일 카테고리 합계</p>
        <ul className="space-y-1.5 text-sm">
          {cats.map((c) => (
            <li key={c.category} className="flex justify-between">
              <span>{c.category}</span>
              <span className="num">{c.amount.toLocaleString("ko-KR")}원 <span className="text-sub">({Math.round((c.amount / Math.max(1, total)) * 100)}%)</span></span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
