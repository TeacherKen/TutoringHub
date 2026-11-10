"use client";
import "@fontsource/barlow-condensed/700.css";
import "@fontsource/barlow-condensed/800-italic.css";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { GAMES, type GameInfo } from "@/lib/games";
import { GameLogo } from "./GameLogo";

// 🎮 The games corner: for children on Mr Ken's iPad in an onsite lesson. Full screen, no
// TutoringHub menu (so nobody wanders into Money or Settings); leaving needs a 2-second hold.

const NAVY = "#0b1d42";

/** The frame around every games-corner screen. */
export function ArcadeShell({ children, back, title, glass = false }: { children: React.ReactNode; back?: string; title?: string; glass?: boolean }) {
  return (
    <div className="flex min-h-dvh flex-col text-white" style={glass ? undefined : { background: `radial-gradient(120% 80% at 50% 0%, #17336f 0%, ${NAVY} 60%)` }}>
      <header className="flex items-center justify-between gap-3 px-4 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-6">
        {back ? (
          <Link href={back} className="flex min-h-12 shrink-0 items-center gap-2 whitespace-nowrap rounded-full bg-white/10 px-4 text-lg font-semibold hover:bg-white/15">
            <span aria-hidden>‹</span> All games
          </Link>
        ) : (
          <span className="font-sport text-[30px] font-extrabold italic leading-none sm:text-[36px]">Games corner</span>
        )}
        {title ? <span className="font-sport min-w-0 truncate text-2xl font-bold">{title}</span> : null}
        {back ? <span className="hidden w-28 sm:block" aria-hidden /> : <HoldToExit />}
      </header>
      <main className="flex min-h-0 flex-1 flex-col px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">{children}</main>
    </div>
  );
}

/** Leave the games corner: press and hold for 2 seconds (a simple lock against little fingers). */
function HoldToExit() {
  const router = useRouter();
  const [progress, setProgress] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const HOLD_MS = 2000;

  function stop() {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    setProgress(0);
  }
  function begin() {
    if (timer.current) return;
    const t0 = Date.now();
    timer.current = setInterval(() => {
      const p = Math.min(1, (Date.now() - t0) / HOLD_MS);
      setProgress(p);
      if (p >= 1) {
        stop();
        router.push("/play");
      }
    }, 40);
  }
  useEffect(() => stop, []);

  const R = 15;
  const C = 2 * Math.PI * R;
  return (
    <button
      type="button"
      onPointerDown={begin}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && begin()}
      onKeyUp={stop}
      onContextMenu={(e) => e.preventDefault()}
      className="flex min-h-12 select-none items-center gap-2 rounded-full bg-white/10 px-3 pr-4 text-sm font-medium text-white/80 [-webkit-touch-callout:none] hover:bg-white/15"
      aria-label="Hold for 2 seconds to leave the games corner"
    >
      <svg viewBox="0 0 36 36" className="h-8 w-8 -rotate-90" aria-hidden>
        <circle cx="18" cy="18" r={R} fill="none" stroke="rgba(255,255,255,.2)" strokeWidth="3" />
        <circle cx="18" cy="18" r={R} fill="none" stroke="#ffc629" strokeWidth="3" strokeDasharray={C} strokeDashoffset={C * (1 - progress)} strokeLinecap="round" />
      </svg>
      {progress > 0 ? "Keep holding…" : "Hold to exit"}
    </button>
  );
}

type Kid = { id: string; name: string; onsite: boolean };

/** The games corner's front page: a big tile for each game. Football asks who's playing first. */
export function ArcadeHub({ kids, glass = false }: { kids: Kid[]; glass?: boolean }) {
  const [choosing, setChoosing] = useState(false);
  const sorted = [...kids].sort((a, b) => Number(b.onsite) - Number(a.onsite) || a.name.localeCompare(b.name));
  return (
    <ArcadeShell glass={glass}>
      <div className="mx-auto grid w-full max-w-5xl grid-cols-1 gap-3 py-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
        {GAMES.map((g) => {
          const inner = (
            <>
              <span className={`flex flex-1 items-center justify-center pb-3 ${glass ? "art" : ""}`}>
                <GameLogo id={g.id} />
              </span>
              <span className="block">
                <span className="font-sport block text-[30px] font-extrabold italic leading-none">{g.name}</span>
                <span className="mt-1 block text-[15px] opacity-80">{g.blurb}</span>
                <span className="mt-0.5 block text-sm opacity-60">{g.players}</span>
              </span>
            </>
          );
          const cls = "flex min-h-56 flex-col rounded-3xl p-5 text-left shadow-[0_12px_30px_rgba(0,0,0,.35)] transition active:scale-[.98] focus-visible:outline-4 focus-visible:outline-[#ffc629]";
          // Glass: each game's colour as tinted glass with white text (like the Play page).
          const tile = glass
            ? { cls: `${cls} game`, style: { background: `color-mix(in srgb, ${g.bg} 38%, transparent)`, borderColor: `color-mix(in srgb, color-mix(in srgb, ${g.bg}, #ffffff 30%) 55%, transparent)`, color: "#ffffff" } }
            : null;
          return g.id === "football" ? (
            <button key={g.id} type="button" onClick={() => setChoosing(true)} className={tile?.cls ?? cls} style={tile?.style ?? { background: `repeating-linear-gradient(90deg, ${g.bg} 0 44px, #227a43 44px 88px)`, color: g.fg }}>
              {inner}
            </button>
          ) : (
            <Link key={g.id} href={`/arcade/${g.id}`} className={tile?.cls ?? cls} style={tile?.style ?? { background: g.bg, color: g.fg }}>
              {inner}
            </Link>
          );
        })}
      </div>

      {choosing ? (
        <div role="dialog" aria-modal="true" aria-label="Who's playing?" className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-3 sm:items-center" onClick={() => setChoosing(false)}>
          <div className={`w-full max-w-2xl rounded-3xl p-5 sm:p-6 ${glass ? "glass-hi" : ""}`} style={glass ? undefined : { background: NAVY }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-sport text-4xl font-extrabold italic">Who&apos;s playing?</h2>
              <button type="button" className="min-h-12 rounded-full bg-white/10 px-4 font-semibold hover:bg-white/15" onClick={() => setChoosing(false)}>
                Close
              </button>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {sorted.map((k) => (
                <Link key={k.id} href={`/arcade/football/${k.id}`} className="font-sport flex min-h-16 items-center rounded-2xl bg-white/10 px-4 text-[28px] font-bold hover:bg-white/15 active:scale-95">
                  {k.name}
                </Link>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </ArcadeShell>
  );
}

/** One game, full screen, with a big "All games" button back to the games corner. */
export function ArcadeGame({ id, children }: { id: GameInfo["id"]; children?: React.ReactNode }) {
  const g = GAMES.find((x) => x.id === id)!;
  return (
    <ArcadeShell back="/arcade" title={g.name}>
      {g.src ? (
        <iframe src={g.src} title={g.name} className="w-full flex-1 rounded-2xl border-0 bg-white" style={{ minHeight: "80dvh" }} />
      ) : (
        <div className={`mx-auto my-3 w-full rounded-3xl bg-surface p-5 text-ink shadow-xl sm:p-7 ${g.wide ? "max-w-5xl" : "max-w-xl"}`}>{children}</div>
      )}
    </ArcadeShell>
  );
}
