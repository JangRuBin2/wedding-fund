import Link from "next/link";
import { LinkPending } from "./LinkPending";

/** 결혼준비 상단: 제목 + D-day + 할 일/예산 탭 */
export function WeddingHeader({ active, daysLeft }: { active: "todo" | "budget"; daysLeft?: number }) {
  const tabs = [
    { key: "todo", href: "/wedding", label: "할 일" },
    { key: "budget", href: "/wedding/budget", label: "예산" },
  ] as const;
  return (
    <header className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h1 className="text-[22px] font-bold">결혼 준비</h1>
        {daysLeft != null && <p className="num text-[15px] font-bold text-sub">D-{daysLeft}</p>}
      </div>
      <nav className="flex rounded-[14px] bg-card p-1 shadow-[var(--shadow-card)]" aria-label="결혼 준비">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={t.href}
            aria-current={active === t.key ? "page" : undefined}
            className={`relative flex-1 rounded-[10px] py-2 text-center text-[14px] font-semibold ${
              active === t.key ? "bg-save text-white shadow-sm" : "text-sub"
            }`}
          >
            {t.label}
            <LinkPending />
          </Link>
        ))}
      </nav>
    </header>
  );
}
