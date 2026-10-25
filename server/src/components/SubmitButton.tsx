"use client";
import { useFormStatus } from "react-dom";

export function SubmitButton({ children, pendingText }: { children: React.ReactNode; pendingText?: string }) {
  const { pending } = useFormStatus();
  return (
    <button className="btn disabled:opacity-50" disabled={pending}>
      {pending ? pendingText ?? "처리 중…" : children}
    </button>
  );
}
