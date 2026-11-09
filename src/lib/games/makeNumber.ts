// 🎯 Make the Number: join number cards with + − × ÷ to make the target. Use every card once.
// Every puzzle is built from a real answer, so it can always be solved.

export type Op = "+" | "−" | "×" | "÷";
export type MNLevel = "easy" | "medium" | "hard";
export type Step = { a: number; op: Op; b: number; r: number };
export type MNPuzzle = { cards: number[]; target: number; steps: Step[] };
type Rand = () => number;

export const MN_LEVELS: Record<MNLevel, { label: string; cards: number; max: number; ops: Op[]; lo: number; hi: number }> = {
  easy: { label: "Easy — 3 cards, + and − (P2–P3)", cards: 3, max: 9, ops: ["+", "−"], lo: 5, hi: 20 },
  medium: { label: "Medium — 4 cards, + − × (P3–P4)", cards: 4, max: 9, ops: ["+", "−", "×"], lo: 10, hi: 60 },
  hard: { label: "Hard — 4 cards, + − × ÷ (P5)", cards: 4, max: 10, ops: ["+", "−", "×", "÷"], lo: 12, hi: 100 },
};

/** a op b, or null if it isn't allowed (below zero, or ÷ that doesn't share equally). */
export function apply(a: number, op: Op, b: number): number | null {
  if (op === "+") return a + b;
  if (op === "−") return a - b >= 0 ? a - b : null;
  if (op === "×") return a * b;
  if (b === 0 || a % b !== 0) return null;
  return a / b;
}

export function makeNumber(level: MNLevel, r: Rand = Math.random): MNPuzzle {
  const L = MN_LEVELS[level];
  for (let tries = 0; tries < 2000; tries++) {
    const cards = Array.from({ length: L.cards }, () => 1 + Math.floor(r() * L.max));
    let pool = [...cards];
    const steps: Step[] = [];
    let ok = true;
    while (pool.length > 1 && ok) {
      const i = Math.floor(r() * pool.length);
      let j = Math.floor(r() * (pool.length - 1));
      if (j >= i) j++;
      let [a, b] = [pool[i], pool[j]];
      const op = L.ops[Math.floor(r() * L.ops.length)];
      if ((op === "−" || op === "÷") && b > a) [a, b] = [b, a];
      const res = apply(a, op, b);
      // No dull steps (× 1, ÷ 1, taking away to nothing) and nothing too big for the level.
      if (res == null || res === 0 || ((op === "×" || op === "÷") && (a === 1 || b === 1)) || res > L.hi * 2) {
        ok = false;
        break;
      }
      steps.push({ a, op, b, r: res });
      pool = pool.filter((_, k) => k !== i && k !== j).concat(res);
    }
    const target = pool[0];
    if (!ok || target < L.lo || target > L.hi || cards.includes(target)) continue;
    // Hard puzzles should really need the harder signs.
    if (level === "hard" && !steps.some((s) => s.op === "÷" || s.op === "×")) continue;
    return { cards, target, steps };
  }
  return { cards: [2, 3, 4].slice(0, L.cards).concat(L.cards > 3 ? [1] : []), target: 10, steps: [] };
}
