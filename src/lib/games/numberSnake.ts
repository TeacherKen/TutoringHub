// 🐍 Number Snake: draw a path 1, 2, 3 … through every square. Each number touches the next one
// (up, down, left or right). Some numbers are already there and the snake must pass through them.

export type SnakeSize = 4 | 5 | 6;
export type SnakePuzzle = { n: SnakeSize; path: number[]; given: Map<number, number> };
type Rand = () => number;

export const SNAKE_LEVELS: Record<SnakeSize, string> = { 4: "Small 4 × 4 (P2–P3)", 5: "Medium 5 × 5 (P3–P4)", 6: "Big 6 × 6 (P5)" };
const CLUES: Record<SnakeSize, number> = { 4: 5, 5: 7, 6: 9 };

export const neighbours = (cell: number, n: number) => {
  const r = Math.floor(cell / n);
  const c = cell % n;
  const out: number[] = [];
  if (r > 0) out.push(cell - n);
  if (r < n - 1) out.push(cell + n);
  if (c > 0) out.push(cell - 1);
  if (c < n - 1) out.push(cell + 1);
  return out;
};
export const touching = (a: number, b: number, n: number) => neighbours(a, n).includes(b);

/** A random path through every square (Warnsdorff: go next to where there are fewest ways on). */
export function snakePath(n: SnakeSize, r: Rand = Math.random): number[] {
  for (;;) {
    const seen = new Set<number>();
    let cur = Math.floor(r() * n * n);
    const path = [cur];
    seen.add(cur);
    while (path.length < n * n) {
      const options = neighbours(cur, n).filter((x) => !seen.has(x));
      if (!options.length) break;
      const ways = (x: number) => neighbours(x, n).filter((y) => !seen.has(y) && y !== x).length;
      const fewest = Math.min(...options.map(ways));
      const best = options.filter((x) => ways(x) === fewest);
      cur = best[Math.floor(r() * best.length)];
      path.push(cur);
      seen.add(cur);
    }
    if (path.length === n * n) return path;
  }
}

/** A puzzle: the path, and the numbers shown at the start (always 1 and the last number). */
export function snakePuzzle(n: SnakeSize, r: Rand = Math.random): SnakePuzzle {
  const path = snakePath(n, r);
  const N = n * n;
  const nums = new Set([1, N]);
  // Spread the other clues out: one from each stretch of the path.
  const extra = CLUES[n];
  for (let k = 0; k < extra; k++) {
    const lo = Math.floor(((k + 0.15) * (N - 2)) / extra) + 2;
    const hi = Math.floor(((k + 0.85) * (N - 2)) / extra) + 2;
    nums.add(Math.min(N - 1, lo + Math.floor(r() * Math.max(1, hi - lo + 1))));
  }
  const given = new Map<number, number>(); // cell → number
  for (const num of nums) given.set(path[num - 1], num);
  return { n, path, given };
}

export type StepResult = { ok: true; path: number[] } | { ok: false; why: string };

/**
 * The child taps a square. Tapping the snake's head goes back one; tapping an earlier square goes back
 * to it; tapping a square next to the head adds the next number (if the shown numbers allow it).
 */
export function step(p: SnakePuzzle, path: number[], cell: number): StepResult {
  const at = path.indexOf(cell);
  if (at >= 0) {
    if (at === path.length - 1) return path.length > 1 ? { ok: true, path: path.slice(0, -1) } : { ok: false, why: "The snake starts at 1." };
    return { ok: true, path: path.slice(0, at + 1) };
  }
  const head = path[path.length - 1];
  if (!touching(head, cell, p.n)) return { ok: false, why: "The next number must touch the last one (up, down, left or right)." };
  const next = path.length + 1;
  const shown = p.given.get(cell);
  if (shown != null && shown !== next) return { ok: false, why: `That square is ${shown}, but the next number is ${next}.` };
  if (shown == null) {
    for (const [c, num] of p.given) if (num === next && c !== cell) return { ok: false, why: `${next} is already on the board. Find it!` };
  }
  return { ok: true, path: [...path, cell] };
}

export const snakeDone = (p: SnakePuzzle, path: number[]) => path.length === p.n * p.n;
