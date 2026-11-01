"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SignOutButton } from "./SignOutButton";

const TUTOR = [
  { href: "/", label: "Home", icon: "M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" },
  { href: "/week", label: "Week", icon: "M4 6h16M4 6v14h16V6M8 3v4M16 3v4M4 11h16" },
  { href: "/students", label: "Students", icon: "M16 20v-1a4 4 0 0 0-8 0v1M12 12a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z" },
  { href: "/play", label: "Play", icon: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7.6l3.4 2.5-1.3 4h-4.2l-1.3-4zM12 7.6V3.4M15.4 10.1l4-1.3M14.1 14.1l2.5 3.4M9.9 14.1l-2.5 3.4M8.6 10.1l-4-1.3" },
  { href: "/money", label: "Money", icon: "M12 3v18M16.5 7.5c0-1.7-2-3-4.5-3s-4.5 1.3-4.5 3 2 2.6 4.5 3 4.5 1.3 4.5 3-2 3-4.5 3-4.5-1.3-4.5-3" },
  { href: "/settings", label: "Settings", icon: "M4 7h10M18 7h2M4 17h4M12 17h8M14 4v6M8 14v6" },
];
const VIEWER = [{ href: "/schedule", label: "Schedule", icon: TUTOR[1].icon }];

function Icon({ d, className }: { d: string; className: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}

/** The app's mark: the same teal "T" as the home-screen icon. */
function Mark() {
  return (
    <span aria-hidden className="grid h-8 w-8 place-items-center rounded-[9px] bg-accent text-[17px] font-bold leading-none text-accent-text">
      T
    </span>
  );
}

/** Top bar on a computer; a bar along the bottom on a phone. */
export function BottomNav({ role, path: forced }: { role: "tutor" | "viewer"; path?: string }) {
  const here = usePathname();
  const path = forced ?? here;
  const items = role === "tutor" ? TUTOR : VIEWER;
  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));

  return (
    <>
      {/* Computer: across the top */}
      <nav aria-label="Main" className="sticky top-0 z-30 hidden border-b border-line bg-surface/90 backdrop-blur md:block">
        <div className="mx-auto flex h-16 max-w-5xl items-center gap-6 px-4">
          <Link href={role === "tutor" ? "/" : "/schedule"} className="flex items-center gap-2.5 rounded-lg font-semibold tracking-tight focus-visible:outline-2 focus-visible:outline-accent">
            <Mark />
            <span className="text-[17px]">TutoringHub</span>
          </Link>
          <div className="flex items-center gap-1">
            {items.map((it) => {
              const on = active(it.href);
              return (
                <Link
                  key={it.href}
                  href={it.href}
                  aria-current={on ? "page" : undefined}
                  className={`flex h-10 items-center gap-2 rounded-full px-3.5 text-[15px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                    on ? "bg-accent text-accent-text" : "text-ink/75 hover:bg-surface-2 hover:text-ink"
                  }`}
                >
                  <Icon d={it.icon} className="h-[18px] w-[18px]" />
                  {it.label}
                </Link>
              );
            })}
          </div>
          {role === "viewer" ? <SignOutButton className="ml-auto h-10 rounded-full px-3.5 text-[15px] font-medium text-muted hover:bg-surface-2" /> : null}
        </div>
      </nav>

      {/* Phone: along the bottom, within thumb reach */}
      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        <div className="mx-auto flex max-w-xl items-stretch">
          {items.map((it) => {
            const on = active(it.href);
            return (
              <Link
                key={it.href}
                href={it.href}
                aria-current={on ? "page" : undefined}
                className={`flex min-h-16 flex-1 flex-col items-center justify-center gap-1 text-[11px] ${on ? "font-semibold text-accent" : "font-medium text-muted"}`}
              >
                <span className={`grid h-8 w-14 place-items-center rounded-full transition-colors ${on ? "bg-accent-soft" : ""}`}>
                  <Icon d={it.icon} className="h-[22px] w-[22px]" />
                </span>
                {it.label}
              </Link>
            );
          })}
          {role === "viewer" ? (
            <div className="flex flex-1">
              <SignOutButton className="flex min-h-16 flex-1 flex-col items-center justify-center text-[11px] font-medium text-muted" />
            </div>
          ) : null}
        </div>
      </nav>
    </>
  );
}
