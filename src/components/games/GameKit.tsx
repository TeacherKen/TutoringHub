"use client";
import { useEffect, useState, type ReactNode } from "react";
import { ConfettiBurst, makeConfetti, type Confetti } from "./Controls";
import { GameLogo } from "./GameLogo";
import type { GameInfo } from "@/lib/games";

// 🎨 Shared look for the games: a themed banner, level cards, a big start button, a themed board for the
// question, and a result screen with confetti. Each game picks a theme (colours and a picture).

export type Theme = { from: string; to: string; ink: string; accent: string; accentInk: string; shadow: string; mascot?: string; game?: GameInfo["id"] };

// Each game's animal friend (art: Kenney "Animal Pack", CC0, see public/games/art/CREDITS.txt).
const A = (name: string) => `/games/art/animals/${name}.png`;

export const THEMES = {
  chalk: { from: "#2f5d46", to: "#1d3d2e", ink: "#f4f1e6", accent: "#ffd84d", accentInk: "#3b2a00", shadow: "#9c7a12", mascot: A("monkey"), game: "qm" },
  arena: { from: "#1e3a8a", to: "#0f1e4d", ink: "#ffffff", accent: "#ffc629", accentInk: "#2b1a08", shadow: "#a67c00", mascot: A("horse"), game: "tt" },
  grape: { from: "#5b3fa8", to: "#2e1f66", ink: "#ffffff", accent: "#7ee0c3", accentInk: "#0b3b2e", shadow: "#3a9c80", mascot: A("panda"), game: "sd" },
  pizza: { from: "#c2412d", to: "#7f1d1d", ink: "#fff7ed", accent: "#facc15", accentInk: "#422006", shadow: "#a16207", mascot: A("chick"), game: "fp" },
  berry: { from: "#9d2b6b", to: "#4c1036", ink: "#ffffff", accent: "#ffd166", accentInk: "#3b2600", shadow: "#a8761a", mascot: A("parrot"), game: "ff" },
  sun: { from: "#f59e0b", to: "#b45309", ink: "#ffffff", accent: "#1e3a8a", accentInk: "#ffffff", shadow: "#0f1e4d", mascot: A("giraffe"), game: "fc" },
  shop: { from: "#2f7d4f", to: "#1d5235", ink: "#ffffff", accent: "#ffd84d", accentInk: "#3b2a00", shadow: "#9c7a12", mascot: A("rabbit"), game: "ms" },
  sky: { from: "#2f7d9a", to: "#164e63", ink: "#ffffff", accent: "#ffd84d", accentInk: "#3b2a00", shadow: "#9c7a12", mascot: A("owl"), game: "ck" },
  piggy: { from: "#e86fa3", to: "#9d2f63", ink: "#ffffff", accent: "#ffd84d", accentInk: "#3b2a00", shadow: "#9c7a12", mascot: A("pig"), game: "pb" },
  blocks: { from: "#1f7fa3", to: "#123f57", ink: "#ffffff", accent: "#ffd84d", accentInk: "#3b2a00", shadow: "#9c7a12", mascot: A("bear"), game: "sb" },
  scale: { from: "#b8892a", to: "#5e420f", ink: "#ffffff", accent: "#7ee0c3", accentInk: "#0b3b2e", shadow: "#3a9c80", mascot: A("elephant"), game: "bp" },
  pixel: { from: "#475569", to: "#1e293b", ink: "#ffffff", accent: "#f472b6", accentInk: "#ffffff", shadow: "#9d174d", mascot: A("penguin"), game: "pl" },
  felt: { from: "#1f6b4a", to: "#0e3a27", ink: "#ffffff", accent: "#ff6b5a", accentInk: "#ffffff", shadow: "#a33a2e", mascot: A("frog"), game: "mn" },
  snake: { from: "#3fa34d", to: "#1d5f28", ink: "#ffffff", accent: "#ffd84d", accentInk: "#3b2a00", shadow: "#9c7a12", mascot: A("snake"), game: "ns" },
} satisfies Record<string, Theme & { mascot: string; game: GameInfo["id"] }>;

const bg = (t: Theme) => ({ background: `radial-gradient(120% 100% at 30% 0%, ${t.from} 0%, ${t.to} 85%)`, color: t.ink });

