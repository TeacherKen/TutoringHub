// 🖼️ Picture Logic (nonogram): number clues say how many squares in a row are coloured.
// Any grid that matches every clue counts as solved (so a different but correct answer is never "wrong").

export type PicLevel = "small" | "big";
export type Picture = { name: string; emoji: string; color: string; rows: string[] };

export const PIC_LEVELS: Record<PicLevel, string> = { small: "Small 5 × 5 (P2–P3)", big: "Big 8 × 8 (P4–P5)" };

export const PICTURES: Record<PicLevel, Picture[]> = {
  small: [
    { name: "heart", emoji: "❤️", color: "#e11d48", rows: [".#.#.", "#####", "#####", ".###.", "..#.."] },
    { name: "house", emoji: "🏠", color: "#b45309", rows: ["..#..", ".###.", "#####", ".#.#.", ".#.#."] },
    { name: "smiley face", emoji: "😊", color: "#ca8a04", rows: [".....", ".#.#.", ".....", "#...#", ".###."] },
    { name: "tree", emoji: "🌲", color: "#15803d", rows: ["..#..", ".###.", "#####", "..#..", "..#.."] },
    { name: "arrow", emoji: "⬆️", color: "#2563eb", rows: ["..#..", ".###.", "#.#.#", "..#..", "..#.."] },
    { name: "star", emoji: "⭐", color: "#eab308", rows: ["..#..", "#####", ".###.", ".#.#.", "#...#"] },
    { name: "boat", emoji: "⛵", color: "#0369a1", rows: ["..#..", "..##.", "..#..", "#####", ".###."] },
    { name: "cat", emoji: "🐱", color: "#ea580c", rows: ["#...#", "#####", "#.#.#", "#####", ".###."] },
    { name: "plus sign", emoji: "➕", color: "#7c3aed", rows: ["..#..", "..#..", "#####", "..#..", "..#.."] },
    { name: "mushroom", emoji: "🍄", color: "#dc2626", rows: [".###.", "#####", "..#..", "..#..", ".###."] },
  ],
  big: [
    { name: "rocket", emoji: "🚀", color: "#4f46e5", rows: ["...##...", "..####..", "..#..#..", "..####..", "..####..", ".######.", "##.##.##", "#..##..#"] },
    { name: "heart", emoji: "💖", color: "#db2777", rows: [".##..##.", "########", "########", "########", ".######.", "..####..", "...##...", "........"] },
    { name: "apple", emoji: "🍎", color: "#dc2626", rows: ["...#....", "..#.....", ".######.", "########", "########", "########", ".######.", "..####.."] },
    { name: "umbrella", emoji: "☂️", color: "#7c3aed", rows: ["...##...", ".######.", "########", "########", "...##...", "...##...", ".#.##...", "..##...."] },
    { name: "fish", emoji: "🐟", color: "#0284c7", rows: ["........", "...###..", "#.#####.", "#####.##", "#.#####.", "...###..", "........", "........"] },
    { name: "cat", emoji: "🐈", color: "#ea580c", rows: ["#......#", "##....##", "########", "#.####.#", "########", "###..###", ".######.", "..####.."] },
    { name: "Christmas tree", emoji: "🎄", color: "#16a34a", rows: ["...##...", "..####..", ".######.", "..####..", ".######.", "########", "...##...", "...##..."] },
    { name: "sailboat", emoji: "⛵", color: "#0e7490", rows: ["...#....", "...##...", "...###..", "...####.", "...#....", "########", ".######.", "..####.."] },
  ],
};

/** Runs of coloured squares in one line, e.g. [true,true,false,true] → [2, 1]. Empty line → [0]. */
export function runs(line: boolean[]): number[] {
  const out: number[] = [];
  let k = 0;
  for (const v of line) {
    if (v) k++;
    else if (k) {
      out.push(k);
      k = 0;
    }
  }
  if (k) out.push(k);
  return out.length ? out : [0];
}

export function solutionOf(p: Picture): boolean[][] {
  return p.rows.map((row) => [...row].map((ch) => ch === "#"));
}

export function cluesOf(p: Picture) {
  const g = solutionOf(p);
  const n = g.length;
  return { rows: g.map(runs), cols: Array.from({ length: n }, (_, c) => runs(g.map((row) => row[c]))) };
}

const same = (a: number[], b: number[]) => a.length === b.length && a.every((x, i) => x === b[i]);

/** Does this grid match every clue? */
export function solved(filled: boolean[][], clues: { rows: number[][]; cols: number[][] }): boolean {
  const n = filled.length;
  return filled.every((row, r) => same(runs(row), clues.rows[r])) && Array.from({ length: n }, (_, c) => c).every((c) => same(runs(filled.map((row) => row[c])), clues.cols[c]));
}

/** Which rows/columns already match their clue (shown greyed out, as a help). */
export function lineDone(line: boolean[], clue: number[]) {
  return same(runs(line), clue);
}
