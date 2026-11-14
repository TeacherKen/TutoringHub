"use client";
import { useEffect, useState } from "react";
import { useBest } from "./useBest";
import { ConfettiBurst, makeConfetti, type Confetti } from "./Controls";
import { THEMES, Toggle } from "./GameKit";
import { GameLogo } from "./GameLogo";

const T = THEMES.dice;
// Each number has its own colour, so children can spot them quickly.
const NUM_COLOUR = ["", "#e5484d", "#f59e0b", "#30a46c", "#3e63dd", "#8e4ec6", "#d6409f", "#0e9aa7", "#a0522d", "#475569"];

// 4×4 (numbers 1–4), 6×6 (1–6) or the full 9×9 (1–9) sudoku.
type Size = 4 | 6 | 9;
const BOX = { 4: [2, 2], 6: [2, 3], 9: [3, 3] } as const; // [rows, cols] per box
const HOLES = { 4: 9, 6: 20, 9: 42 } as const; // empty squares to fill

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
  const holes = HOLES[size];
  const cells = shuffle([...Array(size * size).keys()]).slice(0, holes);
  const given = solution.map((row) => row.map(() => true));
  cells.forEach((i) => (given[Math.floor(i / size)][i % size] = false));
  return { solution, given };
}

const now = () => Date.now();

type Game = { size: Size; start: (number | null)[][]; grid: (number | null)[][] };

// A puzzle she's halfway through is kept on her device (per size), so closing the game to do
// something else and coming back carries on where she left off. "New puzzle" starts a fresh one.
const SAVE_KEY = "tutoringhub.sudoku";
type Saved = { last: Size; games: Partial<Record<Size, { game: Game; secs: number }>> };
function readSaved(): Saved | null {
  try {
    const v = JSON.parse(localStorage.getItem(SAVE_KEY) ?? "null") as Saved | null;
    return v && typeof v === "object" && v.games ? v : null;
  } catch {
    return null;
  }
}
function writeSaved(fn: (s: Saved) => Saved) {
  try {
    const cur = readSaved() ?? { last: 4, games: {} };
    localStorage.setItem(SAVE_KEY, JSON.stringify(fn(cur)));
  } catch {
    /* private browsing: just don't keep it */
  }
}
function savedGame(size: Size): { game: Game; secs: number } | null {
  const g = readSaved()?.games[size];
  return g && g.game?.size === size && Array.isArray(g.game.grid) && g.game.grid.length === size ? g : null;
}

function newGame(size: Size): Game {
  const { solution, given } = makePuzzle(size);
  const start = solution.map((row, r) => row.map((v, c) => (given[r][c] ? v : null)));
  return { size, start, grid: start.map((row) => [...row]) };
}

