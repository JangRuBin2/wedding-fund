"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const I = {
  home: <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z" />,
  list: <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />,
  pattern: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  ring: (
    <>
      <circle cx="12" cy="14.5" r="6" />
      <path d="M9.5 8.8 8 5.5h8l-1.5 3.3M8 5.5l4 3.3 4-3.3" />
    </>
  ),
  gear: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1 7 17M17 7l2.1-2.1" />
    </>
  ),
};

const TABS = [
  { href: "/", label: "홈", icon: I.home },
  { href: "/transactions", label: "내역", icon: I.list },
  { href: "/wedding", label: "결혼준비", icon: I.ring },
  { href: "/patterns", label: "분석", icon: I.pattern },
  { href: "/settings", label: "설정", icon: I.gear },
];

export function Nav() {
  const path = usePathname();
  return (
    // iOS 탭바처럼 화면 아래 떠 있는 유리 캡슐. 데스크톱에선 위에 붙음
    <nav className="fixed inset-x-0 bottom-0 z-20 px-4 pb-[max(14px,env(safe-area-inset-bottom))] md:top-0 md:bottom-auto md:pt-4 md:pb-0">
      <ul className="glass mx-auto grid max-w-md grid-cols-5 rounded-full p-1.5">
        {TABS.map((t) => {
          const active =
            t.href === "/" ? path === "/" : path.startsWith(t.href) || (t.href === "/patterns" && path.startsWith("/feedback"));
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center gap-0.5 rounded-full py-2 text-[11px] font-semibold transition-colors ${
                  active ? "bg-save-soft text-save" : "text-sub"
                }`}
              >
                <svg
                  viewBox="0 0 24 24"
                  width="22"
                  height="22"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={active ? 2.2 : 1.8}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  {t.icon}
                </svg>
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
