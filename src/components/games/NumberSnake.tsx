"use client";
import { useEffect, useRef, useState } from "react";
import { SNAKE_LEVELS, snakeDone, snakePuzzle, step, type SnakePuzzle, type SnakeSize } from "@/lib/games/numberSnake";
import { ConfettiBurst, makeConfetti, type Confetti } from "./Controls";
import { useBest } from "./useBest";

// 🐍 Number Snake: start at 1 and tap (or drag to) the next square to grow the snake 2, 3, 4 …
// It must pass through the numbers already shown and fill every square. Tap the snake to go back.

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
  const [confetti, setConfetti] = useState<Confetti[]>([]);
  const dragging = useRef(false);
  // The latest snake, so quick drags (many moves before the screen updates) build on it.
  const pathRef = useRef<number[]>([]);
  useEffect(() => {
    pathRef.current = path;
  }, [path]);
  const { best, offer } = useBest(`ns-${size}`, (a, b) => a < b);

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
      setConfetti(makeConfetti(["#84cc16", "#22c55e", "#14b8a6", "#facc15"], 60, 520));
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
        <div className="mx-auto grid w-max grid-cols-3 overflow-hidden rounded-2xl ring-4 ring-[#5b9a4f]" aria-hidden>
          {[1, 2, 3, 6, 5, 4, 7, 8, 9].map((v, i) => (
            <span key={i} className="grid h-14 w-14 place-items-center text-xl font-black text-white [text-shadow:0_1px_2px_rgba(0,0,0,.4)]" style={{ background: `radial-gradient(circle, ${shade(v - 1, 9)} 52%, ${i % 2 ? "#a6d98c" : "#b7e4a0"} 54%)` }}>
              {v}
            </span>
          ))}
        </div>
        <p className="text-muted">
          Start at <strong>1</strong>. Tap the square next to it for <strong>2</strong>, then <strong>3</strong>… The snake goes up, down, left or right — not corner to corner. It must go through the numbers already on the board and fill every square!
        </p>
        <div className="grid gap-2">
          {([4, 5, 6] as SnakeSize[]).map((n) => (
            <button key={n} type="button" aria-pressed={size === n} onClick={() => setSize(n)} className={`min-h-12 rounded-xl border px-4 text-left ${size === n ? "border-accent bg-accent-soft font-medium text-accent" : "border-line bg-surface"}`}>
              {SNAKE_LEVELS[n]}
            </button>
          ))}
        </div>
        {best != null ? <p className="text-sm text-muted">Your fastest: {secs(best * 1000)}</p> : null}
        <button type="button" className="btn-primary w-full" onClick={start}>
          Start
        </button>
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
  const board = (
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
                className="grid place-items-center font-black tabular-nums"
                style={{ fontSize: px * (n === 4 ? 0.34 : 0.36) }}
              >
                {i != null ? (
                  <span className={`text-white [text-shadow:0_0_3px_#1f5a24,0_1px_2px_rgba(0,0,0,.6)] ${isHead ? "pz-anim animate-[tt-pop_.25s_ease-out]" : ""}`}>{i + 1}</span>
                ) : given != null ? (
                  <span className="grid place-items-center rounded-full bg-white text-[#14532d] shadow-[0_3px_0_#d6d3c4]" style={{ width: px * 0.66, height: px * 0.66 }}>
                    {given}
                  </span>
                ) : null}
              </span>
            );
          })}
        </div>
      </div>
  );

  if (phase === "won")
    return (
      <div className="relative space-y-4 text-center">
        <ConfettiBurst pieces={confetti} className="left-1/2 top-24" />
        {board}
        <p className="text-2xl font-semibold">🎉 The snake is complete: 1 to {N}!</p>
        <p className="text-muted">Done in {secs(took)}</p>
        {newBest ? <p className="font-medium text-ok">New fastest time! 🏆</p> : best != null ? <p className="text-sm text-muted">Your fastest: {secs(best * 1000)}</p> : null}
        <div className="flex gap-2">
          <button type="button" className="btn-secondary flex-1" onClick={() => setPhase("setup")}>
            Change size
          </button>
          <button type="button" className="btn-primary flex-1" onClick={start}>
            Next snake
          </button>
        </div>
      </div>
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
            <strong className="text-ok">All done! 🎉</strong>
          )}
        </span>
        <span className="tabular-nums">
          {path.length} of {N} squares
        </span>
      </div>
      {board}
      <p className={`min-h-12 rounded-xl p-3 text-center font-medium ${why ? "bg-danger-soft text-danger" : "text-muted"}`} role="status">
        {why ?? "Tap the snake to go back a step."}
      </p>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" className="btn-secondary" disabled={path.length <= 1} onClick={() => (setPath((q) => q.slice(0, -1)), setWhy(null))}>
          ↩ Back one
        </button>
        <button type="button" className="btn-secondary" disabled={path.length <= 1} onClick={() => (setPath([p.path[0]]), setWhy(null))}>
          Start again
        </button>
      </div>
    </div>
  );
}