export function MiniSudoku() {
  // The puzzle is shuffled only in the browser (not while the page is prepared on the server),
  // so both sides agree and the board doesn't flash and redraw on load.
  const [game, setGame] = useState<Game | null>(null);
  const [startedAt, setStartedAt] = useState(now);
  useEffect(() => {
    const id = setTimeout(() => {
      const last = readSaved()?.last ?? 4;
      const kept = savedGame(last);
      if (kept) {
        setGame(kept.game);
        setStartedAt(now() - kept.secs * 1000);
      } else setGame(newGame(last));
    }, 0);
    return () => clearTimeout(id);
  }, []);
  const [sel, setSel] = useState<[number, number] | null>(null);
  const [checked, setChecked] = useState<"no" | "wrong" | "solved">("no");
  const [time, setTime] = useState<number | null>(null);
  const [confetti, setConfetti] = useState<Confetti[]>([]);
  const { size, grid, start } = game ?? { size: 4 as Size, grid: [] as (number | null)[][], start: [] as (number | null)[][] };
  const { best, offer } = useBest(`sudoku-${size}`, (a, b) => a < b, "s");
  const [br, bc] = BOX[size];
  const isGiven = (r: number, c: number) => start[r][c] != null;

  // Keep the puzzle she's working on (and her time so far) whenever it changes.
  useEffect(() => {
    if (!game) return;
    writeSaved((s) => ({
      last: game.size,
      games: { ...s.games, [game.size]: checked === "solved" ? undefined : { game, secs: Math.round((now() - startedAt) / 1000) } },
    }));
  }, [game, checked, startedAt]);

  /** Switch size: carry on with that size's unfinished puzzle, if there is one. `fresh`: always a new puzzle. */
  function reset(nextSize: Size = size, fresh = true) {
    const kept = fresh ? null : savedGame(nextSize);
    setGame(kept ? kept.game : newGame(nextSize));
    setSel(null);
    setChecked("no");
    setStartedAt(kept ? now() - kept.secs * 1000 : now());
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
      <div className="flex flex-wrap items-center gap-3 rounded-3xl p-3 text-white shadow-[0_8px_24px_rgba(0,0,0,.18)]" style={{ background: `radial-gradient(120% 100% at 30% 0%, ${T.from}, ${T.to} 85%)` }}>
        <span className="w-20 shrink-0 sm:w-28">
          <GameLogo id="sd" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-sport text-2xl font-bold leading-none tracking-wide sm:text-3xl">MINI SUDOKU</span>
          <span className="mt-1 block text-sm opacity-90">Every row, column and box has 1 to {size} once.</span>
        </span>
        <button type="button" className="min-h-11 rounded-xl bg-white/15 px-3 text-sm font-semibold ring-1 ring-white/25 hover:bg-white/25" onClick={() => reset()}>
          New puzzle
        </button>
      </div>
      <Toggle
        theme={T}
        options={[
          ["4", "4 × 4"],
          ["6", "6 × 6"],
          ["9", "9 × 9"],
        ]}
        value={String(size)}
        onChange={(k) => reset(Number(k) as Size, false)}
      />

      <div className={`mx-auto w-full rounded-3xl p-3 shadow-[0_10px_28px_rgba(0,0,0,.28)] ${size === 9 ? "max-w-lg" : "max-w-sm"}`} style={{ background: `radial-gradient(130% 100% at 30% 0%, ${T.from}, ${T.to})`, boxShadow: "inset 0 2px 10px rgba(0,0,0,.35), 0 10px 28px rgba(0,0,0,.25)" }}>
        <div className="grid w-full overflow-hidden rounded-xl border-[3px] border-[#123f2d] bg-[#fffaf0]" style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }} role="grid" aria-label="Sudoku">
          {grid.map((row, r) =>
            row.map((v, c) => {
              const given = isGiven(r, c);
              const isSel = sel?.[0] === r && sel?.[1] === c;
              const thickR = (c + 1) % bc === 0 && c < size - 1;
              const thickB = (r + 1) % br === 0 && r < size - 1;
              const lit = !isSel && sel != null && (sel[0] === r || sel[1] === c || sameBox(r, c));
              const same = !isSel && v != null && v === selVal;
              return (
                <button
                  key={`${r}-${c}`}
                  type="button"
                  role="gridcell"
                  aria-label={`Row ${r + 1} column ${c + 1}${v ? `, ${v}` : ", empty"}`}
                  onClick={() => setSel([r, c])}
                  className={`relative aspect-square border-[#d6e3d8] p-[3px] font-black tabular-nums transition-colors ${size === 9 ? "text-lg sm:text-2xl" : "text-2xl sm:text-3xl"} ${thickR ? "border-r-[3px] border-r-[#123f2d]" : "border-r"} ${thickB ? "border-b-[3px] border-b-[#123f2d]" : "border-b"}`}
                  style={{ background: isSel ? "#ffe9a8" : same ? "#fff1b8" : lit ? "#eaf5ec" : "transparent", boxShadow: isSel ? "inset 0 0 0 3px #f59e0b" : undefined }}
                >
                  {v != null ? (
                    <span
                      className={`grid h-full w-full place-items-center rounded-lg ${given ? "bg-white shadow-[0_2px_0_#c9d6cc,inset_0_0_0_1px_#e3ebe5]" : "pz-anim animate-[tt-pop_.25s_ease-out]"}`}
                      style={{ color: NUM_COLOUR[v] }}
                    >
                      {v}
                    </span>
                  ) : null}
                </button>
              );
            }),
          )}
        </div>
      </div>

      <div className={`mx-auto grid gap-2 ${size === 9 ? "max-w-lg" : "max-w-sm"}`} style={{ gridTemplateColumns: `repeat(${size === 9 ? 5 : size + 1}, minmax(0, 1fr))` }}>
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
          Solved in {time}s!{best != null && time != null && time <= best ? " New best!" : best != null ? ` Best: ${best}s` : ""}
        </p>
      ) : checked === "wrong" ? (
        <p className="pz-anim animate-[pz-shake_.35s] rounded-2xl bg-warn-soft p-3 text-center text-warn">Almost — something doesn&apos;t fit. Check each row, column and box.</p>
      ) : best != null ? (
        <p className="text-center text-sm text-muted">Your best: {best}s</p>
      ) : null}
    </div>
  );
}