/** The banner on a game's first screen: a big picture, the game's name and one line about it. */
export function GameHero({ theme, art, title, children }: { theme: Theme; art: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="relative overflow-hidden rounded-3xl p-5 shadow-[0_8px_24px_rgba(0,0,0,.18)]" style={bg(theme)}>
      <span className="pointer-events-none absolute -right-6 -top-8 h-36 w-36 rounded-full bg-white/10" aria-hidden />
      <span className="pointer-events-none absolute -bottom-10 left-10 h-24 w-24 rounded-full bg-white/5" aria-hidden />
      <div className="relative flex items-center gap-4">
        {theme.game ? (
          <span className="w-28 shrink-0 sm:w-40">
            <GameLogo id={theme.game} />
          </span>
        ) : (
          <div className="grid h-20 w-20 shrink-0 place-items-center rounded-2xl bg-white/15 text-5xl shadow-inner ring-1 ring-white/20" aria-hidden>
            {art}
          </div>
        )}
        <div className={`min-w-0 flex-1 ${theme.mascot && !theme.game ? "pr-14 sm:pr-20" : ""}`}>
          <p className="font-sport text-3xl font-bold leading-none tracking-wide">{title}</p>
          {children ? <p className="mt-1.5 text-sm leading-snug opacity-90">{children}</p> : null}
        </div>
      </div>
      {theme.mascot && !theme.game ? <Mascot src={theme.mascot} className="absolute -bottom-2 right-2 h-16 w-16 sm:h-24 sm:w-24" /> : null}
    </div>
  );
}

/** The game's animal friend, gently bobbing. */
export function Mascot({ src, className = "", cheer = false, delay = 0 }: { src: string; className?: string; cheer?: boolean; delay?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      aria-hidden
      draggable={false}
      className={`pz-anim pointer-events-none select-none object-contain drop-shadow-[0_6px_6px_rgba(0,0,0,.3)] ${className}`}
      style={{ animation: cheer ? `gk-cheer .7s ease-in-out ${delay}s infinite` : `pz-float 3s ease-in-out ${delay}s infinite` }}
    />
  );
}

