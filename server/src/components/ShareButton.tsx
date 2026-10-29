"use client";
import { useState } from "react";

/** 폰이면 공유 시트(카톡 등)를 열고, 공유 시트가 없는 브라우저면 글을 복사함 */
export function ShareButton({ title, text, className = "text-sub" }: { title: string; text: string; className?: string }) {
  const [msg, setMsg] = useState("");
  const share = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title, text });
        return;
      }
      await navigator.clipboard.writeText(text);
      setMsg("복사했어요");
    } catch (e) {
      // 공유 시트를 닫은 건 실패가 아님
      if ((e as Error).name !== "AbortError") setMsg("공유하지 못했어요");
    }
    setTimeout(() => setMsg(""), 2000);
  };
  return (
    <button type="button" onClick={share} className={className}>
      {msg || "공유"}
    </button>
  );
}
