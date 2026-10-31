"use client";
import { useEffect } from "react";

// The match scene for Football Times Tables. The stadium is a picture (1672 × 941) and
// everything else is placed on it in the same units, so it lines up on any screen size.
// The players are cut-out pictures in /public/games/football; the kicker's white shirt has
// been recoloured into each team colour ahead of time (one picture per kit).

const ART = "/games/football";
const W = 1672;
const H = 941;

// Measured on the stadium picture.
const GOAL = { left: 562, right: 1108, top: 346, line: 527 };
const SPOT = { x: 837, y: 799 };
const BALL_R = 25; // the ball is as wide as the penalty spot when it sits on it
const BALL_AT_GOAL = 0.36; // and much smaller when it reaches the goal
const REST = { x: SPOT.x, y: SPOT.y - BALL_R + 6 }; // the ball's middle when it sits on the spot

export const TARGETS = [
  { x: 640, y: 398, label: "top left" },
  { x: 1030, y: 398, label: "top right" },
  { x: 640, y: 486, label: "bottom left" },
  { x: 1030, y: 486, label: "bottom right" },
] as const;

// Keeper pictures and where they go (picture sizes come from public/games/football/info.json).
const KEEPER_READY = { src: `${ART}/keeper-ready.webp`, w: 143, h: 150, x: 836 - 71.5, y: GOAL.line - 150 };
const DIVES = [
  { src: `${ART}/keeper-high.webp`, w: 189, h: 114, x: 628, y: 384, flip: false },
  { src: `${ART}/keeper-high.webp`, w: 189, h: 114, x: 1042 - 189, y: 384, flip: true },
  { src: `${ART}/keeper-low.webp`, w: 221, h: 65, x: 624, y: 446, flip: false },
  { src: `${ART}/keeper-low.webp`, w: 221, h: 65, x: 1046 - 221, y: 446, flip: true },
];
const KEEPER_MID = { x: 836, y: GOAL.line - 75 };

// The kicker (both pictures at the same scale: 400 units tall).
const KICKER_READY = { w: 159, h: 400, x: 548, y: 538, shirt: { x: 78, name: 92, num: 158 } };
const KICKER_SHOOT = { w: 431, h: 400, x: 420, y: 512, shirt: { x: 208, name: 92, num: 158, rot: -8 } };

const NAVY = "#0b1d42";
const GOLD = "#ffc629";
const SPORT = '"Barlow Condensed", "Avenir Next Condensed", "Arial Narrow", sans-serif';

export type Shot = { target: number; keeper: number; result: "goal" | "saved"; power: boolean; stage: "fly" | "after" };

export const KITS = [
  { id: "red", shirt: "#d62839", text: "#ffffff" },
  { id: "blue", shirt: "#1f5fd6", text: "#ffffff" },
  { id: "yellow", shirt: "#f7c815", text: "#0b1d42" },
  { id: "purple", shirt: "#6d3fd1", text: "#ffffff" },
  { id: "orange", shirt: "#f26b1d", text: "#ffffff" },
  { id: "sky", shirt: "#4cb5f5", text: "#0b1d42" },
  { id: "white", shirt: "#f4f6fb", text: "#0b1d42" },
] as const;
export type Kit = (typeof KITS)[number];

const KEEPER_KIT = "#b8ef2a";

// Camera flashes in the crowd (not over the goal).
function seeded(seed: number) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}
const rand = seeded(11);
const FLASHES = Array.from({ length: 60 }, () => ({ x: rand() * W, y: 140 + rand() * 300, d: Math.floor(rand() * 800) })).filter(
  (f) => !(f.x > GOAL.left - 20 && f.x < GOAL.right + 20 && f.y > GOAL.top - 10),
);

