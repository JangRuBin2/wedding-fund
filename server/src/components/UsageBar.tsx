import { manwon } from "@/lib/time";

type Row = { name: string; color: string; budget: number; spent: number; planned: number; over: number };

/**
 * 폰 저장공간 막대처럼: 총예산 폭 위에 구분별로 쓴 돈(진한 색), 결제 예정(빗금), 남은 돈(회색).
 * 총예산을 넘으면 막대 기준이 '쓴 돈 합계'로 바뀌고 넘친 만큼 경고
 */
export function UsageBar({ rows, total }: { rows: Row[]; total: number }) {
  const spent = rows.reduce((s, r) => s + r.spent, 0);
  const planned = rows.reduce((s, r) => s + r.planned, 0);
  const used = spent + planned;
  const base = Math.max(total, used, 1);
  const overTotal = total > 0 && used > total ? used - total : 0;
  const shown = rows.filter((r) => r.spent || r.planned);

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <p className="text-[14px] text-sub">쓴 돈 · 결제 예정</p>
        <p className="num text-[14px] text-sub">
          <b className={`text-[20px] font-extrabold ${overTotal ? "text-spend" : "text-ink"}`}>{manwon(used)}원</b>
          {total > 0 && <> / {manwon(total)}원</>}
        </p>
      </div>
      <div className="mt-2.5 flex h-4 gap-[2px] overflow-hidden rounded-full bg-paper" role="img" aria-label="예산 사용량">
        {shown.map((r) => (
          <span key={r.name} className="flex h-full" style={{ width: `${((r.spent + r.planned) / base) * 100}%` }}>
            {r.spent > 0 && <span className="h-full" style={{ flex: r.spent, background: r.color }} />}
            {r.planned > 0 && (
              <span
                className="h-full"
                style={{
                  flex: r.planned,
                  background: `repeating-linear-gradient(135deg, ${r.color} 0 4px, color-mix(in srgb, ${r.color} 35%, transparent) 4px 8px)`,
                }}
              />
            )}
          </span>
        ))}
      </div>
      <ul className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-sub">
        {shown.map((r) => (
          <li key={r.name} className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full" style={{ background: r.color }} />
            {r.name}
          </li>
        ))}
        {total > used && (
          <li className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-line" />
            남은 예산 {manwon(total - used)}원
          </li>
        )}
        {planned > 0 && <li className="text-faint">빗금 = 결제 예정</li>}
      </ul>

      {(overTotal > 0 || rows.some((r) => r.over)) && (
        <div className="mt-3 space-y-1 rounded-xl bg-spend-soft px-3 py-2.5 text-[13px] font-semibold text-spend">
          {overTotal > 0 && <p>총예산을 {manwon(overTotal)}원 넘었어요</p>}
          {rows
            .filter((r) => r.over)
            .map((r) => (
              <p key={r.name}>
                {r.name} 예산을 {manwon(r.over)}원 넘었어요 ({manwon(r.spent + r.planned)}원 / {manwon(r.budget)}원)
              </p>
            ))}
        </div>
      )}
    </div>
  );
}
