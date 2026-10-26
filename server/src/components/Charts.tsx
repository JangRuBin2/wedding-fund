"use client";
import { Bar, BarChart, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { colorOf, emojiOf } from "@/lib/colors";

const fmt = (v: number) => `${Math.round(v).toLocaleString("ko-KR")}원`;

const tooltipProps = {
  formatter: (v: number) => [fmt(v), "지출"] as [string, string],
  labelFormatter: (l: string) => `${l}일`,
  contentStyle: {
    background: "var(--color-glass-strong)",
    backdropFilter: "blur(16px)",
    border: "1px solid var(--color-glass-edge)",
    borderRadius: 14,
    fontSize: 13,
    padding: "8px 12px",
    boxShadow: "0 8px 24px -10px rgba(20,30,60,.3)",
  },
  labelStyle: { color: "var(--color-sub)", marginBottom: 2 },
  itemStyle: { color: "var(--color-ink)", fontWeight: 700, padding: 0 },
};

/** 한 줄 100% 막대 + 항목별 행. 도넛보다 금액 비교가 빠름 */
export function CategoryBreakdown({ data, limit = 7 }: { data: { category: string; amount: number }[]; limit?: number }) {
  const total = data.reduce((s, d) => s + d.amount, 0);
  if (!total) return <p className="py-8 text-center text-[15px] text-sub">아직 쓴 돈이 없어요</p>;
  const shown = data.slice(0, limit);
  const rest = data.slice(limit).reduce((s, d) => s + d.amount, 0);
  const rows = rest ? [...shown, { category: "그 외", amount: rest }] : shown;
  return (
    <div>
      <div className="flex h-3.5 gap-[2px] overflow-hidden rounded-full">
        {data.map((d) => (
          <span key={d.category} style={{ flex: d.amount, background: colorOf(d.category) }} title={d.category} />
        ))}
      </div>
      <ul className="ledger mt-3">
        {rows.map((d) => (
          <li key={d.category} className="flex items-center gap-3 py-3 text-[15px]">
            <span className="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full text-[15px]">
              <span className="absolute inset-0 opacity-20" style={{ background: colorOf(d.category) }} />
              <span className="relative" aria-hidden>
                {d.category === "그 외" ? "⋯" : emojiOf(d.category)}
              </span>
            </span>
            <span className="flex-1 font-semibold">{d.category}</span>
            <span className="num text-[13px] text-sub">{Math.round((d.amount / total) * 100)}%</span>
            <span className="num w-24 text-right font-bold">{fmt(d.amount)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function DailyBars({
  data,
  budgetPerDay,
  today,
}: {
  data: { day: string; amount: number }[];
  budgetPerDay?: number;
  today?: number;
}) {
  return (
    <div className="h-40">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 6, right: 0, left: 0, bottom: 0 }} barCategoryGap="22%">
          <XAxis
            dataKey="day"
            tickLine={false}
            axisLine={{ stroke: "var(--color-line)" }}
            fontSize={10}
            ticks={["1", "10", "20", String(data.length)]}
            stroke="var(--color-faint)"
          />
          <YAxis hide domain={[0, (max: number) => Math.max(max, (budgetPerDay ?? 0) * 1.2)]} />
          <Tooltip {...tooltipProps} cursor={{ fill: "var(--color-line)", opacity: 0.5 }} />
          {budgetPerDay ? (
            <ReferenceLine y={budgetPerDay} stroke="var(--color-sub)" strokeDasharray="3 3" strokeWidth={1} />
          ) : null}
          <Bar dataKey="amount" radius={[4, 4, 4, 4]} isAnimationActive={false}>
            {data.map((d, i) => (
              <Cell
                key={i}
                fill={budgetPerDay && d.amount > budgetPerDay ? "var(--color-spend)" : "var(--color-save)"}
                fillOpacity={today && i + 1 > today ? 0.25 : i + 1 === today ? 1 : 0.8}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
