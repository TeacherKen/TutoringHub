// The match scene for Football Times Tables, drawn as one picture (800 × 500) so it scales
// to a phone, an iPad or a Mac: a night stadium, a goal with depth, the keeper, the kicker
// and the ball. The score box, banner and sound button sit on top like TV graphics.

export const TARGETS = [
  { x: 282, y: 210, label: "top left" },
  { x: 518, y: 210, label: "top right" },
  { x: 280, y: 276, label: "bottom left" },
  { x: 520, y: 276, label: "bottom right" },
] as const;

// Where the keeper's feet go and how far he leans to reach each target.
const DIVES = [
  { dx: -62, dy: -28, rot: -62 },
  { dx: 62, dy: -28, rot: 62 },
  { dx: -58, dy: -4, rot: -84 },
  { dx: 58, dy: -4, rot: 84 },
];

const SPOT = { x: 400, y: 412 };
const GOAL_LINE = 300;
const NAVY = "#0b1d42";
const GOLD = "#ffc629";
const SPORT = '"Barlow Condensed", "Avenir Next Condensed", "Arial Narrow", sans-serif';

export type Shot = { target: number; keeper: number; result: "goal" | "saved"; power: boolean; stage: "fly" | "after" };
export type Confetti = { dx: number; dy: number; r: number; c: string; d: number };

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

