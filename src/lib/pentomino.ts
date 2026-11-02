// 🧩 Shape Builder: the 12 pentomino pieces (Mr Ken's page 1), the picture outlines, and a solver.
// Every outline has exactly 60 squares, so all 12 pieces always fit, usually in many ways.
// A puzzle is solved when every outline square is covered: any arrangement counts, not just the model one.

export type Cell = [number, number]; // [row, col]
export type PieceId = "I" | "L" | "Y" | "V" | "P" | "N" | "T" | "U" | "F" | "X" | "W" | "Z";

/** Each piece as drawn on page 1 (colour included), in its upright form. */
export const PIECES: { id: PieceId; name: string; color: string; cells: Cell[] }[] = [
  { id: "I", name: "Long line", color: "#0a9a4e", cells: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]] },
  { id: "L", name: "Big L", color: "#e8173f", cells: [[0, 0], [1, 0], [2, 0], [2, 1], [2, 2]] },
  { id: "Y", name: "Y", color: "#f5c400", cells: [[0, 1], [1, 1], [2, 1], [3, 0], [3, 1]] },
  { id: "T", name: "Long T", color: "#5ad60f", cells: [[0, 1], [1, 0], [1, 1], [1, 2], [1, 3]] },
  { id: "W", name: "Steps", color: "#17c7c0", cells: [[0, 0], [0, 1], [1, 1], [2, 1], [2, 2]] },
  { id: "P", name: "P", color: "#2f66d8", cells: [[0, 0], [0, 1], [1, 0], [1, 1], [2, 0]] },
  { id: "X", name: "Plus", color: "#8e24aa", cells: [[0, 1], [1, 0], [1, 1], [1, 2], [2, 1]] },
  { id: "V", name: "T", color: "#17e0ff", cells: [[0, 0], [0, 1], [0, 2], [1, 1], [2, 1]] },
  { id: "Z", name: "S", color: "#ea3fb6", cells: [[0, 2], [0, 3], [1, 0], [1, 1], [1, 2]] },
  { id: "U", name: "U", color: "#ff6a1a", cells: [[0, 0], [0, 2], [1, 0], [1, 1], [1, 2]] },
  { id: "F", name: "F", color: "#1aa7ef", cells: [[0, 1], [1, 0], [1, 1], [2, 1], [2, 2]] },
  { id: "N", name: "Zigzag", color: "#ff9a26", cells: [[0, 2], [1, 1], [1, 2], [2, 0], [2, 1]] },
];
// Note: the names above are what children see; the ids are the standard pentomino letters where
// they match. "T" here is the 4-long T (page 1, green) and "V" the 3-wide T (page 1, cyan).

export const pieceById = (id: PieceId) => PIECES.find((p) => p.id === id)!;

