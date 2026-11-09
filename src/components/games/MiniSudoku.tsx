"use client";
import { useEffect, useState } from "react";
import { useBest } from "./useBest";
import { ConfettiBurst, makeConfetti, type Confetti } from "./Controls";
import { THEMES } from "./GameKit";

const T = THEMES.grape;
// Each number has its own colour, so children can spot them quickly.
const NUM_COLOUR = ["", "#e5484d", "#f59e0b", "#30a46c", "#3e63dd", "#8e4ec6", "#d6409f"];

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
  // The puzzle is shuffled only in the browser (not while the page is prepared on the server),
  // so both sides agree and the board doesn't flash and redraw on load.
  const [game, setGame] = useState<Game | null>(null);
  useEffect(() => {
    const id = setTimeout(() => setGame(newGame(4)), 0);
    return () => clearTimeout(id);
  }, []);
  const [sel, setSel] = useState<[number, number] | null>(null);
  const [checked, setChecked] = useState<"no" | "wrong" | "solved">("no");
  const [startedAt, setStartedAt] = useState(now);
  const [time, setTime] = useState<number | null>(null);
  const [confetti, setConfetti] = useState<Confetti[]>([]);
  const { size, grid, start } = game ?? { size: 4 as Size, grid: [] as (number | null)[][], start: [] as (number | null)[][] };
  const { best, offer } = useBest(`sudoku-${size}`, (a, b) => a < b);
  const [br, bc] = BOX[size];
  const isGiven = (r: number, c: number) => start[r][c] != null;

  function reset(nextSize: Size = size) {
    setGame(newGame(nextSize));
    setSel(null);
    setChecked("no");
    setStartedAt(now());
    setTime(null);
    setConfetti([]);
  }

  function place(n: number | null) {
    if (!game || !sel || checked === "solved") return;
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
        setConfetti(makeConfetti(NUM_COLOUR.slice(1), 70, 520));
      } else {
        setChecked("wrong");
      }
    }
  }

  if (!game) return <p className="py-10 text-center text-muted">Shuffling the numbers…</p>;

  const selVal = sel ? grid[sel[0]][sel[1]] : null;
  const sameBox = (r: number, c: number) => sel != null && Math.floor(r / br) === Math.floor(sel[0] / br) && Math.floor(c / bc) === Math.floor(sel[1] / bc);
  return (
    <div className="relative space-y-4">
      <ConfettiBurst pieces={confetti} className="left-1/2 top-40" />
      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-2">
          {([4, 6] as Size[]).map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={size === s}
              onClick={() => reset(s)}
              className={`min-h-11 rounded-xl border-2 px-4 text-sm font-semibold transition ${size === s ? "border-transparent text-white shadow-[0_3px_0_#2e1f66]" : "border-line bg-surface"}`}
              style={size === s ? { background: `linear-gradient(${T.from}, ${T.to})` } : undefined}
            >
              {s} × {s}
            </button>
          ))}
        </div>
        <button type="button" className="btn-secondary min-h-11 text-sm" onClick={() => reset()}>
          🔀 New puzzle
        </button>
      </div>
      <p className="text-sm text-muted">
        Fill the grid so every row, column and box has the numbers 1 to {size} once.
      </p>

      <div className="mx-auto w-full max-w-sm rounded-3xl p-2.5 shadow-[0_8px_24px_rgba(0,0,0,.2)]" style={{ background: `linear-gradient(135deg, ${T.from}, ${T.to})` }}>
      <div
        className="grid w-full overflow-hidden rounded-2xl border-2 border-[#2e1f66] bg-white"
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
                className={`aspect-square border-[#d8d0ee] text-2xl font-bold tabular-nums transition-colors sm:text-3xl ${thickR ? "border-r-[3px] border-r-[#2e1f66]" : "border-r"} ${
                  thickB ? "border-b-[3px] border-b-[#2e1f66]" : "border-b"
                }`}
                style={{
                  background: isSel
                    ? "#ffe9a8"
                    : v != null && v === selVal
                      ? "#fff4cc"
                      : sel && (sel[0] === r || sel[1] === c || sameBox(r, c))
                        ? "#f1ecfb"
                        : given
                          ? "#f6f4fb"
                          : "#ffffff",
                  color: v ? NUM_COLOUR[v] : undefined,
                  boxShadow: isSel ? "inset 0 0 0 3px #f59e0b" : undefined,
                }}
              >
                {v != null ? <span className={given ? "" : "pz-anim inline-block animate-[tt-pop_.25s_ease-out] underline decoration-2 underline-offset-4"}>{v}</span> : ""}
              </button>
            );
          }),
        )}
      </div>
      </div>

      <div className="mx-auto grid max-w-sm gap-2" style={{ gridTemplateColumns: `repeat(${size + 1}, minmax(0, 1fr))` }}>
        {[...Array(size).keys()].map((i) => (
          <button
            key={i}
            type="button"
            className="min-h-14 rounded-2xl text-2xl font-black text-white transition active:translate-y-0.5"
            style={{ background: `linear-gradient(color-mix(in srgb, ${NUM_COLOUR[i + 1]}, #fff 15%), ${NUM_COLOUR[i + 1]})`, boxShadow: `0 4px 0 color-mix(in srgb, ${NUM_COLOUR[i + 1]}, #000 30%)` }}
            onClick={() => place(i + 1)}
          >
            {i + 1}
          </button>
        ))}
        <button type="button" className="btn-secondary min-h-14 px-0 text-lg" onClick={() => place(null)} aria-label="Clear">
          ⌫
        </button>
      </div>

      {checked === "solved" ? (
        <p className="pz-anim animate-[tt-pop_.4s_ease-out] rounded-2xl bg-ok-soft p-4 text-center text-lg font-semibold text-ok">
          🎉 Solved in {time}s!{best != null && time != null && time <= best ? " New best!" : best != null ? ` Best: ${best}s` : ""}
        </p>
      ) : checked === "wrong" ? (
        <p className="pz-anim animate-[pz-shake_.35s] rounded-2xl bg-warn-soft p-3 text-center text-warn">🤔 Almost — something doesn&apos;t fit. Check each row, column and box.</p>
      ) : best != null ? (
        <p className="text-center text-sm text-muted">Your best: {best}s</p>
      ) : null}
    </div>
  );
}
