// The football pitch for Football Times Tables: crowd, goal, goalkeeper, kicker and ball.
// Everything is placed in % of the box so it fits a phone, an iPad or a Mac.

export const TARGETS = [
  { x: 27, y: 19, label: "top left" },
  { x: 73, y: 19, label: "top right" },
  { x: 50, y: 15, label: "top middle" },
  { x: 27, y: 38, label: "bottom left" },
  { x: 73, y: 38, label: "bottom right" },
] as const;

// Where the keeper's feet go and how far he leans, to reach each target.
const DIVES = [
  { dx: -12, dy: -14, rot: -55 },
  { dx: 12, dy: -14, rot: 55 },
  { dx: 0, dy: -11, rot: 0 },
  { dx: -10, dy: 0, rot: -80 },
  { dx: 10, dy: 0, rot: 80 },
];

const SPOT = { x: 50, y: 84 };

export type Shot = { target: number; keeper: number; result: "goal" | "saved"; power: boolean; stage: "fly" | "after" };
export type Confetti = { dx: number; dy: number; r: number; c: string; d: number };

const FANS = Array.from({ length: 84 }, (_, i) => ({
  shirt: ["#ef4444", "#3b82f6", "#facc15", "#ffffff", "#a855f7", "#f97316", "#22c55e"][(i * 7 + (i >> 2)) % 7],
  skin: ["#f1c27d", "#e0ac69", "#c68642", "#8d5524", "#ffdbac"][(i * 3) % 5],
  delay: ((i * 37) % 10) * 45,
}));

export const KITS = [
  { id: "red", shirt: "#dc2626", text: "#ffffff" },
  { id: "blue", shirt: "#2563eb", text: "#ffffff" },
  { id: "yellow", shirt: "#facc15", text: "#1f2937" },
  { id: "purple", shirt: "#7c3aed", text: "#ffffff" },
  { id: "orange", shirt: "#f97316", text: "#ffffff" },
  { id: "sky", shirt: "#38bdf8", text: "#0f172a" },
  { id: "black", shirt: "#111827", text: "#facc15" },
] as const;
export type Kit = (typeof KITS)[number];