/** Level cards: 1, 2 or 3 bars show how hard each one is. */
export function LevelPicker<K extends string>({ levels, value, onChange, theme }: { levels: [K, string][]; value: K; onChange: (k: K) => void; theme: Theme }) {
  return (
    <div className="grid gap-2">
      {levels.map(([k, label], i) => {
        const on = value === k;
        return (
          <button
            key={k}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(k)}
            className={`flex min-h-14 items-center gap-3 rounded-2xl border-2 px-4 text-left transition ${on ? "-translate-y-0.5 shadow-md" : "border-line bg-surface hover:border-[color:var(--lv)]"}`}
            style={{ ["--lv" as string]: theme.from, ...(on ? { borderColor: theme.from, background: `color-mix(in srgb, ${theme.from} 10%, var(--surface, #fff))` } : {}) }}
          >
            <span className="flex items-end gap-0.5" aria-hidden>
              {[0, 1, 2].map((b) => (
                <span key={b} className="w-1.5 rounded-sm" style={{ height: 8 + b * 6, background: b <= Math.min(i, 2) ? theme.from : "color-mix(in srgb, currentColor 15%, transparent)" }} />
              ))}
            </span>
            <span className={`flex-1 ${on ? "font-semibold" : ""}`}>{label}</span>
            {on ? (
              <span className="grid h-6 w-6 place-items-center rounded-full text-xs font-bold text-white" style={{ background: theme.from }} aria-hidden>
                ✓
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/** Two or three chunky side-by-side choices (baht or dollars, 4×4 or 6×6…). */
export function Toggle<K extends string>({ options, value, onChange, theme }: { options: [K, ReactNode][]; value: K; onChange: (k: K) => void; theme: Theme }) {
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map(([k, label]) => {
        const on = value === k;
        return (
          <button
            key={k}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(k)}
            className={`min-h-14 rounded-2xl border-2 px-3 text-lg font-semibold transition ${on ? "-translate-y-0.5 border-transparent text-white" : "border-line bg-surface"}`}
            style={on ? { background: `linear-gradient(${theme.from}, ${theme.to})`, boxShadow: `0 4px 0 color-mix(in srgb, ${theme.to}, #000 35%)` } : undefined}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

/** A big, chunky button (it presses down when tapped). */
export function BigButton({ theme, onClick, children, disabled = false }: { theme: Theme; onClick: () => void; children: ReactNode; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="w-full rounded-2xl py-4 text-lg font-bold transition active:translate-y-1 disabled:opacity-50"
      style={{ background: `linear-gradient(${theme.accent}, color-mix(in srgb, ${theme.accent}, #000 12%))`, color: theme.accentInk, boxShadow: `0 5px 0 ${theme.shadow}` }}
    >
      {children}
    </button>
  );
}

/** The themed board the question sits on (a chalkboard, a scoreboard…). */
export function Board({ theme, children, className = "" }: { theme: Theme; children: ReactNode; className?: string }) {
  return (
    <div className={`relative overflow-hidden rounded-3xl px-4 py-5 shadow-[inset_0_2px_12px_rgba(0,0,0,.35),0_6px_18px_rgba(0,0,0,.15)] ring-4 ring-black/10 ${className}`} style={bg(theme)}>
      {children}
    </div>
  );
}

/** A progress bar with a little runner (an emoji) moving along it. */
export function Runner({ theme, value, max, icon = "🚀" }: { theme: Theme; value: number; max: number; icon?: string }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="relative h-8" aria-hidden>
      <div className="absolute inset-x-0 top-1/2 h-3 -translate-y-1/2 overflow-hidden rounded-full bg-surface-2 shadow-inner">
        <div className="h-full rounded-full transition-all duration-300" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${theme.from}, ${theme.accent})` }} />
      </div>
      <span className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 text-2xl transition-all duration-300" style={{ left: `${Math.max(4, Math.min(96, pct))}%` }}>
        {icon}
      </span>
      <span className="absolute right-0 top-1/2 -translate-y-1/2 text-xl">🏁</span>
    </div>
  );
}

/** The end of a round: a big result, a trophy for a new best, confetti, and play-again buttons. */
export function ResultCard(props: {
  theme: Theme;
  art: ReactNode;
  label: string;
  big: ReactNode;
  newBest: boolean;
  bestText?: string;
  onAgain: () => void;
  onChange: () => void;
  changeLabel?: string;
  againLabel?: string;
  children?: ReactNode;
}) {
  const { theme } = props;
  const [pieces, setPieces] = useState<Confetti[]>([]);
  useEffect(() => {
    const id = setTimeout(() => setPieces(makeConfetti([theme.accent, theme.from, "#ffffff", "#ff7ab0", "#7ad7ff"], props.newBest ? 80 : 45, 560)), 0);
    return () => clearTimeout(id);
  }, [theme, props.newBest]);
  return (
    <div className="relative space-y-4 text-center">
      <ConfettiBurst pieces={pieces} className="left-1/2 top-20" />
      <div className="relative overflow-hidden rounded-3xl p-6 shadow-[0_8px_24px_rgba(0,0,0,.18)]" style={bg(theme)}>
        {theme.mascot ? (
          <span className="pz-anim inline-block animate-[tt-pop_.5s_ease-out]">
            <Mascot src={theme.mascot} cheer className="mx-auto h-24 w-24" />
          </span>
        ) : (
          <p className="pz-anim animate-[tt-pop_.5s_ease-out] text-6xl" aria-hidden>
            {props.newBest ? "🏆" : props.art}
          </p>
        )}
        <p className="mt-2 text-sm font-semibold uppercase tracking-[0.2em] opacity-80">{props.label}</p>
        <p className="font-sport text-6xl font-bold tabular-nums">{props.big}</p>
        {props.newBest ? (
          <p className="mx-auto mt-2 w-max rounded-full px-3 py-1 text-sm font-bold" style={{ background: theme.accent, color: theme.accentInk }}>
            New personal best!
          </p>
        ) : props.bestText ? (
          <p className="mt-1 text-sm opacity-85">{props.bestText}</p>
        ) : null}
      </div>
      {props.children}
      <div className="flex gap-2">
        <button type="button" className="btn-secondary min-h-14 flex-1" onClick={props.onChange}>
          {props.changeLabel ?? "Change level"}
        </button>
        <div className="flex-1">
          <BigButton theme={theme} onClick={props.onAgain}>
            {props.againLabel ?? "Play again"}
          </BigButton>
        </div>
      </div>
    </div>
  );
}
