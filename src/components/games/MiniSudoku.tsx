"use client";
import { useState } from "react";
import { useBest } from "./useBest";

// 4×4 (numbers 1–4) or 6×6 (numbers 1–6) sudoku.
type Size = 4 | 6;
const BOX = { 4: [2, 2], 6: [2, 3] } as const; // [rows, cols] per box

function shuffle<T>(a: T[]): T[] {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

/** Make a full valid grid by shuffling a pattern (rows within bands, bands, cols within stacks, digits). */
export function solvedGrid(size: Size): number[][] {
  const [br, bc] = BOX[size];
  const base = (r: number, c: number) => (bc * (r % br) + Math.floor(r / br) + c) % size;
  const bands = shuffle([...Array(size / br).keys()]);
  const rows = bands.flatMap((b) => shuffle([...Array(br).keys()]).map((r) => b * br + r));
  const stacks = shuffle([...Array(size / bc).keys()]);
  const cols = stacks.flatMap((s) => shuffle([...Array(bc).keys()]).map((c) => s * bc + c));
  const digits = shuffle([...Array(size).keys()].map((d) => d + 1));
  return rows.map((r) => cols.map((c) => digits[base(r, c)]));
}

export function isValidSolution(g: number[][], size: Size): boolean {
  const [br, bc] = BOX[size];
  const ok = (vals: number[]) => new Set(vals).size === size && vals.every((v) => v >= 1 && v <= size);
  for (let i = 0; i < size; i++) {
    if (!ok(g[i])) return false;
    if (!ok(g.map((row) => row[i]))) return false;
  }
  for (let r = 0; r < size; r += br)
    for (let c = 0; c < size; c += bc) {
      const v: number[] = [];
      for (let i = 0; i < br; i++) for (let j = 0; j < bc; j++) v.push(g[r + i][c + j]);
      if (!ok(v)) return false;
    }
  return true;
}

function makePuzzle(size: Size) {
  const solution = solvedGrid(size);
  const holes = size === 4 ? 9 : 20;
  const cells = shuffle([...Array(size * size).keys()]).slice(0, holes);
  const given = solution.map((row) => row.map(() => true));
  cells.forEach((i) => (given[Math.floor(i / size)][i % size] = false));
  return { solution, given };
}

const now = () => Date.now();

type Game = { size: Size; start: (number | null)[][]; grid: (number | null)[][] };

function newGame(size: Size): Game {
  const { solution, given } = makePuzzle(size);
  const start = solution.map((row, r) => row.map((v, c) => (given[r][c] ? v : null)));
  return { size, start, grid: start.map((row) => [...row]) };
}

export function MiniSudoku() {
  const [game, setGame] = useState<Game>(() => newGame(4));
  const [sel, setSel] = useState<[number, number] | null>(null);
  const [checked, setChecked] = useState<"no" | "wrong" | "solved">("no");
  const [startedAt, setStartedAt] = useState(now);
  const [time, setTime] = useState<number | null>(null);
  const { size, grid, start } = game;
  const { best, offer } = useBest(`sudoku-${size}`, (a, b) => a < b);
  const [br, bc] = BOX[size];
  const isGiven = (r: number, c: number) => start[r][c] != null;

  function reset(nextSize: Size = size) {
    setGame(newGame(nextSize));
    setSel(null);
    setChecked("no");
    setStartedAt(now());
    setTime(null);
  }

  function place(n: number | null) {
    if (!sel || checked === "solved") return;
    const [r, c] = sel;
    if (isGiven(r, c)) return;
    const next = grid.map((row) => [...row]);
    next[r][c] = n;
    setGame({ ...game, grid: next });
    setChecked("no");
    if (next.every((row) => row.every((v) => v != null))) {
      if (isValidSolution(next as number[][], size)) {
        const secs = Math.round((now() - startedAt) / 1000);
        setTime(secs);
        setChecked("solved");
        offer(secs);
      } else {
        setChecked("wrong");
      }
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-2">
          {([4, 6] as Size[]).map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={size === s}
              onClick={() => reset(s)}
              className={`min-h-10 rounded-xl border px-3 text-sm ${size === s ? "border-accent bg-accent-soft font-medium text-accent" : "border-line bg-surface"}`}
            >
              {s} × {s}
            </button>
          ))}
        </div>
        <button type="button" className="btn-quiet min-h-10 text-sm" onClick={() => reset()}>
          New puzzle
        </button>
      </div>
      <p className="text-sm text-muted">
        Fill the grid so every row, column and box has the numbers 1 to {size} once.
      </p>

      <div
        className="mx-auto grid w-full max-w-sm overflow-hidden rounded-xl border-2 border-ink"
        style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}
        role="grid"
        aria-label="Sudoku"
      >
        {grid.map((row, r) =>
          row.map((v, c) => {
            const given = isGiven(r, c);
            const isSel = sel?.[0] === r && sel?.[1] === c;
            const thickR = (c + 1) % bc === 0 && c < size - 1;
            const thickB = (r + 1) % br === 0 && r < size - 1;
            return (
              <button
                key={`${r}-${c}`}
                type="button"
                role="gridcell"
                aria-label={`Row ${r + 1} column ${c + 1}${v ? `, ${v}` : ", empty"}`}
                onClick={() => setSel([r, c])}
                className={`aspect-square border-line text-2xl font-semibold tabular-nums sm:text-3xl ${thickR ? "border-r-2 border-r-ink" : "border-r"} ${
                  thickB ? "border-b-2 border-b-ink" : "border-b"
                } ${isSel ? "bg-accent-soft" : "bg-surface"} ${given ? "text-ink" : "text-accent"}`}
              >
                {v ?? ""}
              </button>
            );
          }),
        )}
      </div>

      <div className="mx-auto grid max-w-sm gap-2" style={{ gridTemplateColumns: `repeat(${size + 1}, minmax(0, 1fr))` }}>
        {[...Array(size).keys()].map((i) => (
          <button key={i} type="button" className="btn-secondary min-h-12 px-0 text-xl font-semibold" onClick={() => place(i + 1)}>
            {i + 1}
          </button>
        ))}
        <button type="button" className="btn-secondary min-h-12 px-0 text-sm" onClick={() => place(null)} aria-label="Clear">
          ⌫
        </button>
      </div>

      {checked === "solved" ? (
        <p className="rounded-xl bg-ok-soft p-3 text-center font-medium text-ok">
          Solved in {time}s!{best != null && time != null && time <= best ? " New best!" : best != null ? ` Best: ${best}s` : ""}
        </p>
      ) : checked === "wrong" ? (
        <p className="rounded-xl bg-warn-soft p-3 text-center text-warn">Almost — something doesn&apos;t fit. Check each row, column and box.</p>
      ) : best != null ? (
        <p className="text-center text-sm text-muted">Your best: {best}s</p>
      ) : null}
    </div>
  );
}
