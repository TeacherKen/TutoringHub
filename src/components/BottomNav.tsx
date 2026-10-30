"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SignOutButton } from "./SignOutButton";

const TUTOR = [
  { href: "/", label: "Home", icon: "M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" },
  { href: "/week", label: "Week", icon: "M4 6h16M4 6v14h16V6M8 3v4M16 3v4M4 11h16" },
  { href: "/students", label: "Students", icon: "M16 20v-1a4 4 0 0 0-8 0v1M12 12a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z" },
  { href: "/money", label: "Money", icon: "M12 3v18M16.5 7.5c0-1.7-2-3-4.5-3s-4.5 1.3-4.5 3 2 2.6 4.5 3 4.5 1.3 4.5 3-2 3-4.5 3-4.5-1.3-4.5-3" },
  { href: "/settings", label: "Settings", icon: "M4 7h10M18 7h2M4 17h4M12 17h8M14 4v6M8 14v6" },
];
const VIEWER = [{ href: "/schedule", label: "Schedule", icon: TUTOR[1].icon }];

export function BottomNav({ role }: { role: "tutor" | "viewer" }) {
  const path = usePathname();
  const items = role === "tutor" ? TUTOR : VIEWER;
  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:top-0 md:bottom-auto md:border-t-0 md:border-b"
    >
      <div className="mx-auto flex max-w-2xl items-stretch md:px-4">
        <span className="hidden items-center pr-6 font-semibold md:flex">TutoringHub</span>
        {items.map((it) => (
          <Link
            key={it.href}
            href={it.href}
            aria-current={active(it.href) ? "page" : undefined}
            className={`flex min-h-16 flex-1 flex-col items-center justify-center gap-0.5 text-xs md:min-h-14 md:flex-none md:flex-row md:gap-2 md:px-3 md:text-sm ${
              active(it.href) ? "text-accent" : "text-muted"
            }`}
          >
            <svg viewBox="0 0 24 24" className="h-6 w-6 md:h-5 md:w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d={it.icon} />
            </svg>
            {it.label}
          </Link>
        ))}
        {role === "viewer" ? (
          <div className="flex flex-1 md:ml-auto md:flex-none">
            <SignOutButton className="flex min-h-16 flex-1 flex-col items-center justify-center text-xs text-muted md:min-h-14 md:text-sm" />
          </div>
        ) : null}
      </div>
    </nav>
  );
}