export function Stadium({
  shot,
  aiming,
  onAim,
  kit,
  name,
  cheer,
  banner,
  confetti,
}: {
  shot: Shot | null;
  aiming: boolean;
  onAim: (target: number) => void;
  kit: Kit;
  name: string;
  cheer: number; // goes up by one for each goal, to replay the celebration
  banner: { key: number; text: string; tone: "goal" | "saved"; sub?: string } | null;
  confetti: Confetti[];
}) {
  const t = shot ? TARGETS[shot.target] : null;
  const ball = !shot || !t ? SPOT : shot.stage === "fly" ? t : shot.result === "goal" ? { x: t.x, y: t.y + 5 } : { x: t.x + (t.x < 50 ? 13 : t.x > 50 ? -13 : 9), y: 72 };
  const timing = !shot ? null : shot.stage === "fly" ? "520ms 160ms" : "420ms";
  const dive = shot ? DIVES[shot.keeper] : null;
  const keeperKit = kit.id === "yellow" ? "#f472b6" : "#a3e635";
  const kicking = !!shot;

  return (
    <div className="relative aspect-[16/9] w-full select-none overflow-hidden rounded-2xl bg-slate-800 shadow-inner lg:aspect-[4/3]" style={{ touchAction: "manipulation" }}>
      {/* Crowd */}
      <div key={`crowd-${cheer}`} className="absolute inset-x-0 top-0 h-[31%] bg-gradient-to-b from-slate-900 to-slate-700">
        <div className="grid h-full grid-cols-[repeat(21,1fr)] grid-rows-4 gap-x-[0.4%] px-[1%] pt-[1%]">
          {FANS.map((f, i) => (
            <span key={i} className={`flex flex-col items-center justify-end ${cheer ? "tt-cheer" : ""}`} style={{ animationDelay: `${f.delay}ms` }}>
              <span className="block aspect-square w-[45%] rounded-full" style={{ background: f.skin }} />
              <span className="block h-[38%] w-[80%] rounded-t-full" style={{ background: f.shirt }} />
            </span>
          ))}
        </div>
      </div>
      {/* Advert board */}
      <div className="absolute inset-x-0 top-[31%] flex h-[4%] items-center justify-around overflow-hidden bg-white text-[clamp(6px,1.2vw,12px)] font-black tracking-widest text-teal-800">
        <span>MR KEN FC</span>
        <span>⚽</span>
        <span>TIMES TABLES</span>
        <span>⚽</span>
        <span>MR KEN FC</span>
      </div>
      {/* Pitch */}
      <div
        className="absolute inset-x-0 bottom-0 top-[35%]"
        style={{ background: "repeating-linear-gradient(180deg, #16a34a 0 9%, #15803d 9% 18%)" }}
      />
      <div className="absolute left-[6%] right-[6%] top-[46%] h-[47%] border-[3px] border-t-0 border-white/80" />
      <div className="absolute left-[30%] right-[30%] top-[46%] h-[11%] border-[3px] border-t-0 border-white/80" />
      <div className="absolute left-0 right-0 top-[46%] h-[3px] bg-white/80" />
      <div className="absolute left-1/2 top-[84%] h-[2%] w-[1.6%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/90" />

      {/* Goal */}
      <div
        key={`net-${cheer}`}
        className={`absolute left-[16%] right-[16%] top-[9%] h-[37%] rounded-t-sm border-[5px] border-b-0 border-white ${cheer ? "tt-net" : ""}`}
        style={{
          background:
            "repeating-linear-gradient(45deg, rgba(255,255,255,.35) 0 1.5px, transparent 1.5px 11px), repeating-linear-gradient(-45deg, rgba(255,255,255,.35) 0 1.5px, transparent 1.5px 11px), rgba(15,23,42,.35)",
          boxShadow: "0 6px 0 -2px rgba(0,0,0,.15)",
        }}
      />

      {/* Goalkeeper: sways, then dives */}
      <div className="pointer-events-none absolute inset-0" style={{ transform: dive ? `translate(${dive.dx}%, ${dive.dy}%)` : "none", transition: shot ? "transform 380ms 200ms ease-out" : "none" }}>
        <div
          className="absolute left-1/2 top-[20%] h-[26%]"
          style={{ aspectRatio: "0.8", transform: `translateX(-50%) rotate(${dive?.rot ?? 0}deg)`, transformOrigin: "50% 100%", transition: shot ? "transform 380ms 200ms ease-out" : "none" }}
        >
          <div className={`h-full w-full ${shot ? "" : "tt-keeper"}`}>
            <Keeper shirt={keeperKit} />
          </div>
        </div>
      </div>

      {/* Kicker, seen from behind */}
      <div className="pointer-events-none absolute inset-0" style={{ transform: kicking ? "translate(6%, -5%)" : "none", transition: kicking ? "transform 180ms ease-in" : "none" }}>
        <div className={`absolute bottom-[1%] left-[37%] h-[30%] -translate-x-1/2 ${shot?.stage === "after" && shot.result === "goal" ? "tt-hop" : ""}`} style={{ aspectRatio: "0.6" }}>
          <Kicker shirt={kit.shirt} text={kit.text} name={name} />
        </div>
      </div>

      {/* Ball: the outer box moves across, the inner box moves up, so it flies in a curve */}
      <div className="pointer-events-none absolute inset-0" style={{ transform: `translateX(${ball.x - SPOT.x}%)`, transition: timing ? `transform ${timing} linear` : "none" }}>
        <div className="absolute inset-0" style={{ transform: `translateY(${ball.y - SPOT.y}%)`, transition: timing ? `transform ${timing} cubic-bezier(.15,.75,.35,1)` : "none" }}>
          <div
            className="absolute left-1/2 top-[84%] flex aspect-square w-[6.5%] items-center justify-center leading-none"
            style={{
              transform: `translate(-50%, -50%) scale(${shot ? (shot.stage === "fly" || shot.result === "goal" ? 0.6 : 0.8) : 1}) rotate(${shot ? 600 : 0}deg)`,
              transition: shot ? "transform 620ms 160ms ease-out" : "none",
            }}
          >
            <span
              className={`block text-[clamp(18px,4.2vw,44px)] ${shot?.power ? "rounded-full" : ""}`}
              style={shot?.power ? { boxShadow: "0 0 18px 8px rgba(249,115,22,.85)", background: "rgba(249,115,22,.35)" } : undefined}
            >
              ⚽
            </span>
          </div>
        </div>
      </div>

      {/* Tap to aim */}
      {aiming
        ? TARGETS.map((tg, n) => (
            <button
              key={n}
              type="button"
              onClick={() => onAim(n)}
              aria-label={`Shoot ${tg.label}`}
              className="absolute flex aspect-square w-[11%] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full"
              style={{ left: `${tg.x}%`, top: `${tg.y}%` }}
            >
              <span className="absolute inset-0 animate-ping rounded-full bg-yellow-300/40" />
              <span className="relative block h-[70%] w-[70%] rounded-full border-[3px] border-yellow-300 bg-yellow-300/25 shadow-[0_0_10px_rgba(253,224,71,.9)]">
                <span className="absolute left-1/2 top-1/2 h-[30%] w-[30%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-yellow-300" />
              </span>
            </button>
          ))
        : null}

      {/* Confetti */}
      {confetti.length ? (
        <div key={`confetti-${cheer}`} className="pointer-events-none absolute left-1/2 top-[28%]">
          {confetti.map((c, n) => (
            <span
              key={n}
              className="tt-confetti absolute block h-2.5 w-1.5 rounded-sm"
              style={{ background: c.c, animationDelay: `${c.d}ms`, ["--dx" as string]: `${c.dx}px`, ["--dy" as string]: `${c.dy}px`, ["--r" as string]: `${c.r}deg` }}
            />
          ))}
        </div>
      ) : null}

      {/* GOAL! / SAVED! */}
      {banner ? (
        <div key={banner.key} className="pointer-events-none absolute inset-x-0 top-[50%] flex flex-col items-center">
          {banner.sub ? <span className="tt-pop mb-1 rounded-full bg-orange-500 px-3 py-0.5 text-sm font-black text-white shadow sm:text-base">{banner.sub}</span> : null}
          <span
            className={`tt-pop text-[clamp(32px,7vw,72px)] font-black italic tracking-tight ${banner.tone === "goal" ? "text-yellow-300" : "text-white"}`}
            style={{ textShadow: "0 3px 0 rgba(0,0,0,.45), 0 0 24px rgba(0,0,0,.35)", WebkitTextStroke: banner.tone === "goal" ? "1.5px #854d0e" : "1.5px #7f1d1d" }}
          >
            {banner.text}
          </span>
        </div>
      ) : null}
    </div>
  );
}