export function Stadium({
  shot,
  aiming,
  onAim,
  kit,
  name,
  cheer,
  banner,
  goals,
  kicks,
  streak,
  sound,
  onToggleSound,
  board,
  target,
}: {
  shot: Shot | null;
  aiming: boolean;
  onAim: (target: number) => void;
  kit: Kit;
  name: string;
  cheer: number; // goes up by one for each goal, to replay the celebration
  banner: { key: number; text: string; tone: "goal" | "saved"; sub?: string } | null;
  goals: boolean[];
  kicks: number;
  streak: number;
  sound: boolean;
  onToggleSound: () => void;
  /** In a head-to-head match: everyone's goals instead of "name vs keeper". */
  board?: { id: string; name: string; goals: number; colour: string; me: boolean }[];
  target?: number;
}) {
  // Load every picture up front, so nothing pops in late during a kick.
  useEffect(() => {
    for (const src of [`${ART}/keeper-high.webp`, `${ART}/keeper-low.webp`, `${ART}/kicker-shoot-${kit.id}.webp`, `${ART}/kicker-ready-${kit.id}.webp`]) {
      const img = new Image();
      img.src = src;
    }
  }, [kit.id]);

  const t = shot ? TARGETS[shot.target] : null;
  const flying = shot?.stage === "fly";
  const ball = !shot || !t ? REST : flying ? t : shot.result === "goal" ? { x: t.x, y: t.y + 16 } : { x: t.x + (t.x < 836 ? 150 : -150), y: 660 };
  const ballScale = !shot ? 1 : flying || shot.result === "goal" ? BALL_AT_GOAL : 0.6;
  const timing = !shot ? null : flying ? "520ms 160ms" : "460ms";
  const shadowY = !shot ? SPOT.y + 2 : shot.result === "saved" && !flying ? 700 : GOAL.line + 2;
  const dive = shot ? DIVES[shot.keeper] : null;
  const scored = goals.filter(Boolean).length;
  const kicker = shot ? KICKER_SHOOT : KICKER_READY;
  const label = name.toUpperCase().slice(0, 10);

  return (
    <div className="relative aspect-video w-full select-none overflow-hidden rounded-2xl shadow-lg" style={{ background: NAVY, touchAction: "manipulation" }}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full" role="img" aria-label="Football stadium at night with a goalkeeper in goal and the ball on the penalty spot">
        <defs>
          <radialGradient id="tt-vignette" cx="0.5" cy="0.5" r="0.75">
            <stop offset="0.62" stopColor="#000" stopOpacity="0" />
            <stop offset="1" stopColor="#000" stopOpacity="0.4" />
          </radialGradient>
          <radialGradient id="tt-burst" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor={GOLD} stopOpacity="0.55" />
            <stop offset="1" stopColor={GOLD} stopOpacity="0" />
          </radialGradient>
          <radialGradient id="tt-ball" cx="0.35" cy="0.3" r="0.75">
            <stop offset="0" stopColor="#ffffff" />
            <stop offset="0.7" stopColor="#e3e8f0" />
            <stop offset="1" stopColor="#8e9aae" />
          </radialGradient>
          <filter id="tt-led" x="-10%" y="-50%" width="120%" height="200%">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="tt-fire" x="-100%" y="-100%" width="300%" height="300%">
            <feDropShadow dx="0" dy="0" stdDeviation="5" floodColor="#ff8a00" floodOpacity="1" />
          </filter>
          <filter id="tt-soft-shadow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" />
          </filter>
          <clipPath id="tt-ball-clip">
            <circle r="13" />
          </clipPath>
          <g id="tt-ball-art">
            <circle r="13" fill="url(#tt-ball)" />
            <g clipPath="url(#tt-ball-clip)" fill="#1c2333">
              <path d="M0 -5.2 L4.9 -1.6 L3 4.2 L-3 4.2 L-4.9 -1.6Z" />
              <path d="M0 -13 L4 -10.5 L2.6 -7.6 L-2.6 -7.6 L-4 -10.5Z" />
              <path d="M12.4 -4 L13 1.2 L10 2.4 L8.4 -1.4 L10.4 -4.6Z" />
              <path d="M-12.4 -4 L-13 1.2 L-10 2.4 L-8.4 -1.4 L-10.4 -4.6Z" />
              <path d="M7.6 10.5 L4 13 L1.6 10.6 L3.8 7.6 L7.6 8Z" />
              <path d="M-7.6 10.5 L-4 13 L-1.6 10.6 L-3.8 7.6 L-7.6 8Z" />
            </g>
            <ellipse cx="-4.5" cy="-5.5" rx="4.5" ry="2.6" fill="#ffffff" opacity="0.6" transform="rotate(-30 -4.5 -5.5)" />
          </g>
        </defs>

        <image href={`${ART}/stadium.webp`} width={W} height={H} preserveAspectRatio="none" />

        {/* Our names on the LED boards */}
        <g filter="url(#tt-led)" fontFamily={SPORT} fontWeight="800" fontStyle="italic" fontSize="28" letterSpacing="4" textAnchor="middle" opacity="0.92">
          {/* placed inside the part of the boards that stays on screen when the sides are trimmed */}
          <text x="372" y="492" fill="#ffffff">
            MR KEN FC
          </text>
          <text x="1300" y="492" fill="#ffffff">
            TIMES TABLES
          </text>
        </g>

        {cheer ? (
          <g key={`flash-${cheer}`}>
            {FLASHES.map((f, n) => (
              <circle key={n} className="tt-flash" cx={f.x} cy={f.y} r="5" fill="#ffffff" style={{ animationDelay: `${f.d}ms` }} />
            ))}
            <circle className="tt-burst" cx={(GOAL.left + GOAL.right) / 2} cy={(GOAL.top + GOAL.line) / 2} r="420" fill="url(#tt-burst)" />
          </g>
        ) : null}

        {/* Goalkeeper: ready, or diving */}
        <ellipse
          cx={dive ? dive.x + dive.w / 2 : 836}
          cy={GOAL.line + 4}
          rx={dive ? dive.w * 0.45 : 52}
          ry="8"
          fill="#000"
          opacity={dive ? 0.22 : 0.35}
          filter="url(#tt-soft-shadow)"
        />
        {dive ? (
          <g
            key={`dive-${shot?.keeper}`}
            className="tt-dive"
            style={
              {
                "--fx": `${KEEPER_MID.x - (dive.x + dive.w / 2)}px`,
                "--fy": `${KEEPER_MID.y - (dive.y + dive.h / 2)}px`,
                "--fr": dive.flip ? "-25deg" : "25deg",
                animationDelay: "160ms",
              } as React.CSSProperties
            }
          >
            <g transform={dive.flip ? `translate(${dive.x + dive.w} ${dive.y}) scale(-1 1)` : `translate(${dive.x} ${dive.y})`}>
              <image href={dive.src} width={dive.w} height={dive.h} />
            </g>
          </g>
        ) : (
          <g className="tt-keeper">
            <image href={KEEPER_READY.src} x={KEEPER_READY.x} y={KEEPER_READY.y} width={KEEPER_READY.w} height={KEEPER_READY.h} />
          </g>
        )}

        {/* Ball shadow stays on the grass */}
        <g style={{ transform: `translate(${ball.x}px, ${shadowY}px) scale(${ballScale})`, transition: timing ? `transform ${timing} linear` : "none" }}>
          <ellipse rx={BALL_R * 1.05} ry={BALL_R * 0.32} fill="#000" opacity="0.4" filter="url(#tt-soft-shadow)" />
        </g>

        {/* Kicker, seen from behind, in the chosen kit with name and number */}
        <ellipse cx={kicker.x + kicker.w * (shot ? 0.42 : 0.5)} cy={kicker.y + kicker.h - 6} rx="95" ry="16" fill="#000" opacity="0.35" filter="url(#tt-soft-shadow)" />
        <g key={shot ? "shoot" : "ready"} className={shot?.stage === "after" && shot.result === "goal" ? "tt-hop" : ""}>
          <image href={`${ART}/kicker-${shot ? "shoot" : "ready"}-${kit.id}.webp`} x={kicker.x} y={kicker.y} width={kicker.w} height={kicker.h} />
          <g
            transform={`translate(${kicker.x + kicker.shirt.x} ${kicker.y}) rotate(${"rot" in kicker.shirt ? kicker.shirt.rot : 0})`}
            fill={kit.text}
            fontFamily={SPORT}
            textAnchor="middle"
            opacity="0.92"
          >
            <text y={kicker.shirt.name} fontSize="17" fontWeight="700" letterSpacing="1.5">
              {label}
            </text>
            <text y={kicker.shirt.num} fontSize="58" fontWeight="800">
              10
            </text>
          </g>
        </g>

        {/* Ball: across (straight), up (curved), so it flies in an arc. Drawn after the
            kicker so it's never hidden behind him. */}
        {shot?.power && flying
          ? [70, 130].map((lag, n) => (
              <BallPath key={lag} x={ball.x} y={ball.y} scale={ballScale} spin={600} timing={`520ms ${160 + lag}ms`}>
                <circle r="12" fill="#ff9a1f" opacity={n ? 0.25 : 0.45} filter="url(#tt-fire)" />
              </BallPath>
            ))
          : null}
        <BallPath x={ball.x} y={ball.y} scale={ballScale} spin={shot ? 600 : 0} timing={timing}>
          <use href="#tt-ball-art" filter={shot?.power ? "url(#tt-fire)" : undefined} />
        </BallPath>

        {/* Tap where to shoot */}
        {aiming
          ? TARGETS.map((tg, n) => (
              <g key={n} role="button" aria-label={`Shoot ${tg.label}`} onClick={() => onAim(n)} style={{ cursor: "pointer" }}>
                <circle cx={tg.x} cy={tg.y} r="52" fill="transparent" />
                <circle cx={tg.x} cy={tg.y} r="24" fill="none" stroke={GOLD} strokeWidth="4" className="tt-ring" />
                <circle cx={tg.x} cy={tg.y} r="24" fill={GOLD} fillOpacity="0.2" stroke={GOLD} strokeWidth="4" />
                <circle cx={tg.x} cy={tg.y} r="6" fill={GOLD} />
              </g>
            ))
          : null}

        <rect width={W} height={H} fill="url(#tt-vignette)" pointerEvents="none" />
      </svg>

      {/* TV score box */}
      {board ? (
        <div className="font-sport pointer-events-none absolute left-[2.5%] top-[4%] space-y-[2px]">
          {board.map((p) => (
            <div key={p.id} className={`flex items-stretch overflow-hidden rounded-[5px] text-[clamp(13px,1.9vw,20px)] font-bold leading-none shadow-[0_4px_14px_rgba(0,0,0,.35)] ${p.me ? "" : "opacity-90"}`}>
              <span className="w-[5px]" style={{ background: p.colour }} />
              <span className={`w-[7.5em] truncate px-2.5 py-[0.3em] uppercase tracking-wide ${p.me ? "bg-[#0b1d42] text-[#ffc629]" : "bg-[#0b1d42]/90 text-white"}`}>{p.name}</span>
              <span className="min-w-[1.8em] bg-white px-1.5 py-[0.3em] text-center font-extrabold tabular-nums text-[#0b1d42]">{p.goals}</span>
            </div>
          ))}
          {target ? <p className="pl-1 text-[clamp(11px,1.4vw,14px)] font-bold italic text-white drop-shadow">First to {target} goals</p> : null}
        </div>
      ) : (
      <div className="font-sport pointer-events-none absolute left-[2.5%] top-[4%] space-y-1">
        <div className="flex items-stretch overflow-hidden rounded-[5px] text-[clamp(13px,2vw,21px)] font-bold leading-none shadow-[0_4px_14px_rgba(0,0,0,.35)]">
          <span className="w-[5px]" style={{ background: kit.shirt }} />
          <span className="max-w-[13ch] truncate bg-[#0b1d42]/92 px-2.5 py-[0.35em] uppercase tracking-wide text-white">{name}</span>
          <span className="min-w-[1.6em] bg-white px-1.5 py-[0.35em] text-center font-extrabold tabular-nums text-[#0b1d42]">{scored}</span>
          <span className="min-w-[1.6em] border-l border-[#0b1d42]/15 bg-white px-1.5 py-[0.35em] text-center font-extrabold tabular-nums text-[#0b1d42]">
            {goals.length - scored}
          </span>
          <span className="bg-[#0b1d42]/92 px-2.5 py-[0.35em] uppercase tracking-wide text-white">Keeper</span>
          <span className="w-[5px]" style={{ background: KEEPER_KIT }} />
        </div>
        <div className="flex items-center gap-[3px] pl-1">
          {Array.from({ length: kicks }, (_, n) => (
            <span
              key={n}
              className={`block h-[clamp(7px,1vw,10px)] w-[clamp(7px,1vw,10px)] rounded-full ${
                n < goals.length ? (goals[n] ? "bg-[#ffc629]" : "bg-[#e5484d]") : n === goals.length ? "bg-white" : "bg-white/25"
              }`}
            />
          ))}
          {streak >= 2 ? <span className="ml-1.5 rounded-sm bg-[#ffc629] px-1.5 text-[clamp(11px,1.5vw,15px)] font-bold italic text-[#0b1d42]">{streak} in a row</span> : null}
        </div>
      </div>
      )}

      <button
        type="button"
        onClick={onToggleSound}
        className="absolute right-[2.5%] top-[4%] flex h-9 w-9 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur hover:bg-black/50"
        aria-label={sound ? "Turn sound off" : "Turn sound on"}
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" />
          {sound ? <path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" /> : <path d="M17 9l5 6M22 9l-5 6" />}
        </svg>
      </button>

      {/* GOAL! / SAVED — slides in like a TV graphic */}
      {banner ? (
        <div key={banner.key} className="font-sport pointer-events-none absolute inset-x-0 top-[62%] flex flex-col items-center gap-1.5">
          <div className="tt-slide relative overflow-hidden shadow-[0_8px_24px_rgba(0,0,0,.4)]" style={{ transform: "skewX(-12deg)" }}>
            <div
              className={`px-[1em] text-[clamp(32px,6.2vw,68px)] font-extrabold italic leading-[1.08] ${
                banner.tone === "goal" ? "bg-gradient-to-b from-[#ffd95a] to-[#f2b200] text-[#0b1d42]" : "border-l-[0.22em] border-[#e5484d] bg-[#0b1d42] text-white"
              }`}
            >
              <span className="block" style={{ transform: "skewX(12deg)" }}>
                {banner.text}
              </span>
            </div>
            <span className="tt-shine absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/60 to-transparent" />
          </div>
          {banner.sub ? (
            <div className="tt-slide px-[0.9em] py-[0.1em] text-[clamp(14px,2.2vw,22px)] font-bold italic text-white shadow-lg" style={{ background: kit.id === "white" ? NAVY : kit.shirt, transform: "skewX(-12deg)", animationDelay: "120ms" }}>
              <span className="block" style={{ transform: "skewX(12deg)" }}>
                {banner.sub}
              </span>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function BallPath({ x, y, scale, spin, timing, children }: { x: number; y: number; scale: number; spin: number; timing: string | null; children: React.ReactNode }) {
  const size = BALL_R / 13; // the ball art is 26 wide
  return (
    <g style={{ transform: `translateX(${x - REST.x}px)`, transition: timing ? `transform ${timing} linear` : "none" }}>
      <g style={{ transform: `translateY(${y - REST.y}px)`, transition: timing ? `transform ${timing} cubic-bezier(.15,.75,.35,1)` : "none" }}>
        <g style={{ transform: `translate(${REST.x}px, ${REST.y}px) scale(${scale * size}) rotate(${spin}deg)`, transition: timing ? `transform ${timing} ease-out` : "none" }}>
          {children}
        </g>
      </g>
    </g>
  );
}
