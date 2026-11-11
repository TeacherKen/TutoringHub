"use client";
import { useEffect, useRef, useState } from "react";
import { SNAKE_LEVELS, snakeDone, snakePuzzle, step, type SnakePuzzle, type SnakeSize } from "@/lib/games/numberSnake";
import { useBest } from "./useBest";
import { BigButton, GameHero, HowToPlay, LevelPicker, ResultCard, THEMES } from "./GameKit";

const T = THEMES.snake;

// Number Snake: Sammy the snake is hungry for gems! Start at 1 and tap (or drag to) the next square to
// grow the snake 2, 3, 4 … The numbers already shown sit on gems: the snake must reach each gem on
// exactly that number, and fill every square. Tap the snake to go back.
// (Gems and grass: Kenney "Platformer Pack Remastered"; Sammy: "Animal Pack Remastered". CC0.)

const GEM = ["gemBlue", "gemGreen", "gemYellow", "gemRed"];
const gemOf = (v: number) => `/games/art/gems/${GEM[v % GEM.length]}.png`;

const secs = (ms: number) => {
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`;
};
// From green to blue along the snake.
const shade = (i: number, N: number) => `hsl(${95 + (i / Math.max(1, N - 1)) * 75} 62% ${44 - (i / N) * 8}%)`;

export function NumberSnake() {
  const [size, setSize] = useState<SnakeSize>(4);
  const [phase, setPhase] = useState<"setup" | "play" | "won">("setup");
  const [p, setP] = useState<SnakePuzzle | null>(null);
  const [path, setPath] = useState<number[]>([]);
  const [why, setWhy] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState(0);
  const [took, setTook] = useState(0);
  const [newBest, setNewBest] = useState(false);
  const dragging = useRef(false);
  // The latest snake, so quick drags (many moves before the screen updates) build on it.
  const pathRef = useRef<number[]>([]);
  useEffect(() => {
    pathRef.current = path;
  }, [path]);
  const { best, offer } = useBest(`ns-${size}`, (a, b) => a < b, "s");

  function start() {
    const puzzle = snakePuzzle(size);
    setP(puzzle);
    setPath([puzzle.path[0]]);
    setWhy(null);
    setStartedAt(Date.now());
    setPhase("play");
  }

  useEffect(() => {
    const stop = () => (dragging.current = false);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
    return () => {
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
    };
  }, []);

  function go(cell: number, fromDrag: boolean) {
    if (!p || phase !== "play") return;
    const cur = pathRef.current;
    if (snakeDone(p, cur)) return;
    // While dragging, only move forward (onto new squares next to the head).
    if (fromDrag && cur.includes(cell)) return;
    const res = step(p, cur, cell);
    if (!res.ok) {
      if (!fromDrag) setWhy(res.why);
      return;
    }
    setWhy(null);
    pathRef.current = res.path;
    setPath(res.path);
    if (snakeDone(p, res.path)) {
      const t = Date.now() - startedAt;
      setTook(t);
      setNewBest(offer(Math.round(t / 1000)));
      setTimeout(() => setPhase("won"), 500);
    }
  }

  const cellAt = (x: number, y: number) => {
    const d = (document.elementFromPoint(x, y) as HTMLElement | null)?.closest<HTMLElement>("[data-sq]")?.dataset.sq;
    return d == null ? null : Number(d);
  };

  if (phase === "setup")
    return (
      <div className="space-y-4">
        <GameHero theme={T} art={null} title="NUMBER SNAKE">
          Sammy the snake is hungry for gems! Grow Sammy 1, 2, 3 … through every square and gobble every gem on the way.
        </GameHero>
        <HowToPlay
          theme={T}
          open
          steps={[
            <>Sammy starts on <strong>1</strong>. Tap the square next to Sammy&apos;s head for <strong>2</strong>, then <strong>3</strong>, and so on. You can also drag your finger.</>,
            "Move up, down, left or right. No corner-to-corner jumps!",
            <>A gem with a number (like <strong>7</strong>) must be eaten exactly when Sammy reaches 7.</>,
            "Fill every square on the board to win. Went the wrong way? Tap the snake, or Back one.",
          ]}
        />
        <div className="flex flex-wrap items-center gap-4 rounded-2xl bg-surface-2 p-3">
          <div className="grid w-max shrink-0 grid-cols-3 overflow-hidden rounded-xl ring-4 ring-[#5b9a4f]" aria-hidden>
            {[1, 2, 3, 6, 5, 4, 7, 8, 9].map((v, i) => (
              <span key={i} className="grid h-11 w-11 place-items-center text-lg font-black text-white [text-shadow:0_1px_2px_rgba(0,0,0,.4)]" style={{ background: `radial-gradient(circle, ${shade(v - 1, 9)} 52%, ${i % 2 ? "#a6d98c" : "#b7e4a0"} 54%)` }}>
                {v}
              </span>
            ))}
          </div>
          <p className="min-w-0 flex-1 text-sm text-muted">
            Start at <strong className="text-ink">1</strong> and tap the square next to it for <strong className="text-ink">2</strong>, then <strong className="text-ink">3</strong>… Up, down, left or right, not corner to corner. Go through the numbers already on the board and fill every square!
          </p>
        </div>
        <LevelPicker theme={T} levels={([4, 5, 6] as SnakeSize[]).map((k) => [String(k), SNAKE_LEVELS[k]] as [string, string])} value={String(size)} onChange={(k) => setSize(Number(k) as SnakeSize)} />
        {best != null ? <p className="text-center text-sm text-muted">Your fastest: {secs(best * 1000)}</p> : null}
        <BigButton theme={T} onClick={start}>
          ▶ Start
        </BigButton>
      </div>
    );

  if (!p) return null;
  const n = p.n;
  const N = n * n;
  const at = new Map(path.map((c, i) => [c, i]));
  const next = path.length + 1;
  const px = n === 4 ? 72 : n === 5 ? 60 : 52; // one square, in pixels
  const centre = (c: number) => [(c % n) + 0.5, Math.floor(c / n) + 0.5] as const;
  const head = path[path.length - 1];
  const prev = path.length > 1 ? path[path.length - 2] : null;
  const [hx, hy] = centre(head);
  const dir = prev == null ? [0, 1] : [hx - centre(prev)[0], hy - centre(prev)[1]];
  const pts = path.map((c) => centre(c).join(",")).join(" ");
  const gems = p.given.size;
  const eaten = path.filter((c) => p.given.has(c)).length;
  const board = (
      <div style={{ width: px * n }} className="relative mx-auto">
      <style>{`@keyframes ns-glint{0%,100%{filter:brightness(1)}50%{filter:brightness(1.25)}}@keyframes ns-gulp{0%{transform:scale(.3) rotate(0);opacity:1}100%{transform:scale(1.8) rotate(90deg);opacity:0}}`}</style>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/games/art/garden/bush.png" alt="" aria-hidden className="pointer-events-none absolute -left-9 -top-8 z-10 h-10 w-12 object-contain" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/games/art/garden/plantPurple.png" alt="" aria-hidden className="pointer-events-none absolute -bottom-3 -right-6 z-10 h-10 w-10 object-contain" />
      <div
        className="relative mx-auto touch-none select-none overflow-hidden rounded-3xl shadow-[0_6px_0_#3f7d3a,0_10px_20px_rgba(0,0,0,.18)] ring-4 ring-[#5b9a4f]"
        style={{ width: px * n, height: px * n }}
        onPointerDown={(e) => {
          const c = cellAt(e.clientX, e.clientY);
          if (c == null) return;
          e.preventDefault();
          dragging.current = true;
          go(c, false);
        }}
        onPointerMove={(e) => {
          if (!dragging.current) return;
          const c = cellAt(e.clientX, e.clientY);
          if (c != null) go(c, true);
        }}
      >
        <svg viewBox={`0 0 ${n} ${n}`} className="absolute inset-0 h-full w-full" aria-hidden>
          {/* grass */}
          {Array.from({ length: N }, (_, c) => (
            <rect key={c} x={c % n} y={Math.floor(c / n)} width="1" height="1" fill={((c % n) + Math.floor(c / n)) % 2 === 0 ? "#b7e4a0" : "#a6d98c"} />
          ))}
          {/* little grass tufts */}
          {Array.from({ length: N }, (_, c) =>
            (c * 7 + 3) % 5 === 0 && !p.given.has(c) ? (
              <path key={`t${c}`} d={`M${(c % n) + 0.2} ${Math.floor(c / n) + 0.85} l0.05 -0.14 l0.05 0.14 l0.05 -0.18 l0.05 0.18`} fill="none" stroke="#6fbf57" strokeWidth="0.03" strokeLinejoin="round" />
            ) : null,
          )}
          {/* the snake's body: one smooth tube with a dark outline, a lighter back and spots */}
          {path.length > 1 ? (
            <>
              <polyline points={pts} fill="none" stroke="#1f5a24" strokeWidth="0.7" strokeLinecap="round" strokeLinejoin="round" />
              <polyline points={pts} fill="none" stroke="#4caf50" strokeWidth="0.58" strokeLinecap="round" strokeLinejoin="round" />
              <polyline points={pts} fill="none" stroke="#8be08a" strokeWidth="0.22" strokeLinecap="round" strokeLinejoin="round" opacity=".55" />
            </>
          ) : null}
          {/* spots on every other square, and a pointy tail on square 1 */}
          {path.map((c, i) => {
            if (i === 0 || i === path.length - 1 || i % 2) return null;
            const [x, y] = centre(c);
            return <ellipse key={c} cx={x} cy={y} rx="0.11" ry="0.08" fill="#2e7d32" opacity=".55" />;
          })}
          {(() => {
            const [x, y] = centre(path[0]);
            const toward = path[1] != null ? centre(path[1]) : [x, y + 1];
            const ang = (Math.atan2(toward[1] - y, toward[0] - x) * 180) / Math.PI;
            return path.length > 1 ? (
              <g transform={`translate(${x} ${y}) rotate(${ang})`}>
                <path d="M0.05 -0.29 L-0.42 0 L0.05 0.29Z" fill="#4caf50" stroke="#1f5a24" strokeWidth="0.05" strokeLinejoin="round" />
              </g>
            ) : (
              <circle cx={x} cy={y} r="0.3" fill="#4caf50" stroke="#1f5a24" strokeWidth="0.05" />
            );
          })()}
          {/* head with eyes, looking the way it's going */}
          {phase === "play" ? (
            <g transform={`translate(${hx} ${hy}) rotate(${(Math.atan2(dir[1], dir[0]) * 180) / Math.PI - 90})`}>
              <ellipse cx="0" cy="0.06" rx="0.37" ry="0.42" fill="#43a047" stroke="#1f5a24" strokeWidth="0.05" />
              <ellipse cx="0" cy="0.02" rx="0.18" ry="0.22" fill="#8be08a" opacity=".45" />
              {path.length < N ? <path d="M0 0.42 L0 0.55 M0 0.55 L-0.06 0.62 M0 0.55 L0.06 0.62" stroke="#e11d48" strokeWidth="0.035" strokeLinecap="round" /> : null}
              <circle cx="-0.17" cy="0.26" r="0.08" fill="#fff" />
              <circle cx="0.17" cy="0.26" r="0.08" fill="#fff" />
              <circle cx="-0.17" cy="0.29" r="0.04" fill="#0f172a" />
              <circle cx="0.17" cy="0.29" r="0.04" fill="#0f172a" />
            </g>
          ) : null}
        </svg>
        {/* numbers on top (and the squares you tap) */}
        <div className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${n}, 1fr)`, gridTemplateRows: `repeat(${n}, 1fr)` }}>
          {Array.from({ length: N }, (_, c) => {
            const i = at.get(c);
            const given = p.given.get(c);
            const isHead = i === path.length - 1;
            return (
              <span
                key={c}
                data-sq={c}
                role="button"
                aria-label={i != null ? `Square ${i + 1}` : given != null ? `Square showing ${given}` : "Empty square"}
                className="relative grid place-items-center font-black tabular-nums"
                style={{ fontSize: px * (n === 4 ? 0.34 : 0.36) }}
              >
                {i != null ? (
                  <span className={`text-white [text-shadow:0_0_3px_#1f5a24,0_1px_2px_rgba(0,0,0,.6)] ${isHead ? "pz-anim animate-[tt-pop_.25s_ease-out]" : ""}`}>{i + 1}</span>
                ) : given != null ? (
                  <span className="relative grid place-items-center" style={{ width: px * 0.86, height: px * 0.7 }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={gemOf(given)} alt="" aria-hidden className="absolute inset-0 h-full w-full object-contain drop-shadow-[0_3px_2px_rgba(0,0,0,.3)]" style={{ animation: "ns-glint 2.4s ease-in-out infinite", animationDelay: `${(given % 5) * 0.3}s` }} />
                    <span className="relative text-white [text-shadow:0_0_3px_#0f172a,0_1px_2px_rgba(0,0,0,.7)]">{given}</span>
                  </span>
                ) : null}
                {i != null && given != null && i === path.length - 1 ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src="/games/art/gems/sparkle.png" alt="" aria-hidden className="pointer-events-none absolute h-1/2 w-1/2 object-contain" style={{ animation: "ns-gulp .6s ease-out forwards" }} />
                ) : null}
              </span>
            );
          })}
        </div>
      </div>
      </div>
  );

  if (phase === "won")
    return (
      <ResultCard
        theme={T}
        art={null}
        label={`Sammy ate every gem! 1 to ${N} in`}
        big={secs(took)}
        newBest={newBest}
        bestText={best != null ? `Your fastest: ${secs(best * 1000)}` : undefined}
        onAgain={start}
        againLabel="Next snake"
        onChange={() => setPhase("setup")}
        changeLabel="Change size"
      >
        {board}
      </ResultCard>
    );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm text-muted">
        <span>
          {next <= N ? (
            <>
              Next number: <strong className="text-lg tabular-nums text-ink">{next}</strong>
            </>
          ) : (
            <strong className="text-ok">All done!</strong>
          )}
        </span>
        <span className="flex items-center gap-1.5 tabular-nums">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={gemOf(1)} alt="" aria-hidden className="h-4 w-6 object-contain" />
          {eaten} of {gems} gems · {path.length} of {N} squares
        </span>
      </div>
      {board}
      <p className={`min-h-12 rounded-xl p-3 text-center font-medium ${why ? "bg-danger-soft text-danger" : "text-muted"}`} role="status">
        {why ?? "Tap the snake to go back a step."}
      </p>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" className="btn-secondary" disabled={path.length <= 1} onClick={() => (setPath((q) => q.slice(0, -1)), setWhy(null))}>
          Back one
        </button>
        <button type="button" className="btn-secondary" disabled={path.length <= 1} onClick={() => (setPath([p.path[0]]), setWhy(null))}>
          Start again
        </button>
      </div>
    </div>
  );
}
