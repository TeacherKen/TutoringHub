// ⚖️ Balance Puzzles: scales that balance, with mystery shapes. Find what one shape weighs.
// Easy (P2–P3): one scale. Medium (P3–P4): find one shape, then use it. Hard (P5): swap shapes for shapes.

export type Shape = "circle" | "triangle" | "square";
export type Item = { s: Shape } | { n: number };
export type Scale = { left: Item[]; right: Item[] };
export type BalanceLevel = "easy" | "medium" | "hard";
export type BalanceQ = { scales: Scale[]; ask: Shape; answer: number; values: Partial<Record<Shape, number>>; hint: string };
type Rand = () => number;

export const BALANCE_LEVELS: Record<BalanceLevel, string> = {
  easy: "Easy — one scale (P2–P3)",
  medium: "Medium — two scales (P3–P4)",
  hard: "Hard — swap shapes (P5)",
};
export const SHAPES: Shape[] = ["circle", "triangle", "square"];
export const SHAPE_NAME: Record<Shape, string> = { circle: "circle", triangle: "triangle", square: "square" };

const int = (r: Rand, lo: number, hi: number) => lo + Math.floor(r() * (hi - lo + 1));
const pick = <T>(r: Rand, a: readonly T[]): T => a[Math.floor(r() * a.length)];
const S = (s: Shape): Item => ({ s });
const N = (n: number): Item => ({ n });
const rep = (s: Shape, k: number) => Array.from({ length: k }, () => S(s));

/** The weight of one side (null if a shape's weight isn't known). */
export function sideWeight(items: Item[], values: Partial<Record<Shape, number>>): number | null {
  let t = 0;
  for (const it of items) {
    if ("n" in it) t += it.n;
    else if (values[it.s] == null) return null;
    else t += values[it.s]!;
  }
  return t;
}

/** One scale that tells you the weight of shape A (A weighs a). */
function findOne(r: Rand, A: Shape, a: number): Scale {
  const kind = pick(r, a <= 8 ? ["two", "plus", "three", "plus"] : ["two", "plus"]);
  if (kind === "two") return { left: rep(A, 2), right: [N(2 * a)] };
  if (kind === "three") return { left: rep(A, 3), right: [N(3 * a)] };
  const k = int(r, 1, 9);
  return r() < 0.5 ? { left: [S(A), N(k)], right: [N(a + k)] } : { left: [N(a + k)], right: [N(k), S(A)] };
}

export function balanceQ(level: BalanceLevel, r: Rand = Math.random): BalanceQ {
  const [A, B, C] = [...SHAPES].sort(() => r() - 0.5);
  if (level === "easy") {
    const a = int(r, 2, 10);
    const scale = findOne(r, A, a);
    return { scales: [scale], ask: A, answer: a, values: { [A]: a }, hint: "Both sides weigh the same. Take away the same number from both sides, then share what's left equally." };
  }
  if (level === "medium") {
    const a = int(r, 2, 9);
    let b = int(r, 2, 12);
    if (b === a) b = a + 1;
    const second = pick(r, [
      { left: [S(A), S(B)], right: [N(a + b)] },
      { left: [S(A), S(A), S(B)], right: [N(2 * a + b)] },
      { left: [S(B), S(A), N(int(r, 1, 5))], right: [] as Item[] },
    ]);
    if (second.right.length === 0) second.right = [N(sideWeight(second.left, { [A]: a, [B]: b })!)];
    return {
      scales: [findOne(r, A, a), second],
      ask: B,
      answer: b,
      values: { [A]: a, [B]: b },
      hint: `Use the first scale to find the ${SHAPE_NAME[A]}. Then put its weight into the second scale.`,
    };
  }
  // Hard: shapes that weigh the same as other shapes.
  const a = int(r, 2, 6);
  if (r() < 0.5) {
    const k = pick(r, [2, 3]);
    const b = k * a;
    const extra = pick(r, [0, 1, 2]);
    const left = [S(B), ...rep(A, 1 + (extra > 1 ? 1 : 0))];
    const right = [N(sideWeight(left, { [A]: a, [B]: b })!)];
    return {
      scales: [{ left: rep(A, k), right: [S(B)] }, { left, right }],
      ask: A,
      answer: a,
      values: { [A]: a, [B]: b },
      hint: `The first scale says ${k} ${SHAPE_NAME[A]}s weigh the same as 1 ${SHAPE_NAME[B]}. Swap the ${SHAPE_NAME[B]} on the second scale for ${k} ${SHAPE_NAME[A]}s, then share.`,
    };
  }
  // A chain: 2 A = B, 2 B = C, C = number.
  const b = 2 * a;
  const c = 2 * b;
  return {
    scales: [
      { left: rep(A, 2), right: [S(B)] },
      { left: rep(B, 2), right: [S(C)] },
      { left: [S(C)], right: [N(c)] },
    ],
    ask: A,
    answer: a,
    values: { [A]: a, [B]: b, [C]: c },
    hint: `Start at the bottom scale: you know the ${SHAPE_NAME[C]}. Then work back up, one scale at a time.`,
  };
}

/** Stars for one round of 8: fewer wrong answers, more stars. */
export const balanceStars = (wrong: number) => (wrong === 0 ? 3 : wrong <= 2 ? 2 : 1);
