"use client";
import { useEffect, useRef, useState } from "react";
import { SNAKE_LEVELS, snakeDone, snakePuzzle, step, type SnakePuzzle, type SnakeSize } from "@/lib/games/numberSnake";
import { useBest } from "./useBest";

// 🐍 Number Snake: start at 1 and tap (or drag to) the next square to grow the snake 2, 3, 4 …
// It must pass through the numbers already shown and fill every square. Tap the snake to go back.

const secs = (ms: number) => {
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`;
};
// From green to blue along the snake.
const shade = (i: number, N: number) => `hsl(${150 + (i / Math.max(1, N - 1)) * 70} 65% ${48 - (i / N) * 8}%)`;

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
        <p className="text-center text-6xl" aria-hidden>
          🐍
        </p>
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
  const sq = n === 4 ? "h-16 w-16 sm:h-[72px] sm:w-[72px] text-2xl" : n === 5 ? "h-14 w-14 sm:h-16 sm:w-16 text-xl" : "h-12 w-12 sm:h-14 sm:w-14 text-lg";
  const pts = path.map((c) => `${((c % n) + 0.5) * (100 / n)},${(Math.floor(c / n) + 0.5) * (100 / n)}`).join(" ");

  if (phase === "won")
    return (
      <div className="space-y-4 text-center">
        <p className="text-6xl" aria-hidden>
          🐍🎉
        </p>
        <p className="text-2xl font-semibold">The snake is complete: 1 to {N}!</p>
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
      <div className="relative mx-auto w-max select-none">
        <div
          className="grid touch-none gap-1 rounded-2xl bg-[#e2e8f0] p-1.5"
          style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}
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
          {Array.from({ length: N }, (_, c) => {
            const i = at.get(c);
            const given = p.given.get(c);
            const head = i === path.length - 1;
            return (
              <span
                key={c}
                data-sq={c}
                role="button"
                aria-label={i != null ? `Square ${i + 1}` : given != null ? `Square showing ${given}` : "Empty square"}
                className={`grid place-items-center rounded-xl font-bold tabular-nums ${sq} ${head ? "ring-4 ring-[#f59e0b]" : ""}`}
                style={{ background: i != null ? shade(i, N) : "#ffffff", color: i != null ? "#ffffff" : given != null ? "#0f172a" : "#94a3b8" }}
              >
                {i != null ? i + 1 : (given ?? "")}
              </span>
            );
          })}
        </div>
        <svg className="pointer-events-none absolute inset-1.5" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
          <polyline points={pts} fill="none" stroke="rgba(255,255,255,.55)" strokeWidth={n === 4 ? 2.2 : 1.6} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" style={{ strokeWidth: 6 }} />
        </svg>
      </div>
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
