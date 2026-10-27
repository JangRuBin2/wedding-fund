"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { reviewDecision } from "@/app/actions";
import { colorOf } from "@/lib/colors";

export type ReviewItem = {
  id: string;
  type: string;
  amount: number;
  merchant: string;
  category: string;
  issuer: string | null;
  member: string | null;
  when: string;
  raw: string | null;
};

const THRESHOLD = 90; // 이만큼 넘게 밀면 결정
const UNDO_MS = 4000;

/**
 * 확인할 결제를 한 장씩 넘기는 카드 덱.
 * 오른쪽으로 밀면 저장(확정), 왼쪽으로 밀면 삭제. 삭제는 몇 초 동안 되돌릴 수 있게 서버 반영을 미룸.
 */
export function ReviewDeck({
  items,
  expenseCategories,
  incomeCategories,
}: {
  items: ReviewItem[];
  expenseCategories: readonly string[];
  incomeCategories: readonly string[];
}) {
  const [queue, setQueue] = useState(items);
  const [category, setCategory] = useState<string | null>(null);
  const [dx, setDx] = useState(0);
  const [flying, setFlying] = useState<0 | 1 | -1>(0);
  const [undo, setUndo] = useState<ReviewItem | null>(null);
  const [done, setDone] = useState(0);
  const start = useRef<number | null>(null);
  const pendingDelete = useRef<{ item: ReviewItem; timer: ReturnType<typeof setTimeout> } | null>(null);

  const top = queue[0];
  const chosen = category ?? top?.category;

  const commitDelete = useCallback(() => {
    const p = pendingDelete.current;
    if (!p) return;
    clearTimeout(p.timer);
    pendingDelete.current = null;
    setUndo(null);
    void reviewDecision(p.item.id, "delete");
  }, []);

  // 페이지를 떠나도 미뤄둔 삭제는 반영
  useEffect(() => commitDelete, [commitDelete]);

  const decide = useCallback(
    (dir: 1 | -1) => {
      if (!top || flying) return;
      commitDelete();
      setFlying(dir);
      const item = top;
      const picked = category && category !== item.category ? category : undefined;
      setTimeout(() => {
        setQueue((q) => q.slice(1));
        setCategory(null);
        setDx(0);
        setFlying(0);
        setDone((n) => n + 1);
        if (dir === 1) {
          void reviewDecision(item.id, "keep", picked);
        } else {
          setUndo(item);
          pendingDelete.current = { item, timer: setTimeout(commitDelete, UNDO_MS) };
        }
      }, 220);
    },
    [top, flying, category, commitDelete],
  );

  const restore = () => {
    const p = pendingDelete.current;
    if (!p) return;
    clearTimeout(p.timer);
    pendingDelete.current = null;
    setUndo(null);
    setDone((n) => n - 1);
    setQueue((q) => [p.item, ...q]);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") decide(1);
      if (e.key === "ArrowLeft") decide(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [decide]);

  const onDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    start.current = e.clientX;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    if (start.current != null) setDx(e.clientX - start.current);
  };
  const onUp = () => {
    if (start.current == null) return;
    start.current = null;
    if (dx > THRESHOLD) decide(1);
    else if (dx < -THRESHOLD) decide(-1);
    else setDx(0);
  };

  const toast = undo && (
    <div className="flex items-center justify-between rounded-xl bg-ink px-4 py-3 text-[14px] text-card shadow-lg">
      <span className="truncate">{undo.merchant} 내역을 삭제했어요</span>
      <button onClick={restore} className="shrink-0 font-bold text-save-soft">
        되돌리기
      </button>
    </div>
  );

  if (!top) {
    return (
      <>
        <section className="card py-12 text-center">
          <p className="text-[17px] font-bold">모두 확인했어요</p>
          <p className="mt-1 text-sm text-sub">{done > 0 ? `${done}건을 정리했어요. 수고하셨어요!` : "확인할 결제가 없어요"}</p>
          <Link href="/" className="btn mt-5 inline-block">
            홈으로 가기
          </Link>
        </section>
        {toast}
      </>
    );
  }

  const income = top.type === "INCOME";
  const color = income ? "var(--color-save)" : colorOf(chosen ?? top.category);
  const offset = flying ? flying * 600 : dx;
  const cats = income ? incomeCategories : expenseCategories;

  return (
    <div className="space-y-4">
      <p className="px-1 text-[13px] text-sub">
        오른쪽으로 밀면 <b className="text-save">저장</b>, 왼쪽으로 밀면 <b className="text-spend">삭제</b>해요 · 남은 {queue.length}건
      </p>

      <div className="relative">
        {queue[1] && <div className="card absolute inset-0 translate-y-2 scale-[0.97] opacity-60" aria-hidden />}
        <article
          className="card relative touch-pan-y select-none"
          style={{
            transform: `translateX(${offset}px) rotate(${offset / 25}deg)`,
            transition: start.current != null ? "none" : "transform 220ms ease",
          }}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        >
          <span
            className="absolute top-4 left-4 rounded-lg border-2 border-save px-2 py-0.5 text-[15px] font-extrabold text-save"
            style={{ opacity: Math.max(0, Math.min(1, offset / THRESHOLD)) }}
          >
            저장
          </span>
          <span
            className="absolute top-4 right-4 rounded-lg border-2 border-spend px-2 py-0.5 text-[15px] font-extrabold text-spend"
            style={{ opacity: Math.max(0, Math.min(1, -offset / THRESHOLD)) }}
          >
            삭제
          </span>

          <div className="pt-8 text-center">
            <span
              className="inline-block rounded-lg px-2 py-0.5 text-[12px] font-bold"
              style={{ color, background: `color-mix(in srgb, ${color} 15%, transparent)` }}
            >
              {income ? "입금" : chosen}
            </span>
            <p className="num mt-3 text-[32px] leading-tight font-extrabold">
              {income ? "+" : "−"}
              {top.amount.toLocaleString("ko-KR")}
              <span className="text-[20px] font-bold">원</span>
            </p>
            <p className="mt-1 text-[17px] font-semibold break-all">{top.merchant}</p>
            <p className="mt-1 text-[13px] text-sub">{[top.when, top.issuer, top.member].filter(Boolean).join(" · ")}</p>
          </div>

          {top.raw && (
            <p className="mt-4 max-h-28 overflow-auto rounded-lg border border-dashed border-line p-2.5 text-xs leading-relaxed whitespace-pre-wrap text-sub">
              {top.raw}
            </p>
          )}

          <p className="mt-4 mb-2 text-[12px] font-semibold text-sub">카테고리가 다르면 골라 주세요</p>
          <div className="-mx-1 flex flex-wrap gap-1.5">
            {cats.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                className={`rounded-full px-3 py-1.5 text-[13px] font-semibold ${
                  c === chosen ? "bg-ink text-card" : "bg-paper text-sub"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </article>
      </div>

      <div className="flex items-center justify-center gap-6 pt-1">
        <button
          type="button"
          onClick={() => decide(-1)}
          aria-label="삭제"
          className="flex h-16 w-16 items-center justify-center rounded-full bg-card text-[26px] font-bold text-spend shadow-sm"
        >
          ✕
        </button>
        <button
          type="button"
          onClick={() => decide(1)}
          aria-label="저장"
          className="flex h-16 w-16 items-center justify-center rounded-full bg-save text-[26px] font-bold text-white shadow-sm"
        >
          ✓
        </button>
      </div>
      {toast}
      <p className="text-center text-[12px] text-faint">
        가맹점 이름을 고치려면{" "}
        <Link href="/transactions?status=REVIEW&view=list" className="underline underline-offset-2">
          목록으로 보기
        </Link>
      </p>
    </div>
  );
}
