"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { WEDDING_CATEGORIES } from "@/lib/wedding-meta";
import { saveBudgetPlan } from "@/app/actions";

type Names = (typeof WEDDING_CATEGORIES)[number]["name"];
const NAMES = WEDDING_CATEGORIES.map((c) => c.name) as Names[];
const RECOMMENDED = Object.fromEntries(WEDDING_CATEGORIES.map((c) => [c.name, c.ratio])) as Record<Names, number>;
const man = (won: number) => Math.round(won / 10_000).toLocaleString("ko-KR");

/**
 * 총예산을 정하고 구분별로 슬라이더로 나눔. 하나를 올리면 잠그지 않은 나머지가 비율대로 줄어들어서
 * 합계는 항상 100%. 금액은 만원 단위로 맞추고 남는 자투리는 마지막 구분에 붙임.
 * 저장하면 예산 탭(보기 화면)으로 돌아감
 */
export function BudgetPlanner({ initial }: { initial: Record<string, number> }) {
  const initialTotal = NAMES.reduce((s, n) => s + (initial[n] ?? 0), 0);
  const [total, setTotal] = useState(initialTotal);
  const [pct, setPct] = useState<Record<Names, number>>(() =>
    initialTotal
      ? (Object.fromEntries(NAMES.map((n) => [n, ((initial[n] ?? 0) / initialTotal) * 100])) as Record<Names, number>)
      : { ...RECOMMENDED },
  );
  const [locked, setLocked] = useState<Set<Names>>(new Set());
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(true);
  const router = useRouter();

  const amounts = useMemo(() => {
    const out = {} as Record<Names, number>;
    let used = 0;
    NAMES.forEach((n, i) => {
      out[n] = i === NAMES.length - 1 ? Math.max(0, total - used) : Math.round((total * pct[n]) / 100 / 10_000) * 10_000;
      used += out[n];
    });
    return out;
  }, [total, pct]);

  const move = (name: Names, value: number) => {
    setPct((prev) => {
      const free = NAMES.filter((n) => n !== name && !locked.has(n));
      if (!free.length) return prev; // 나머지가 다 잠겨 있으면 움직일 곳이 없음
      const lockedSum = NAMES.filter((n) => n !== name && locked.has(n)).reduce((s, n) => s + prev[n], 0);
      const v = Math.max(0, Math.min(100 - lockedSum, value));
      const rest = 100 - lockedSum - v;
      const freeSum = free.reduce((s, n) => s + prev[n], 0);
      const next = { ...prev, [name]: v };
      for (const n of free) next[n] = freeSum > 0 ? (prev[n] / freeSum) * rest : rest / free.length;
      return next;
    });
    setSaved(false);
  };

  const toggleLock = (n: Names) =>
    setLocked((prev) => {
      const s = new Set(prev);
      if (s.has(n)) s.delete(n);
      else s.add(n);
      return s;
    });

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-2">
        <label className="flex-1 space-y-1">
          <span className="label">총예산 (만원)</span>
          <input
            inputMode="numeric"
            value={total ? Math.round(total / 10_000).toLocaleString("ko-KR") : ""}
            placeholder="예: 5,000"
            onChange={(e) => {
              setTotal((Number(e.target.value.replace(/[^\d]/g, "")) || 0) * 10_000);
              setSaved(false);
            }}
            className="input num text-[17px] font-bold"
          />
        </label>
        <button
          type="button"
          className="btn-ghost !bg-save-soft !py-[11px] !text-save"
          onClick={() => {
            setPct({ ...RECOMMENDED });
            setLocked(new Set());
            setSaved(false);
          }}
        >
          추천 비율로
        </button>
      </div>

      <ul className="space-y-3.5">
        {WEDDING_CATEGORIES.map((c) => {
          const n = c.name as Names;
          const p = pct[n];
          return (
            <li key={n}>
              <div className="mb-1.5 flex items-baseline gap-2">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: c.color }} />
                <span className="text-[14px] font-semibold">{n}</span>
                <button
                  type="button"
                  onClick={() => toggleLock(n)}
                  aria-pressed={locked.has(n)}
                  className={`text-[11px] font-semibold ${locked.has(n) ? "text-save" : "text-faint"}`}
                  title="잠그면 다른 슬라이더를 움직여도 그대로예요"
                >
                  {locked.has(n) ? "잠김" : "잠금"}
                </button>
                <span className="num ml-auto text-[14px] font-bold">{man(amounts[n])}만원</span>
                <span className="num w-10 text-right text-[12px] text-sub">{Math.round(p)}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={Math.round(p)}
                disabled={locked.has(n)}
                onChange={(e) => move(n, Number(e.target.value))}
                aria-label={`${n} 비율`}
                className="range"
                style={{ "--c": c.color, "--p": `${p}%` } as React.CSSProperties}
              />
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        className="btn w-full disabled:opacity-50"
        disabled={pending || saved || !total}
        onClick={() => start(async () => {
          await saveBudgetPlan(amounts);
          setSaved(true);
          router.push("/wedding/budget");
        })}
      >
        {pending ? "저장하는 중…" : saved ? "바꾼 게 없어요" : "이대로 나누기"}
      </button>
    </div>
  );
}
