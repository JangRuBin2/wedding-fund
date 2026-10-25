"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "홈" },
  { href: "/transactions", label: "내역" },
  { href: "/patterns", label: "패턴" },
  { href: "/feedback", label: "피드백" },
  { href: "/settings", label: "설정" },
];

export function Nav() {
  const path = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-card/95 backdrop-blur md:static md:mx-auto md:mb-6 md:max-w-3xl md:border-0 md:bg-transparent">
      <ul className="mx-auto grid max-w-3xl grid-cols-5 pb-[env(safe-area-inset-bottom)]">
        {TABS.map((t) => {
          const active = t.href === "/" ? path === "/" : path.startsWith(t.href);
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                className={`block py-3.5 text-center text-[13px] font-semibold ${active ? "text-save" : "text-sub"}`}
              >
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
