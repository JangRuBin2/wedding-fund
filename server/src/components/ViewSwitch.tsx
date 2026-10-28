"use client";
import { useState, type ReactNode } from "react";

/**
 * 같은 화면 안의 보기 전환(리스트/캘린더 등). 서버에 다시 묻지 않고 바로 바뀜.
 * 주소(?view=)만 조용히 바꿔서 새로고침해도 같은 보기가 유지됨
 */
export function ViewSwitch({
  views,
  initial,
  param = "view",
  aside,
}: {
  views: { key: string; label: string; content: ReactNode }[];
  initial: string;
  param?: string;
  aside?: ReactNode;
}) {
  const [active, setActive] = useState(views.some((v) => v.key === initial) ? initial : views[0].key);
  const pick = (key: string) => {
    setActive(key);
    const url = new URL(window.location.href);
    if (key === views[0].key) url.searchParams.delete(param);
    else url.searchParams.set(param, key);
    window.history.replaceState(window.history.state, "", url);
  };
  return (
    <>
      <div className="flex items-center justify-between">
        <div className="flex rounded-[12px] bg-card p-1 shadow-[var(--shadow-card)]" role="tablist" aria-label="보기">
          {views.map((v) => (
            <button
              key={v.key}
              type="button"
              role="tab"
              aria-selected={active === v.key}
              onClick={() => pick(v.key)}
              className={`rounded-[9px] px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${active === v.key ? "bg-save text-white" : "text-sub"}`}
            >
              {v.label}
            </button>
          ))}
        </div>
        {aside}
      </div>
      {views.map((v) => (
        // 둘 다 그려 두고 숨기기만 해서 전환이 즉시, 스크롤·입력 상태도 유지
        <div key={v.key} hidden={active !== v.key} className="space-y-7">
          {v.content}
        </div>
      ))}
    </>
  );
}