// A fixed "random" crowd, so it looks the same every time.
function seeded(seed: number) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}
const rand = seeded(11);
const CROWD_COLOURS = ["#c9d4ea", "#e8edf7", "#ffc629", "#c4283a", "#3567c9", "#1d3a73", "#d9662a", "#7f90b3", "#a83a5a", "#2a2f45"];
const CROWD = Array.from({ length: 900 }, () => {
  const y = 10 + rand() * 164;
  return { x: rand() * 800, y, r: 1.8 + (y / 174) * 3.2, c: CROWD_COLOURS[Math.floor(rand() * CROWD_COLOURS.length)], o: 0.22 + rand() * 0.42 };
});
const FLASHES = Array.from({ length: 34 }, () => ({ x: rand() * 800, y: 20 + rand() * 150, d: Math.floor(rand() * 700) }));
// Mowing stripes get thicker towards the camera.
const STRIPES = Array.from({ length: 10 }, (_, k) => 198 + 302 * Math.pow(k / 10, 1.45));

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
}) {
  const t = shot ? TARGETS[shot.target] : null;
  const ball = !shot || !t ? SPOT : shot.stage === "fly" ? t : shot.result === "goal" ? { x: t.x, y: t.y + 10 } : { x: t.x + (t.x < 400 ? 70 : t.x > 400 ? -70 : 55), y: 372 };
  const flying = shot?.stage === "fly";
  const timing = !shot ? null : flying ? "520ms 160ms" : "440ms";
  const shadowY = !shot ? SPOT.y + 4 : shot.result === "saved" && !flying ? 376 : GOAL_LINE - 6;
  const dive = shot ? DIVES[shot.keeper] : { dx: 0, dy: 0, rot: 0 };
  const keeperKit = kit.id === "yellow" ? "#ff5fa2" : "#c6ef3a";
  const kicking = !!shot;
  const scale = !shot ? 1 : flying || shot.result === "goal" ? 0.58 : 0.8;
  const scored = goals.filter(Boolean).length;

  return (
    <div className="relative aspect-[16/10] w-full select-none overflow-hidden rounded-2xl shadow-lg" style={{ background: NAVY, touchAction: "manipulation" }}>
      <svg viewBox="0 0 800 500" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full" role="img" aria-label="Football pitch with a goal, a goalkeeper and the ball on the penalty spot">
        <defs>
          <linearGradient id="tt-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#050c1f" />
            <stop offset="1" stopColor="#183466" />
          </linearGradient>
          <radialGradient id="tt-flood" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#f4f8ff" stopOpacity="0.55" />
            <stop offset="0.35" stopColor="#dce8ff" stopOpacity="0.18" />
            <stop offset="1" stopColor="#dce8ff" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="tt-beam" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.14" />
            <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
          <radialGradient id="tt-lit" cx="0.5" cy="0.35" r="0.65">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.16" />
            <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="tt-vignette" cx="0.5" cy="0.45" r="0.75">
            <stop offset="0.6" stopColor="#000" stopOpacity="0" />
            <stop offset="1" stopColor="#000" stopOpacity="0.45" />
          </radialGradient>
          <radialGradient id="tt-burst" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor={GOLD} stopOpacity="0.7" />
            <stop offset="1" stopColor={GOLD} stopOpacity="0" />
          </radialGradient>
          <linearGradient id="tt-post" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#ffffff" />
            <stop offset="1" stopColor="#c3cddd" />
          </linearGradient>
          <radialGradient id="tt-ball" cx="0.35" cy="0.3" r="0.75">
            <stop offset="0" stopColor="#ffffff" />
            <stop offset="0.7" stopColor="#e3e8f0" />
            <stop offset="1" stopColor="#9aa6b8" />
          </radialGradient>
          <linearGradient id="tt-shine" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.35" />
            <stop offset="0.6" stopColor="#ffffff" stopOpacity="0" />
            <stop offset="1" stopColor="#000000" stopOpacity="0.18" />
          </linearGradient>
          <pattern id="tt-net" width="9" height="9" patternUnits="userSpaceOnUse">
            <path d="M0 0 L9 9 M9 0 L0 9" stroke="#ffffff" strokeOpacity="0.5" strokeWidth="0.7" />
          </pattern>
          <filter id="tt-soft" x="-5%" y="-5%" width="110%" height="110%">
            <feGaussianBlur stdDeviation="1.4" />
          </filter>
          <filter id="tt-led" x="-10%" y="-50%" width="120%" height="200%">
            <feGaussianBlur stdDeviation="1.6" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="tt-fire" x="-100%" y="-100%" width="300%" height="300%">
            <feDropShadow dx="0" dy="0" stdDeviation="5" floodColor="#ff8a00" floodOpacity="1" />
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
            <ellipse cx="-4.5" cy="-5.5" rx="4.5" ry="2.6" fill="#ffffff" opacity="0.7" transform="rotate(-30 -4.5 -5.5)" />
          </g>
        </defs>

        {/* Stand, crowd and floodlights */}
        <rect width="800" height="200" fill="url(#tt-sky)" />
        <g key={`crowd-${cheer}`} className={cheer ? "tt-bounce" : ""} filter="url(#tt-soft)">
          {CROWD.map((p, n) => (
            <circle key={n} cx={p.x} cy={p.y} r={p.r} fill={p.c} opacity={p.o} />
          ))}
        </g>
        <rect y="62" width="800" height="5" fill="#050c1f" opacity="0.7" />
        <rect y="118" width="800" height="5" fill="#050c1f" opacity="0.6" />
        <polygon points="0,0 170,0 420,200 240,200" fill="url(#tt-beam)" />
        <polygon points="800,0 630,0 380,200 560,200" fill="url(#tt-beam)" />
        <circle cx="-30" cy="-50" r="300" fill="url(#tt-flood)" />
        <circle cx="830" cy="-50" r="300" fill="url(#tt-flood)" />
        {cheer ? (
          <g key={`flash-${cheer}`}>
            {FLASHES.map((f, n) => (
              <circle key={n} className="tt-flash" cx={f.x} cy={f.y} r="3.2" fill="#ffffff" style={{ animationDelay: `${f.d}ms` }} />
            ))}
          </g>
        ) : null}

        {/* LED advert boards */}
        <rect y="176" width="800" height="24" fill="#06112b" />
        <rect y="176" width="800" height="1.5" fill="#2b4a86" />
        <g filter="url(#tt-led)" fontFamily={SPORT} fontWeight="800" fontStyle="italic" fontSize="15" letterSpacing="2">
          {[0, 1, 2, 3].map((k) => (
            <text key={k} x={20 + k * 200} y="193" fill={k % 2 ? GOLD : "#7fe0d2"}>
              {k % 2 ? "TIMES TABLES" : "MR KEN FC"}
            </text>
          ))}
        </g>

        {/* Pitch */}
        <rect y="200" width="800" height="300" fill="#2a8a3e" />
        {STRIPES.map((y, k) => (k % 2 ? <rect key={k} y={y} width="800" height={(STRIPES[k + 1] ?? 500) - y} fill="#ffffff" opacity="0.055" /> : null))}
        <rect y="200" width="800" height="300" fill="url(#tt-lit)" />
        <g stroke="#ffffff" strokeOpacity="0.82" fill="none" strokeLinejoin="round">
          <line x1="0" y1={GOAL_LINE} x2="800" y2={GOAL_LINE} strokeWidth="2.2" />
          <polyline points="292,300 284,328 516,328 508,300" strokeWidth="2.4" />
          <polyline points="150,300 86,442 714,442 650,300" strokeWidth="3" />
          <path d="M318 442 Q400 474 482 442" strokeWidth="3" />
        </g>
        <ellipse cx={SPOT.x} cy={SPOT.y + 4} rx="5" ry="2" fill="#ffffff" opacity="0.9" />

        {/* Goal: back net, side nets, then the frame */}
        {cheer ? <circle key={`burst-${cheer}`} className="tt-burst" cx="400" cy="235" r="230" fill="url(#tt-burst)" /> : null}
        <polygon points="228,300 572,300 548,286 252,286" fill="#000" opacity="0.22" />
        <g key={`net-${cheer}`} className={cheer ? "tt-net" : ""} style={{ transformOrigin: "400px 235px" }}>
          <rect x="252" y="166" width="296" height="120" fill="#0a1730" opacity="0.5" />
          <rect x="252" y="166" width="296" height="120" fill="url(#tt-net)" />
          <polygon points="228,178 252,166 252,286 228,300" fill="url(#tt-net)" opacity="0.9" />
          <polygon points="572,178 548,166 548,286 572,300" fill="url(#tt-net)" opacity="0.9" />
          <polygon points="228,178 572,178 548,166 252,166" fill="url(#tt-net)" opacity="0.8" />
          <g stroke="#e8eef8" strokeOpacity="0.75" strokeWidth="2" fill="none">
            <polyline points="252,286 252,166 548,166 548,286" />
            <line x1="228" y1="178" x2="252" y2="166" />
            <line x1="572" y1="178" x2="548" y2="166" />
            <line x1="228" y1="300" x2="252" y2="286" />
            <line x1="572" y1="300" x2="548" y2="286" />
          </g>
        </g>
        <g fill="url(#tt-post)">
          <rect x="222" y="174" width="8" height="128" rx="3" />
          <rect x="570" y="174" width="8" height="128" rx="3" />
          <rect x="222" y="172" width="356" height="8" rx="3" />
        </g>

        {/* Goalkeeper */}
        <g style={{ transform: `translate(${400 + dive.dx}px, ${GOAL_LINE + 2}px) scaleX(${shot ? 1.4 : 1})`, transition: shot ? "transform 380ms 200ms ease-out" : "none" }}>
          <ellipse rx="26" ry="5" fill="#000" opacity="0.3" />
        </g>
        <g style={{ transform: `translate(${400 + dive.dx}px, ${GOAL_LINE + dive.dy}px) rotate(${dive.rot}deg)`, transition: shot ? "transform 380ms 200ms cubic-bezier(.2,.8,.3,1)" : "none" }}>
          <g className={shot ? "" : "tt-keeper"}>
            <Keeper shirt={keeperKit} />
          </g>
        </g>

        {/* Ball shadow stays on the grass */}
        <g style={{ transform: `translate(${ball.x}px, ${shadowY}px) scale(${scale})`, transition: timing ? `transform ${timing} linear` : "none" }}>
          <ellipse rx="14" ry="4" fill="#000" opacity="0.35" />
        </g>

        {/* Ball: across (straight), up (curved) — together it flies in an arc */}
        {shot?.power && flying
          ? [70, 130].map((lag, n) => (
              <BallPath key={lag} x={ball.x} y={ball.y} scale={scale} spin={600} timing={`520ms ${160 + lag}ms`}>
                <circle r="12" fill="#ff9a1f" opacity={n ? 0.25 : 0.45} filter="url(#tt-fire)" />
              </BallPath>
            ))
          : null}
        <BallPath x={ball.x} y={ball.y} scale={scale} spin={shot ? 600 : 0} timing={timing}>
          <use href="#tt-ball-art" filter={shot?.power ? "url(#tt-fire)" : undefined} />
        </BallPath>

        {/* Kicker, seen from behind */}
        <g
          style={{
            transform: `translate(${kicking ? 366 : 338}px, ${kicking ? 470 : 494}px) scale(${kicking ? 0.92 : 1})`,
            transition: kicking ? "transform 190ms ease-in" : "none",
          }}
        >
          <ellipse cy="2" rx="40" ry="8" fill="#000" opacity="0.3" />
          <g className={shot?.stage === "after" && shot.result === "goal" ? "tt-hop" : ""}>
            <Kicker shirt={kit.shirt} text={kit.text} name={name} />
          </g>
        </g>

        {/* Tap where to shoot */}
        {aiming
          ? TARGETS.map((tg, n) => (
              <g key={n} role="button" aria-label={`Shoot ${tg.label}`} onClick={() => onAim(n)} style={{ cursor: "pointer" }}>
                <circle cx={tg.x} cy={tg.y} r="30" fill="transparent" />
                <circle cx={tg.x} cy={tg.y} r="15" fill="none" stroke={GOLD} strokeWidth="2.5" className="tt-ring" />
                <circle cx={tg.x} cy={tg.y} r="15" fill={GOLD} fillOpacity="0.18" stroke={GOLD} strokeWidth="2.5" />
                <circle cx={tg.x} cy={tg.y} r="4" fill={GOLD} />
              </g>
            ))
          : null}

        <rect width="800" height="500" fill="url(#tt-vignette)" pointerEvents="none" />
      </svg>

      {/* TV score box */}
      <div className="font-sport pointer-events-none absolute left-[2.5%] top-[4%] space-y-1">
        <div className="flex items-stretch overflow-hidden rounded-[5px] text-[clamp(13px,2vw,21px)] font-bold leading-none shadow-[0_4px_14px_rgba(0,0,0,.35)]">
          <span className="w-[5px]" style={{ background: kit.shirt }} />
          <span className="max-w-[13ch] truncate bg-[#0b1d42]/92 px-2.5 py-[0.35em] uppercase tracking-wide text-white">{name}</span>
          <span className="min-w-[1.6em] bg-white px-1.5 py-[0.35em] text-center font-extrabold tabular-nums text-[#0b1d42]">{scored}</span>
          <span className="min-w-[1.6em] border-l border-[#0b1d42]/15 bg-white px-1.5 py-[0.35em] text-center font-extrabold tabular-nums text-[#0b1d42]">
            {goals.length - scored}
          </span>
          <span className="bg-[#0b1d42]/92 px-2.5 py-[0.35em] uppercase tracking-wide text-white">Keeper</span>
          <span className="w-[5px]" style={{ background: keeperKit }} />
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
        <div key={banner.key} className="font-sport pointer-events-none absolute inset-x-0 top-[60%] flex flex-col items-center gap-1.5">
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
  return (
    <g style={{ transform: `translateX(${x - SPOT.x}px)`, transition: timing ? `transform ${timing} linear` : "none" }}>
      <g style={{ transform: `translateY(${y - SPOT.y}px)`, transition: timing ? `transform ${timing} cubic-bezier(.15,.75,.35,1)` : "none" }}>
        <g style={{ transform: `translate(${SPOT.x}px, ${SPOT.y}px) scale(${scale}) rotate(${spin}deg)`, transition: timing ? `transform ${timing} ease-out` : "none" }}>{children}</g>
      </g>
    </g>
  );
}

/** The keeper, facing us in a ready crouch. Feet at (0, 0). */
function Keeper({ shirt }: { shirt: string }) {
  const skin = "#b9825a";
  return (
    <g>
      {/* legs: bent knees */}
      <path d="M-9 -46 L-18 -26 L-15 -6" stroke={skin} strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M9 -46 L18 -26 L15 -6" stroke={skin} strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M-18 -24 L-15 -7" stroke="#1d2433" strokeWidth="10.5" strokeLinecap="round" />
      <path d="M18 -24 L15 -7" stroke="#1d2433" strokeWidth="10.5" strokeLinecap="round" />
      <path d="M-23 -4 Q-23 -9 -16 -9 L-10 -9 Q-7 -9 -7 -4 L-7 0 L-23 0Z" fill="#0d111a" />
      <path d="M23 -4 Q23 -9 16 -9 L10 -9 Q7 -9 7 -4 L7 0 L23 0Z" fill="#0d111a" />
      {/* shorts */}
      <path d="M-18 -62 L18 -62 L20 -42 L3 -40 L0 -46 L-3 -40 L-20 -42Z" fill="#1d2433" />
      {/* arms out, ready */}
      <path d="M-20 -90 L-36 -74 L-44 -58" stroke={shirt} strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M20 -90 L36 -74 L44 -58" stroke={shirt} strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      {/* shirt */}
      <path d="M-22 -93 Q0 -100 22 -93 L19 -60 L-19 -60Z" fill={shirt} />
      <path d="M-22 -93 Q0 -100 22 -93 L19 -60 L-19 -60Z" fill="url(#tt-shine)" />
      <path d="M-22 -93 L-19 -60" stroke="#000" strokeOpacity="0.15" strokeWidth="3" />
      <text y="-68" textAnchor="middle" fontFamily={SPORT} fontWeight="800" fontSize="18" fill="#0b1d42" fillOpacity="0.55">
        1
      </text>
      {/* gloves */}
      <g>
        <rect x="-54" y="-66" width="18" height="20" rx="7" fill="#f4f7fc" />
        <rect x="-53" y="-50" width="16" height="5" rx="2" fill="#0b1d42" />
        <rect x="36" y="-66" width="18" height="20" rx="7" fill="#f4f7fc" />
        <rect x="37" y="-50" width="16" height="5" rx="2" fill="#0b1d42" />
      </g>
      {/* head */}
      <rect x="-5" y="-104" width="10" height="9" rx="2" fill={skin} />
      <circle cy="-113" r="11.5" fill={skin} />
      <path d="M-11.5 -114 Q-11 -126 0 -126 Q11 -126 11.5 -114 Q6 -119 0 -119 Q-6 -119 -11.5 -114Z" fill="#1d130c" />
      <circle cy="-113" r="11.5" fill="url(#tt-shine)" />
    </g>
  );
}

/** The kicker, seen from behind, wearing the child's name and number 10. Feet at (0, 0). */
function Kicker({ shirt, text, name }: { shirt: string; text: string; name: string }) {
  const skin = "#a8714a";
  const label = name.toUpperCase().slice(0, 10);
  return (
    <g>
      {/* legs */}
      <path d="M-13 -80 L-17 -14" stroke={skin} strokeWidth="15" strokeLinecap="round" />
      <path d="M13 -80 L19 -14" stroke={skin} strokeWidth="15" strokeLinecap="round" />
      <path d="M-16 -42 L-17 -12" stroke={shirt} strokeWidth="15.5" strokeLinecap="round" />
      <path d="M17 -42 L19 -12" stroke={shirt} strokeWidth="15.5" strokeLinecap="round" />
      <path d="M-16 -42 L-17 -12" stroke="#000" strokeOpacity="0.12" strokeWidth="15.5" strokeLinecap="round" />
      <path d="M-29 -5 Q-29 -14 -20 -14 L-10 -14 Q-6 -14 -6 -6 L-6 0 L-29 0Z" fill="#0d111a" />
      <path d="M29 -5 Q29 -14 20 -14 L10 -14 Q6 -14 6 -6 L6 0 L29 0Z" fill="#0d111a" />
      {/* shorts */}
      <path d="M-26 -100 L26 -100 L28 -72 L3 -70 L0 -78 L-3 -70 L-28 -72Z" fill="#f2f5fa" />
      <path d="M-26 -100 L26 -100 L28 -72 L3 -70 L0 -78 L-3 -70 L-28 -72Z" fill="url(#tt-shine)" />
      {/* arms */}
      <path d="M-34 -134 L-40 -98" stroke={skin} strokeWidth="11" strokeLinecap="round" />
      <path d="M34 -134 L40 -98" stroke={skin} strokeWidth="11" strokeLinecap="round" />
      {/* shirt */}
      <path d="M-30 -158 Q0 -166 30 -158 L40 -131 L31 -126 L30 -96 L-30 -96 L-31 -126 L-40 -131Z" fill={shirt} />
      <path d="M-30 -158 Q0 -166 30 -158 L40 -131 L31 -126 L30 -96 L-30 -96 L-31 -126 L-40 -131Z" fill="url(#tt-shine)" />
      <path d="M-31 -126 L-30 -96 M31 -126 L30 -96" stroke="#000" strokeOpacity="0.14" strokeWidth="2" />
      <text y="-139" textAnchor="middle" fontFamily={SPORT} fontWeight="700" fontSize={label.length > 7 ? 10 : 12} letterSpacing="1" fill={text}>
        {label}
      </text>
      <text y="-102" textAnchor="middle" fontFamily={SPORT} fontWeight="800" fontSize="38" fill={text}>
        10
      </text>
      {/* neck and head (back of head) */}
      <rect x="-7" y="-171" width="14" height="13" rx="3" fill={skin} />
      <ellipse cx="-15" cy="-180" rx="3" ry="5" fill={skin} />
      <ellipse cx="15" cy="-180" rx="3" ry="5" fill={skin} />
      <circle cy="-184" r="15.5" fill="#1d130c" />
      <path d="M-10 -194 Q0 -200 10 -194" stroke="#ffffff" strokeOpacity="0.12" strokeWidth="3" fill="none" strokeLinecap="round" />
    </g>
  );
}
