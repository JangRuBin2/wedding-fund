"use client";
import { useFormStatus } from "react-dom";

export function SubmitButton({ children, pendingText, className = "" }: { children: React.ReactNode; pendingText?: string; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button className={`btn disabled:opacity-50 ${className}`} disabled={pending}>
      {pending ? pendingText ?? "처리 중…" : children}
    </button>
  );
}
