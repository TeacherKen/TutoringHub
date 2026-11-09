"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { cluesOf, lineDone, PIC_LEVELS, PICTURES, solved, type Picture, type PicLevel } from "@/lib/games/nonogram";
import { useBest } from "./useBest";

// 🖼️ Picture Logic: the numbers say how many squares in a row (or column) are coloured, in order.
// Colour the right squares and a hidden picture appears. Drag to colour many at once.

type Cell = 0 | 1 | 2; // empty, coloured, crossed out
const secs = (ms: number) => {
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`;
};

function choosePicture(level: PicLevel, last: string | null): Picture {
  const list = PICTURES[level].filter((p) => p.name !== last);
  return list[Math.floor(Math.random() * list.length)];
}

export function PictureLogic() {
  const [level, setLevel] = useState<PicLevel>("small");
  const [phase, setPhase] = useState<"setup" | "play" | "won">("setup");
  const [pic, setPic] = useState<Picture | null>(null);
  const [grid, setGrid] = useState<Cell[][]>([]);
  const [mode, setMode] = useState<1 | 2>(1);
  const [startedAt, setStartedAt] = useState(0);
  const [took, setTook] = useState(0);
  const [newBest, setNewBest] = useState(false);
  const paint = useRef<Cell | null>(null);
  const { best, offer } = useBest(`pl-${level}`, (a, b) => a < b);

  function start(lv = level) {
    const p = choosePicture(lv, pic?.name ?? null);
    const n = p.rows.length;
    setPic(p);
    setGrid(Array.from({ length: n }, () => Array<Cell>(n).fill(0)));
    setStartedAt(Date.now());
    setPhase("play");
  }

  const clues = useMemo(() => (pic ? cluesOf(pic) : null), [pic]);
  // Letting go anywhere (even off the grid) stops colouring.
  useEffect(() => {
    const stop = () => (paint.current = null);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
    return () => {
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
    };
  }, []);
  const filled = grid.map((row) => row.map((v) => v === 1));

  function set(r: number, c: number, v: Cell) {
    setGrid((g) => {
      if (g[r]?.[c] === v) return g;
      const next = g.map((row) => [...row]);
      next[r][c] = v;
      return next;
    });
  }

  // Finished? (Checked after every change.)
  useEffect(() => {
    if (phase !== "play" || !clues || !grid.length) return;
    if (solved(grid.map((row) => row.map((v) => v === 1)), clues)) {
      const t = Date.now() - startedAt;
      const id = setTimeout(() => {
        setTook(t);
        setNewBest(offer(Math.round(t / 1000)));
        setPhase("won");
      }, 250);
      return () => clearTimeout(id);
    }
  }, [grid, phase, clues, startedAt, offer]);

  function cellAt(x: number, y: number): [number, number] | null {
    const el = document.elementFromPoint(x, y) as HTMLElement | null;
    const d = el?.closest<HTMLElement>("[data-cell]")?.dataset.cell;
    if (!d) return null;
    const [r, c] = d.split(",").map(Number);
    return [r, c];
  }

  function down(e: React.PointerEvent) {
    const at = cellAt(e.clientX, e.clientY);
    if (!at) return;
    e.preventDefault();
    const [r, c] = at;
    // Tapping a square that's already this way clears it; the drag then clears too.
    const v: Cell = grid[r][c] === mode ? 0 : mode;
    paint.current = v;
    set(r, c, v);
  }
  function move(e: React.PointerEvent) {
    if (paint.current == null) return;
    const at = cellAt(e.clientX, e.clientY);
    if (at) set(at[0], at[1], paint.current);
  }
  const up = () => (paint.current = null);

  if (phase === "setup")
    return (
      <div className="space-y-4">
        <p className="text-center text-6xl" aria-hidden>
          🖼️
        </p>
        <p className="text-muted">
          The numbers tell you how many squares in a row to colour. <strong>2 1</strong> means: 2 coloured squares together, a gap, then 1 more. Colour the right squares to find the hidden picture!
        </p>
        <div className="grid gap-2">
          {(Object.keys(PIC_LEVELS) as PicLevel[]).map((l) => (
            <button key={l} type="button" aria-pressed={level === l} onClick={() => setLevel(l)} className={`min-h-12 rounded-xl border px-4 text-left ${level === l ? "border-accent bg-accent-soft font-medium text-accent" : "border-line bg-surface"}`}>
              {PIC_LEVELS[l]}
            </button>
          ))}
        </div>
        {best != null ? <p className="text-sm text-muted">Your fastest: {secs(best * 1000)}</p> : null}
        <button type="button" className="btn-primary w-full" onClick={() => start()}>
          Start
        </button>
      </div>
    );

  if (!pic || !clues) return null;
  const n = pic.rows.length;
  const cell = n <= 5 ? "h-12 w-12 sm:h-14 sm:w-14" : "h-9 w-9 sm:h-11 sm:w-11";
  const group = n % 4 === 0 ? 4 : 5; // a darker line every 4 (8 × 8) or 5 squares, to help counting

  if (phase === "won")
    return (
      <div className="space-y-4 text-center">
        <div className="mx-auto inline-grid gap-0.5 rounded-xl bg-white p-2 shadow" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }} aria-hidden>
          {pic.rows.flatMap((row, r) => [...row].map((ch, c) => <span key={`${r}-${c}`} className={n <= 5 ? "h-9 w-9 rounded-sm" : "h-6 w-6 rounded-sm"} style={{ background: ch === "#" ? pic.color : "#f4f4f5" }} />))}
        </div>
        <p className="text-2xl font-semibold">
          It&apos;s a {pic.name}! {pic.emoji}
        </p>
        <p className="text-muted">Solved in {secs(took)}</p>
        {newBest ? <p className="font-medium text-ok">New fastest time! 🏆</p> : best != null ? <p className="text-sm text-muted">Your fastest: {secs(best * 1000)}</p> : null}
        <div className="flex gap-2">
          <button type="button" className="btn-secondary flex-1" onClick={() => setPhase("setup")}>
            Change size
          </button>
          <button type="button" className="btn-primary flex-1" onClick={() => start()}>
            Next picture
          </button>
        </div>
      </div>
    );

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button type="button" aria-pressed={mode === 1} onClick={() => setMode(1)} className={`min-h-12 flex-1 rounded-xl border-2 font-semibold ${mode === 1 ? "border-accent bg-accent-soft text-accent" : "border-line bg-surface"}`}>
          🖌️ Colour
        </button>
        <button type="button" aria-pressed={mode === 2} onClick={() => setMode(2)} className={`min-h-12 flex-1 rounded-xl border-2 font-semibold ${mode === 2 ? "border-accent bg-accent-soft text-accent" : "border-line bg-surface"}`}>
          ✕ Mark empty
        </button>
      </div>

      <div className="overflow-x-auto">
        <div className="mx-auto w-max select-none" style={{ display: "grid", gridTemplateColumns: `auto repeat(${n}, auto)` }}>
          <span />
          {clues.cols.map((clue, c) => (
            <span key={c} className={`flex flex-col items-center justify-end pb-1 text-sm font-semibold leading-tight tabular-nums sm:text-base ${lineDone(filled.map((row) => row[c]), clue) ? "text-muted/40" : "text-ink"}`}>
              {clue.map((k, i) => (
                <span key={i}>{k}</span>
              ))}
            </span>
          ))}
          {grid.map((row, r) => (
            <div key={r} className="contents">
              <span className={`flex items-center justify-end gap-1.5 pr-2 text-sm font-semibold tabular-nums sm:text-base ${lineDone(filled[r], clues.rows[r]) ? "text-muted/40" : "text-ink"}`}>
                {clues.rows[r].map((k, i) => (
                  <span key={i}>{k}</span>
                ))}
              </span>
              {row.map((v, c) => (
                <span
                  key={c}
                  data-cell={`${r},${c}`}
                  onPointerDown={down}
                  onPointerMove={move}
                  onPointerUp={up}
                  onPointerCancel={up}
                  role="button"
                  aria-label={`Row ${r + 1}, column ${c + 1}: ${v === 1 ? "coloured" : v === 2 ? "marked empty" : "empty"}`}
                  className={`${cell} grid touch-none place-items-center border border-[#cbd5e1] text-lg font-bold text-[#94a3b8] ${c % group === group - 1 && c < n - 1 ? "border-r-2 border-r-[#64748b]" : ""} ${r % group === group - 1 && r < n - 1 ? "border-b-2 border-b-[#64748b]" : ""}`}
                  style={{ background: v === 1 ? "#1f2937" : "#ffffff" }}
                >
                  {v === 2 ? "✕" : ""}
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
      <p className="text-center text-sm text-muted">Tap or drag across squares. Numbers turn grey when that line is right.</p>
      <button type="button" className="btn-secondary w-full" onClick={() => setGrid(grid.map((row) => row.map(() => 0 as Cell)))}>
        Start this picture again
      </button>
    </div>
  );
}
