"use client";
import { useFormStatus } from "react-dom";

/** 누르면 저장이 끝날 때까지 '처리 중' 표시 (서버 저장 중에도 눌린 게 보이게) */
export function SubmitButton({
  children,
  pendingText,
  className = "",
  base = "btn",
}: {
  children: React.ReactNode;
  pendingText?: string;
  className?: string;
  base?: "btn" | "btn-ghost" | "";
}) {
  const { pending } = useFormStatus();
  return (
    <button className={`${base} disabled:opacity-50 ${className}`} disabled={pending} aria-busy={pending}>
      {pending ? pendingText ?? "저장 중…" : children}
    </button>
  );
}
