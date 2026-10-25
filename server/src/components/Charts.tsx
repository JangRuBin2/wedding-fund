"use client";
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { colorOf } from "@/lib/colors";

const fmt = (v: number) => `${Math.round(v).toLocaleString("ko-KR")}원`;

export function CategoryDonut({ data }: { data: { category: string; amount: number }[] }) {
  const total = data.reduce((s, d) => s + d.amount, 0);
  if (!total) return <p className="py-10 text-center text-sm text-sub">아직 이번 달 지출이 없어</p>;
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <div className="h-44 w-44 shrink-0">
        <ResponsiveContainer>
          <PieChart>
            <Pie data={data} dataKey="amount" nameKey="category" innerRadius={52} outerRadius={80} paddingAngle={2} stroke="none" isAnimationActive={false}>
              {data.map((d) => (
                <Cell key={d.category} fill={colorOf(d.category)} />
              ))}
            </Pie>
            <Tooltip formatter={(v: number) => fmt(v)} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="w-full space-y-1.5">
        {data.slice(0, 7).map((d) => (
          <li key={d.category} className="flex items-center gap-2 text-sm">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: colorOf(d.category) }} />
            <span className="flex-1">{d.category}</span>
            <span className="num text-sub">{Math.round((d.amount / total) * 100)}%</span>
            <span className="num w-24 text-right font-semibold">{fmt(d.amount)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function DailyBars({ data, budgetPerDay }: { data: { day: string; amount: number }[]; budgetPerDay?: number }) {
  return (
    <div className="h-40">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
          <XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={10} interval={4} stroke="var(--color-sub)" />
          <YAxis hide />
          <Tooltip formatter={(v: number) => fmt(v)} cursor={{ fill: "var(--color-line)", opacity: 0.4 }} />
          <Bar dataKey="amount" radius={[4, 4, 0, 0]} isAnimationActive={false}>
            {data.map((d, i) => (
              <Cell
                key={i}
                fill={budgetPerDay && d.amount > budgetPerDay ? "var(--color-spend)" : "var(--color-save)"}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
