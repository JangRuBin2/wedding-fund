"use client";
import { useLinkStatus } from "next/link";

/** Link 안에 넣으면, 누른 뒤 다음 화면이 올 때까지 그 버튼이 깜빡임 (부모에 relative 필요) */
export function LinkPending({ className = "rounded-[10px]" }: { className?: string }) {
  const { pending } = useLinkStatus();
  return pending ? <span className={`pointer-events-none absolute inset-0 animate-pulse bg-save/25 ${className}`} aria-hidden /> : null;
}
