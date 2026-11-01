// 🍕 The fraction games' maths and questions, kept apart from the screens so they can be tested.
// Three games, youngest first: Pizza Fractions (pictures), Fraction Face-off (which is bigger?),
// Fraction Challenge (fractions of amounts, adding, equivalent fractions).

export type Frac = { n: number; d: number };
/** A random number from 0 up to 1 (Math.random, or a fixed list in tests). */
export type Rand = () => number;

const int = (lo: number, hi: number, rnd: Rand) => lo + Math.floor(rnd() * (hi - lo + 1));
const pick = <T>(xs: readonly T[], rnd: Rand): T => xs[Math.floor(rnd() * xs.length)];
function shuffle<T>(xs: T[], rnd: Rand): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : Math.abs(a));
/** 3/4 and 6/8 are the same amount. */
export const sameAmount = (a: Frac, b: Frac) => a.n * b.d === b.n * a.d;
/** 1 if a is bigger, -1 if b is bigger, 0 if they're the same amount. */
export const compareFrac = (a: Frac, b: Frac): -1 | 0 | 1 => Math.sign(a.n * b.d - b.n * a.d) as -1 | 0 | 1;
export const fracText = (f: Frac) => `${f.n}/${f.d}`;

const PARTS = ["", "whole", "half", "third", "quarter", "fifth", "sixth", "seventh", "eighth", "ninth", "tenth", "eleventh", "twelfth"];
/** For screen readers: "3 quarters", "1 half", "5 twelfths". */
export function fracWords(f: Frac): string {
  const part = PARTS[f.d] ?? `${f.d}th`;
  const plural = f.n === 1 ? part : part === "half" ? "halves" : `${part}s`;
  return `${f.n} ${plural}`;
}

/** Different from the last question, so the same one never comes twice in a row. */
function fresh<T>(make: () => T, key: (q: T) => string, prev?: T): T {
  for (let i = 0; i < 20; i++) {
    const q = make();
    if (!prev || key(q) !== key(prev)) return q;
  }
  return make();
}

// ---- 🍕 Pizza Fractions ------------------------------------------------------------------------

export type PizzaLevel = "make" | "name" | "same";
export const PIZZA_LEVELS: Record<PizzaLevel, string> = {
  make: "Make it · tap the slices to show the fraction",
  name: "Name it · which fraction is shaded?",
  same: "Same amount · 3/4 is the same as 6/8",
};
export type Shape = "pie" | "bar";
export type PizzaQ =
  | { kind: "make"; target: Frac; shape: Shape }
  | { kind: "name"; shown: Frac; shaded: number[]; shape: Shape; options: Frac[] }
  | { kind: "same"; from: Frac; to: number };

const pizzaKey = (q: PizzaQ) => (q.kind === "same" ? `s${fracText(q.from)}>${q.to}` : q.kind === "make" ? `m${fracText(q.target)}` : `n${fracText(q.shown)}`);

/** Wrong answers children really give: counting the unshaded part, adding one, shaded over unshaded… */
export function nameOptions(f: Frac, rnd: Rand): Frac[] {
  // Most likely mistakes first; the less likely ones only fill in when those don't work for this fraction.
  const ideas: Frac[] = [
    { n: f.d - f.n, d: f.d }, // counted the empty part
    { n: f.n, d: f.d - f.n }, // shaded over empty
    { n: f.n + 1, d: f.d }, // miscounted
    { n: f.n - 1, d: f.d },
    { n: f.d, d: f.n }, // upside down
    { n: f.n, d: f.d + 1 },
    { n: f.n + 1, d: f.d + 1 },
  ];
  const ok = (x: Frac) => x.n >= 1 && x.d >= 2 && x.n <= 12 && x.d <= 12 && !sameAmount(x, f);
  const wrong: Frac[] = [];
  for (const x of ideas) if (ok(x) && !wrong.some((w) => sameAmount(w, x))) wrong.push(x);
  return shuffle([f, ...shuffle(wrong.slice(0, 4), rnd).slice(0, 3)], rnd);
}

export function pizzaQ(level: PizzaLevel, rnd: Rand = Math.random, prev?: PizzaQ): PizzaQ {
  return fresh(
    (): PizzaQ => {
      if (level === "make") {
        const d = pick([2, 3, 4, 4, 5, 6, 8], rnd);
        return { kind: "make", target: { n: int(1, d - 1, rnd), d }, shape: rnd() < 0.6 ? "pie" : "bar" };
      }
      if (level === "name") {
        const d = pick([2, 3, 4, 5, 6, 8, 10], rnd);
        const n = int(1, d - 1, rnd);
        const shape: Shape = rnd() < 0.6 ? "pie" : "bar";
        // Usually side by side; sometimes scattered, so children learn it's how many, not where.
        const start = int(0, d - 1, rnd);
        const shaded = rnd() < 0.7 ? Array.from({ length: n }, (_, i) => (start + i) % d) : shuffle(Array.from({ length: d }, (_, i) => i), rnd).slice(0, n);
        return { kind: "name", shown: { n, d }, shaded: shaded.sort((a, b) => a - b), shape, options: nameOptions({ n, d }, rnd) };
      }
      const b = pick([2, 3, 4, 5, 6], rnd);
      const k = pick(b * 3 <= 12 ? [2, 3] : [2], rnd);
      return { kind: "same", from: { n: int(1, b - 1, rnd), d: b }, to: b * k };
    },
    pizzaKey,
    prev,
  );
}

