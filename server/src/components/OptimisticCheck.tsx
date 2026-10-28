"use client";
import { useOptimistic, useTransition } from "react";

/**
 * 누르자마자 체크 표시가 바뀌고, 서버 저장은 뒤에서. 실패하면 원래대로 돌아감
 */
export function OptimisticCheck({
  done,
  action,
  label,
  variant = "task",
  number,
}: {
  done: boolean;
  action: () => Promise<void>;
  label: string;
  variant?: "step" | "task";
  number?: number;
}) {
  const [optimistic, setOptimistic] = useOptimistic(done);
  const [, start] = useTransition();
  const onClick = () =>
    start(async () => {
      setOptimistic(!optimistic);
      await action();
    });
  if (variant === "step") {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-pressed={optimistic}
        aria-label={optimistic ? `${label} 완료 취소` : `${label} 완료`}
        className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-[13px] font-bold transition-colors ${
          optimistic ? "border-save bg-save text-white" : "border-line bg-card text-sub"
        }`}
      >
        {optimistic ? "✓" : number}
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={optimistic}
      aria-label={optimistic ? `${label} 완료 취소` : `${label} 완료`}
      className={`flex h-5 w-5 items-center justify-center rounded-md border-2 text-[11px] font-bold transition-colors ${
        optimistic ? "border-save bg-save text-white" : "border-line"
      }`}
    >
      {optimistic ? "✓" : ""}
    </button>
  );
}