function Keeper({ shirt }: { shirt: string }) {
  return (
    <svg viewBox="0 0 80 100" className="h-full w-full overflow-visible drop-shadow-md" aria-hidden>
      <line x1="27" y1="36" x2="7" y2="20" stroke={shirt} strokeWidth="8" strokeLinecap="round" />
      <line x1="53" y1="36" x2="73" y2="20" stroke={shirt} strokeWidth="8" strokeLinecap="round" />
      <circle cx="6" cy="17" r="7" fill="#f8fafc" stroke="#64748b" strokeWidth="1.5" />
      <circle cx="74" cy="17" r="7" fill="#f8fafc" stroke="#64748b" strokeWidth="1.5" />
      <rect x="31" y="70" width="8" height="20" rx="3" fill="#e0ac69" />
      <rect x="41" y="70" width="8" height="20" rx="3" fill="#e0ac69" />
      <rect x="30.5" y="80" width="9" height="10" rx="2" fill={shirt} />
      <rect x="40.5" y="80" width="9" height="10" rx="2" fill={shirt} />
      <rect x="28" y="89" width="12" height="6" rx="2.5" fill="#111827" />
      <rect x="40" y="89" width="12" height="6" rx="2.5" fill="#111827" />
      <rect x="27" y="60" width="26" height="14" rx="3" fill="#111827" />
      <rect x="24" y="29" width="32" height="35" rx="7" fill={shirt} />
      <text x="40" y="54" textAnchor="middle" fontSize="15" fontWeight="900" fill="#14532d">
        1
      </text>
      <rect x="36" y="25" width="8" height="6" fill="#e0ac69" />
      <circle cx="40" cy="17" r="10" fill="#e0ac69" />
      <path d="M30 15 Q31 5 40 5 Q49 5 50 15 Q46 10 40 10 Q34 10 30 15Z" fill="#3f2a1d" />
      <circle cx="36.5" cy="17" r="1.4" fill="#111827" />
      <circle cx="43.5" cy="17" r="1.4" fill="#111827" />
      <path d="M36 21.5 Q40 24 44 21.5" stroke="#111827" strokeWidth="1.3" fill="none" strokeLinecap="round" />
    </svg>
  );
}

function Kicker({ shirt, text, name }: { shirt: string; text: string; name: string }) {
  const label = name.toUpperCase().slice(0, 9);
  return (
    <svg viewBox="0 0 60 100" className="h-full w-full overflow-visible drop-shadow-lg" aria-hidden>
      <rect x="18" y="72" width="9" height="20" rx="3" fill="#c68642" />
      <rect x="33" y="72" width="9" height="20" rx="3" fill="#c68642" />
      <rect x="17.5" y="82" width="10" height="11" rx="2" fill={shirt} />
      <rect x="32.5" y="82" width="10" height="11" rx="2" fill={shirt} />
      <rect x="16" y="92" width="13" height="7" rx="3" fill="#111827" />
      <rect x="31" y="92" width="13" height="7" rx="3" fill="#111827" />
      <rect x="15" y="61" width="30" height="16" rx="3" fill="#f8fafc" />
      <rect x="3" y="31" width="8" height="26" rx="4" fill="#c68642" />
      <rect x="49" y="31" width="8" height="26" rx="4" fill="#c68642" />
      <path d="M11 29 Q30 21 49 29 L51 42 L47 43 L47 65 L13 65 L13 43 L9 42 Z" fill={shirt} />
      <text x="30" y="37" textAnchor="middle" fontSize={label.length > 6 ? 5 : 6} fontWeight="800" fill={text} letterSpacing="0.3">
        {label}
      </text>
      <text x="30" y="58" textAnchor="middle" fontSize="18" fontWeight="900" fill={text}>
        10
      </text>
      <rect x="26" y="20" width="8" height="7" fill="#c68642" />
      <circle cx="30" cy="14" r="11" fill="#2b1d14" />
    </svg>
  );
}