/** Is this the right number of slices shaded? (Which slices doesn't matter.) */
export function pizzaRight(q: PizzaQ, shadedCount: number): boolean {
  if (q.kind === "make") return shadedCount === q.target.n;
  if (q.kind === "same") return shadedCount * q.from.d === q.from.n * q.to;
  return false;
}

// ---- ⚔️ Fraction Face-off -----------------------------------------------------------------------

export type FaceLevel = "bottom" | "top" | "mixed";
export const FACE_LEVELS: Record<FaceLevel, string> = {
  bottom: "Same bottom · 2/5 or 4/5?",
  top: "Same top · 1/3 or 1/8?",
  mixed: "Mixed · any two, and some are the same",
};
export type FaceQ = { left: Frac; right: Frac };

export function faceQ(level: FaceLevel, rnd: Rand = Math.random, prev?: FaceQ): FaceQ {
  return fresh(
    (): FaceQ => {
      if (level === "bottom") {
        const d = int(3, 10, rnd);
        const a = int(1, d - 1, rnd);
        let b = int(1, d - 2, rnd);
        if (b >= a) b++;
        return { left: { n: a, d }, right: { n: b, d } };
      }
      if (level === "top") {
        const n = pick([1, 1, 2, 3], rnd);
        const a = int(n + 1, 12, rnd);
        let b = int(n + 1, 11, rnd);
        if (b >= a) b++;
        return { left: { n, d: a }, right: { n, d: b } };
      }
      if (rnd() < 0.2) {
        // The same amount, written two ways.
        const b = int(2, 6, rnd);
        let a = int(1, b - 1, rnd);
        while (gcd(a, b) !== 1) a = int(1, b - 1, rnd);
        const k = pick(b * 3 <= 12 ? [2, 3] : [2], rnd);
        const pair = [
          { n: a, d: b },
          { n: a * k, d: b * k },
        ];
        const [l, r] = rnd() < 0.5 ? pair : pair.reverse();
        return { left: l, right: r };
      }
      for (;;) {
        const d1 = int(2, 12, rnd);
        const d2 = int(2, 12, rnd);
        const l = { n: int(1, d1 - 1, rnd), d: d1 };
        const r = { n: int(1, d2 - 1, rnd), d: d2 };
        if (!sameAmount(l, r)) return { left: l, right: r };
      }
    },
    (q) => `${fracText(q.left)}|${fracText(q.right)}`,
    prev,
  );
}

// ---- 🏆 Fraction Challenge ---------------------------------------------------------------------

export type ChallengeLevel = "unit" | "amount" | "add";
export const CHALLENGE_LEVELS: Record<ChallengeLevel, string> = {
  unit: "Share it · 1/2 of 10, 1/4 of 12",
  amount: "Fractions of amounts · 3/4 of 20",
  add: "Add, take away and equivalent · 2/7 + 3/7",
};
export type ChallengeQ =
  | { kind: "of"; f: Frac; whole: number; answer: number }
  | { kind: "add" | "sub"; a: Frac; b: Frac; answer: number }
  | { kind: "equiv"; from: Frac; d: number; answer: number };

const challengeKey = (q: ChallengeQ) =>
  q.kind === "of" ? `o${fracText(q.f)}*${q.whole}` : q.kind === "equiv" ? `e${fracText(q.from)}>${q.d}` : `${q.kind}${fracText(q.a)}${fracText(q.b)}`;

export function challengeQ(level: ChallengeLevel, rnd: Rand = Math.random, prev?: ChallengeQ): ChallengeQ {
  return fresh(
    (): ChallengeQ => {
      if (level === "unit") {
        const d = pick([2, 2, 3, 4, 5, 10], rnd);
        const k = int(1, Math.max(2, Math.floor(30 / d)), rnd);
        return { kind: "of", f: { n: 1, d }, whole: d * k, answer: k };
      }
      if (level === "amount") {
        const d = int(2, 10, rnd);
        const k = int(2, Math.min(10, Math.floor(100 / d)), rnd);
        const n = int(1, d - 1, rnd);
        return { kind: "of", f: { n, d }, whole: d * k, answer: n * k };
      }
      const kind = pick(["add", "sub", "equiv"] as const, rnd);
      if (kind === "equiv") {
        const b = int(2, 6, rnd);
        let a = int(1, b - 1, rnd);
        while (gcd(a, b) !== 1) a = int(1, b - 1, rnd);
        const k = int(2, Math.min(4, Math.floor(24 / b)), rnd);
        return { kind, from: { n: a, d: b }, d: b * k, answer: a * k };
      }
      const d = int(3, 12, rnd);
      if (kind === "add") {
        const a = int(1, d - 2, rnd);
        const b = int(1, d - 1 - a, rnd);
        return { kind, a: { n: a, d }, b: { n: b, d }, answer: a + b };
      }
      const a = int(2, d - 1, rnd);
      const b = int(1, a - 1, rnd);
      return { kind, a: { n: a, d }, b: { n: b, d }, answer: a - b };
    },
    challengeKey,
    prev,
  );
}

/** A hint after a wrong answer, in words a child can follow. */
export function challengeHint(q: ChallengeQ): string {
  if (q.kind === "of")
    return q.f.n === 1
      ? `Share ${q.whole} into ${q.f.d} equal groups. How many in one group?`
      : `First find ${fracText({ n: 1, d: q.f.d })} of ${q.whole} (share into ${q.f.d} groups), then take ${q.f.n} of those groups.`;
  if (q.kind === "equiv") return `The bottom was multiplied by ${q.d / q.from.d}, so multiply the top by ${q.d / q.from.d} too.`;
  return q.kind === "add" ? "The bottom numbers are the same, so just add the tops." : "The bottom numbers are the same, so just take away the tops.";
}