/** Shift cells so the top-left of their bounding box is (0,0), and sort them. */
export function normalize(cells: Cell[]): Cell[] {
  const r0 = Math.min(...cells.map((c) => c[0]));
  const c0 = Math.min(...cells.map((c) => c[1]));
  return cells.map(([r, c]): Cell => [r - r0, c - c0]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
}
export const rotate = (cells: Cell[]): Cell[] => normalize(cells.map(([r, c]) => [c, -r]));
export const flip = (cells: Cell[]): Cell[] => normalize(cells.map(([r, c]) => [r, -c]));
export const cellsKey = (cells: Cell[]) => normalize(cells).map((c) => c.join(",")).join(";");

/** All different ways a piece can lie (up to 8). */
export function orientations(cells: Cell[]): Cell[][] {
  const out: Cell[][] = [];
  const seen = new Set<string>();
  let cur = normalize(cells);
  for (let f = 0; f < 2; f++) {
    for (let r = 0; r < 4; r++) {
      const k = cellsKey(cur);
      if (!seen.has(k)) {
        seen.add(k);
        out.push(cur);
      }
      cur = rotate(cur);
    }
    cur = flip(cur);
  }
  return out;
}

// ---- Pictures -------------------------------------------------------------------------------
// Drawn as text: '#' is a square of the picture, '.' is empty. Each has exactly 60 squares.

export type Picture = { id: string; name: string; emoji: string; rows: string[] };

export const PICTURES: Picture[] = [
  { id: "bear", name: "Bear", emoji: "🐻", rows: ["##.....##", "####.####", "#########", ".#######.", ".#######.", "..#####..", ".#######.", ".#######.", ".###.###."] },
  { id: "three", name: "Number 3", emoji: "3️⃣", rows: ["######.", "#######", "#..####", "....###", "...####", ".#####.", ".#####.", "...####", "....###", "#..####", "#######", "######."] },
  { id: "hippo", name: "Hippo", emoji: "🦛", rows: ["....####......", "...######.....", ".##########.##", ".#############", "###########...", ".##########...", ".##.....##...."] },
  { id: "duck", name: "Duck", emoji: "🦆", rows: [".........##..", ".........####", "#........##..", "########.##..", "###########..", ".##########..", "..########...", "..#####......", "...##........", "...###.......", ".....##......"] },
  { id: "swan", name: "Swan", emoji: "🦢", rows: ["..##..........", ".####.........", "#####.........", "...##.........", "...##.#####...", "...###########", "...###########", "...##########.", "....########.."] },
  { id: "whale", name: "Whale", emoji: "🐳", rows: [".........####...", "...........#....", "...........#....", "..........###...", "###....#######..", ".#.....#########", ".##############.", ".....##########.", ".....###..###...", "............#..."] },
  { id: "camel", name: "Camel", emoji: "🐪", rows: [".#...........", "####.........", "..##.........", "..###....#...", "..####..###..", "...##########", "....#########", "....#########", ".....########", ".....#......#", ".....#......#", ".....#......#"] },
  { id: "rooster", name: "Rooster", emoji: "🐓", rows: ["........###", ".......####", ".......####", ".......#...", "###....##..", "#########..", "#########..", ".########..", "..######...", "....###....", "....##.....", "....##.....", "....##.....", "....##....."] },
  { id: "giraffe", name: "Giraffe", emoji: "🦒", rows: [".....#.#.", ".....####", "....#####", ".....##..", ".....##..", ".....##..", ".....###.", ".########", "#########", ".########", ".########", ".#.#..#.#", ".#.#....#"] },
];

export const pictureById = (id: string) => PICTURES.find((p) => p.id === id) ?? null;
export const pictureCells = (p: Picture): Cell[] => p.rows.flatMap((row, r) => [...row].flatMap((ch, c): Cell[] => (ch === "#" ? [[r, c]] : [])));
export const pictureSize = (p: Picture) => ({ rows: p.rows.length, cols: Math.max(...p.rows.map((r) => r.length)) });

// ---- Placements and solving ------------------------------------------------------------------

export type Placement = { id: PieceId; cells: Cell[] }; // cells in board coordinates

/** Do these placements cover the picture exactly, with no overlaps and nothing outside? */
export function isSolved(p: Picture, placed: Placement[]): boolean {
  const want = new Set(pictureCells(p).map((c) => c.join(",")));
  const got = new Set<string>();
  let n = 0;
  for (const pl of placed)
    for (const c of pl.cells) {
      const k = c.join(",");
      if (!want.has(k) || got.has(k)) return false;
      got.add(k);
      n++;
    }
  return n === want.size && new Set(placed.map((x) => x.id)).size === PIECES.length;
}

/** Is this placement legal on its own (inside the picture, not on another piece)? */
export function fits(p: Picture, cells: Cell[], others: Placement[]): boolean {
  const want = new Set(pictureCells(p).map((c) => c.join(",")));
  const taken = new Set(others.flatMap((o) => o.cells.map((c) => c.join(","))));
  return cells.every((c) => want.has(c.join(",")) && !taken.has(c.join(",")));
}

/**
 * Find a full solution that keeps `fixed` placements (used for hints). Classic search: always fill the
 * first empty square, trying every piece and orientation that covers it. Fast for 60 squares.
 */
export function solve(p: Picture, fixed: Placement[] = [], opts: { shuffle?: () => number; budget?: number } = {}): Placement[] | null {
  const rnd = opts.shuffle;
  const { rows, cols } = pictureSize(p);
  const board: (PieceId | null | undefined)[][] = Array.from({ length: rows }, (_, r) => Array.from({ length: cols }, (_, c) => (p.rows[r]?.[c] === "#" ? null : undefined)));
  for (const f of fixed) for (const [r, c] of f.cells) board[r][c] = f.id;
  const free = new Set<PieceId>(PIECES.map((x) => x.id).filter((id) => !fixed.some((f) => f.id === id)));
  const shapes = new Map<PieceId, Cell[][]>(PIECES.map((x) => [x.id, orientations(x.cells)]));
  const result: Placement[] = [...fixed];
  let steps = 0;
  const budget = opts.budget ?? 2_000_000;

  function firstEmpty(): Cell | null {
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (board[r][c] === null) return [r, c];
    return null;
  }
  function go(): boolean {
    if (++steps > budget) return false;
    const at = firstEmpty();
    if (!at) return true;
    const [r0, c0] = at;
    const order = [...free];
    if (rnd) order.sort(() => rnd() - 0.5);
    for (const id of order) {
      const list = rnd ? [...shapes.get(id)!].sort(() => rnd() - 0.5) : shapes.get(id)!;
      for (const shape of list) {
        // The piece's top-left-most cell must land on the first empty square (its first cell in reading order).
        const anchor = shape[0];
        const cells: Cell[] = shape.map(([r, c]) => [r - anchor[0] + r0, c - anchor[1] + c0]);
        if (!cells.every(([r, c]) => r >= 0 && c >= 0 && r < rows && c < cols && board[r][c] === null)) continue;
        for (const [r, c] of cells) board[r][c] = id;
        free.delete(id);
        result.push({ id, cells });
        if (go()) return true;
        result.pop();
        free.add(id);
        for (const [r, c] of cells) board[r][c] = null;
      }
    }
    return false;
  }
  return go() ? result : null;
}

// ---- Stored solutions (made once with the solver; hints and Easy/Medium starts come from these) --
import SOLUTIONS from "./pentominoSolutions.json";

/** Every stored solution for a picture, as placements. */
export function solutionsFor(pictureId: string): Placement[][] {
  const list = (SOLUTIONS as Record<string, Record<string, string>[]>)[pictureId] ?? [];
  return list.map((s) => Object.entries(s).map(([id, cells]) => ({ id: id as PieceId, cells: cells.split(";").map((c) => c.split(",").map(Number) as Cell) })));
}

/**
 * A hint: one more piece that fits with what's already placed. Prefers a stored solution that agrees with
 * every placed piece (so the child's own start isn't undone); if none does, says which piece is in the way.
 */
export function hintFor(pictureId: string, placed: Placement[]): { place: Placement } | { wrong: PieceId } | null {
  const sols = solutionsFor(pictureId);
  const same = (a: Cell[], b: Cell[]) => cellsKey(a) === cellsKey(b) && a[0] && b[0] && Math.min(...a.map((c) => c[0])) === Math.min(...b.map((c) => c[0])) && Math.min(...a.map((c) => c[1])) === Math.min(...b.map((c) => c[1]));
  let best: { sol: Placement[]; agree: number } | null = null;
  for (const sol of sols) {
    const agree = placed.filter((p) => sol.some((s) => s.id === p.id && same(s.cells, p.cells))).length;
    if (!best || agree > best.agree) best = { sol, agree };
  }
  if (!best) return null;
  if (best.agree === placed.length) {
    const next = best.sol.find((s) => !placed.some((p) => p.id === s.id));
    return next ? { place: next } : null;
  }
  const wrong = placed.find((p) => !best!.sol.some((s) => s.id === p.id && same(s.cells, p.cells)));
  return wrong ? { wrong: wrong.id } : null;
}
