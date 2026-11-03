"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { onSoundSettings, play, reloadSoundSettings, setSoundSettings } from "@/lib/sounds";
import { SignOutButton } from "./SignOutButton";

// 🧊 The top bar (TutoringHub Glass): a frosted pill with the "T" tile, rounded tabs (the open one in mint),
// and a round sound on/off button. Below 900px the tabs scroll sideways and the word TutoringHub hides.
// Icons are the ones from the design mockups.

const svg = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;

const ICONS: Record<string, React.ReactNode> = {
  home: (
    <svg {...svg}>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
    </svg>
  ),
  week: (
    <svg {...svg}>
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <path d="M8 2v4M16 2v4M3 10h18" />
    </svg>
  ),
  students: (
    <svg {...svg}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </svg>
  ),
  play: (
    <svg {...svg}>
      <circle cx="12" cy="12" r="9" />
      <path d="m12 7 4 3-1.5 5h-5L8 10z" />
    </svg>
  ),
  money: (
    <svg {...svg}>
      <path d="M12 2v20M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  ),
  settings: (
    <svg {...svg}>
      <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12" />
      <circle cx="16" cy="6" r="2" />
      <circle cx="10" cy="12" r="2" />
      <circle cx="18" cy="18" r="2" />
    </svg>
  ),
};

const TUTOR = [
  { href: "/", label: "Home", icon: "home" },
  { href: "/week", label: "Week", icon: "week" },
  { href: "/students", label: "Students", icon: "students" },
  { href: "/play", label: "Play", icon: "play" },
  { href: "/money", label: "Money", icon: "money" },
  { href: "/settings", label: "Settings", icon: "settings" },
];
const VIEWER = [{ href: "/schedule", label: "Schedule", icon: "week" }];

export function GlassNav({ role }: { role: "tutor" | "viewer" }) {
  const path = usePathname();
  const items = role === "tutor" ? TUTOR : VIEWER;
  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));

  // Sound on/off, saved on this device. Read after the page loads (the server can't see it).
  const [soundOn, setSoundOn] = useState(true);
  useEffect(() => {
    const sync = () => setSoundOn(reloadSoundSettings().enabled);
    sync();
    return onSoundSettings(() => setSoundOn(reloadSoundSettings().enabled));
  }, []);
  function toggleSound() {
    const next = setSoundSettings({ enabled: !soundOn });
    if (next.enabled) play("toggle");
  }

  return (
    <header className="glass sticky top-3 z-40 mx-auto flex w-full max-w-[1240px] items-center gap-3 rounded-[26px] p-2">
      <Link
        href={role === "tutor" ? "/" : "/schedule"}
        onClick={() => play("nav")}
        className="press flex shrink-0 items-center gap-2.5 rounded-2xl border border-transparent py-1 pl-1 pr-2.5"
      >
        <span className="glass-hi grid h-[42px] w-[42px] place-items-center rounded-[13px] text-[21px] font-bold text-[var(--th-accent)]" style={{ fontFamily: "var(--font-display)" }}>
          T
        </span>
        <span className="brand-text text-[19px] font-semibold" style={{ fontFamily: "var(--font-display)" }}>
          TutoringHub
        </span>
      </Link>

      <nav aria-label="Main" className="topnav flex min-w-0 flex-1 gap-1">
        {items.map((it) => {
          const on = active(it.href);
          return (
            <Link key={it.href} href={it.href} aria-current={on ? "page" : undefined} onClick={() => play("nav")} className={`tab press ${on ? "is-on" : ""}`}>
              {ICONS[it.icon]}
              {it.label}
            </Link>
          );
        })}
      </nav>

      {role === "viewer" ? <SignOutButton className="tab press shrink-0" /> : null}
      <button
        type="button"
        onClick={toggleSound}
        aria-label={soundOn ? "Sounds on. Turn sounds off" : "Sounds off. Turn sounds on"}
        aria-pressed={soundOn}
        className="glass press grid h-[46px] w-[46px] shrink-0 place-items-center rounded-full"
      >
        {soundOn ? (
          <svg {...svg}>
            <path d="M11 5 6 9H2v6h4l5 4z" />
            <path d="M15.5 8.5a5 5 0 0 1 0 7" />
            <path d="M19 5a10 10 0 0 1 0 14" />
          </svg>
        ) : (
          <svg {...svg}>
            <path d="M11 5 6 9H2v6h4l5 4z" />
            <path d="m22 9-6 6M16 9l6 6" />
          </svg>
        )}
      </button>
    </header>
  );
}

/** Three slow-drifting colour glows behind everything (never clickable). */
export function GlassOrbs() {
  return (
    <div aria-hidden className="orbs">
      <div className="orb" style={{ width: 680, height: 680, left: -160, top: -220, background: "radial-gradient(circle, rgba(var(--g-orb-1, 45,212,191),0.42), rgba(var(--g-orb-1, 45,212,191),0) 68%)" }} />
      <div className="orb" style={{ width: 560, height: 560, right: -120, top: 120, background: "radial-gradient(circle, rgba(var(--g-orb-2, 96,165,250),0.32), rgba(var(--g-orb-2, 96,165,250),0) 68%)", animationDelay: "-6s" }} />
      <div className="orb" style={{ width: 600, height: 600, left: "30%", bottom: -260, background: "radial-gradient(circle, rgba(var(--g-orb-3, 251,146,60),0.22), rgba(var(--g-orb-3, 251,146,60),0) 68%)", animationDelay: "-11s" }} />
    </div>
  );
}
