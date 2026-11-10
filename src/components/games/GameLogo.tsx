"use client";
import type { ReactNode } from "react";
import type { GameInfo } from "@/lib/games";
import { BallIcon } from "./Controls";
import { FracText, Pie } from "./FractionShapes";

// 🖼️ Each game's logo: its own little scene, each from a different Kenney pack (CC0): space ships for
// Quick Maths, race cars for Times Tables, dice, donuts, robots, pirates, playing cards, pixel art…
// The pictures are made once from the packs (see public/games/art/CREDITS.txt) and saved as JPGs.
// Each also has a small badge that shows what the game is about.
// (It draws its own little clock, coins and shapes: importing them from the games would make a loop,
// because the games import GameKit, which shows this logo.)

const ART = "/games/art";
type Logo = { badge?: ReactNode }; // what the game is about (the picture is /games/art/logos/<id>.jpg)

const big = "font-sport font-bold leading-none";
const LOGOS: Record<GameInfo["id"], Logo> = {
  football: { badge: <BallIcon className="h-9 w-9" /> },
  "wolf-vs-sheep": { badge: <span className={`${big} text-lg`}>Trap it!</span> },
  "magic-square": { badge: <span className={`${big} text-xl`}>= 15</span> },
  qm: { badge: <span className={`${big} text-2xl tracking-wider`}>+ − × ÷</span> },
  tt: { badge: <span className={`${big} text-2xl italic`}>×7 · 60s</span> },
  sd: { badge: <span className={`${big} text-xl tracking-[.2em]`}>1234</span> },
  fp: { badge: <Pie parts={8} shaded={[0, 1, 2]} size={40} label="" /> },
  ff: { badge: <span className={`${big} flex items-center gap-1 text-xl`}><FracText f={{ n: 3, d: 4 }} className="" /> &gt; <FracText f={{ n: 2, d: 3 }} className="" /></span> },
  fc: { badge: <span className={`${big} flex items-center gap-1 text-xl`}><FracText f={{ n: 1, d: 3 }} className="" /> of 12</span> },
  ck: { badge: <MiniClock /> },
  ms: { badge: <span className="rounded-md bg-[#2f8f4f] px-2 py-0.5 font-sport text-lg font-bold text-white shadow-[inset_0_0_0_2px_#bfe8c9]">฿20</span> },
  cq: {},
  pb: { badge: <span className="flex gap-1"><Coin n={10} /><Coin n={5} /></span> },
  ls: { badge: <span className={`${big} text-xl`}>Shop</span> },
  sb: { badge: <MiniBlocks /> },
  bp: { badge: <span className="flex items-center gap-1"><svg viewBox="0 0 20 20" className="h-5 w-5" aria-hidden><path d="M10 2 L18 17 H2Z" fill="#3e63dd" /></svg><svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden><circle cx="10" cy="10" r="8" fill="#e5484d" /></svg><span className={`${big} text-lg`}>= 8</span></span> },
  pl: { badge: <MiniPixels /> },
  mn: { badge: <span className={`${big} text-2xl`}>6 × 4 = 24</span> },
  ns: { badge: <span className={`${big} text-xl tracking-wider`}>1 → 2 → 3</span> },
  "bridge-torch": { badge: <span className={`${big} text-xl text-[#b45309]`}>17 min</span> },
};

function MiniClock() {
  return (
    <svg viewBox="0 0 40 40" className="h-10 w-10" aria-hidden>
      <circle cx="20" cy="20" r="18" fill="#fffaf0" stroke="#1f2a44" strokeWidth="3" />
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2;
        return <circle key={i} cx={(20 + Math.sin(a) * 14).toFixed(2)} cy={(20 - Math.cos(a) * 14).toFixed(2)} r="1.2" fill="#1f2a44" />;
      })}
      <path d="M20 20 L13 15" stroke="#1f2a44" strokeWidth="3" strokeLinecap="round" />
      <path d="M20 20 L27 9" stroke="#e05a1f" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="20" cy="20" r="2" fill="#1f2a44" />
    </svg>
  );
}
function Coin({ n }: { n: number }) {
  return <span className="grid h-7 w-7 place-items-center rounded-full bg-[radial-gradient(circle_at_35%_30%,#fff3b0,#f5c400_55%,#c99a00)] text-xs font-black text-[#5a4000] shadow-[inset_0_0_0_2px_#d9a800]">{n}</span>;
}
function MiniBlocks() {
  const c = ["#e8173f", "#e8173f", "#f5c400", "#5ad60f", "#e8173f", "#17e0ff", "#f5c400", "#5ad60f", "#17e0ff"];
  return (
    <span className="grid grid-cols-3 gap-px">
      {c.map((x, i) => (
        <span key={i} className="h-3 w-3 rounded-[2px]" style={{ background: x, boxShadow: "inset 0 0 0 1px rgba(0,0,0,.25)" }} />
      ))}
    </span>
  );
}
function MiniPixels() {
  return (
    <span className="grid grid-cols-5 gap-px">
      {".#.#.##########.###...#..".split("").map((ch, i) => (
        <span key={i} className="h-2 w-2 rounded-[1px]" style={{ background: ch === "#" ? "#e11d48" : "#e2e8f0" }} />
      ))}
    </span>
  );
}

/** The logo picture for a game (used on the game tiles and in each game's banner). */
export function GameLogo({ id, className = "" }: { id: GameInfo["id"]; className?: string }) {
  const l = LOGOS[id];
  if (!l) return null;
  return (
    <span className={`relative block aspect-[16/10] w-full overflow-hidden rounded-2xl shadow-[0_8px_18px_rgba(0,0,0,.3)] ring-2 ring-white/40 ${className}`} aria-hidden>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`${ART}/logos/${id}.jpg`} alt="" draggable={false} className="absolute inset-0 h-full w-full object-cover" />
      {l.badge ? <span className="absolute left-2 top-2 flex items-center rounded-xl bg-white/95 px-2 py-1 text-[#1f2a44] shadow-md">{l.badge}</span> : null}
    </span>
  );
}
