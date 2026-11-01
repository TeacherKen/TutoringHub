import { describe, expect, it } from "vitest";
import {
  challengeHint,
  challengeQ,
  compareFrac,
  faceQ,
  fracWords,
  gcd,
  nameOptions,
  pizzaQ,
  pizzaRight,
  sameAmount,
  type ChallengeLevel,
  type FaceLevel,
  type PizzaLevel,
} from "@/lib/fractions";

// 🍕 The fraction games: the maths has to be right every time, for every question the games can make.

/** A repeatable "random" sequence, so failures can be replayed. */
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
}
const RUNS = 3000;

describe("fraction maths", () => {
  it("compares and spots the same amount", () => {
    expect(sameAmount({ n: 3, d: 4 }, { n: 6, d: 8 })).toBe(true);
    expect(sameAmount({ n: 1, d: 3 }, { n: 2, d: 5 })).toBe(false);
    expect(compareFrac({ n: 3, d: 4 }, { n: 2, d: 3 })).toBe(1);
    expect(compareFrac({ n: 1, d: 8 }, { n: 1, d: 3 })).toBe(-1);
    expect(compareFrac({ n: 2, d: 4 }, { n: 1, d: 2 })).toBe(0);
    expect(gcd(12, 8)).toBe(4);
  });
  it("says fractions in words for screen readers", () => {
    expect(fracWords({ n: 3, d: 4 })).toBe("3 quarters");
    expect(fracWords({ n: 1, d: 2 })).toBe("1 half");
    expect(fracWords({ n: 3, d: 2 })).toBe("3 halves");
    expect(fracWords({ n: 5, d: 12 })).toBe("5 twelfths");
  });
});

describe("Pizza Fractions", () => {
  for (const level of ["make", "name", "same"] as PizzaLevel[]) {
    it(`${level}: every question is a proper fraction that fits on the picture`, () => {
      const rnd = seeded(7);
      let prev;
      for (let i = 0; i < RUNS; i++) {
        const q = pizzaQ(level, rnd, prev);
        if (q.kind === "make") {
          expect(q.target.n).toBeGreaterThanOrEqual(1);
          expect(q.target.n).toBeLessThan(q.target.d);
          expect(pizzaRight(q, q.target.n)).toBe(true);
          expect(pizzaRight(q, q.target.n + 1)).toBe(false);
        } else if (q.kind === "name") {
          expect(new Set(q.shaded).size).toBe(q.shown.n);
          expect(q.shaded.every((x) => x >= 0 && x < q.shown.d)).toBe(true);
          // exactly one option is right; the others are really wrong (not 2/4 when the answer is 1/2)
          expect(q.options.filter((o) => sameAmount(o, q.shown))).toHaveLength(1);
          expect(q.options.length).toBeGreaterThanOrEqual(3);
          expect(new Set(q.options.map((o) => `${o.n}/${o.d}`)).size).toBe(q.options.length);
        } else {
          expect(q.to % q.from.d).toBe(0);
          expect(q.to).toBeLessThanOrEqual(12);
          const right = (q.from.n * q.to) / q.from.d;
          expect(pizzaRight(q, right)).toBe(true);
          expect(pizzaRight(q, right - 1)).toBe(false);
        }
        prev = q;
      }
    });
  }
  it("offers the mistakes children really make", () => {
    const opts = nameOptions({ n: 3, d: 4 }, seeded(1)).map((o) => `${o.n}/${o.d}`);
    expect(opts).toContain("3/4");
    expect(opts.length).toBe(4);
  });
});

describe("Fraction Face-off", () => {
  for (const level of ["bottom", "top", "mixed"] as FaceLevel[]) {
    it(`${level}: two proper fractions, the right kind for the level`, () => {
      const rnd = seeded(11);
      let prev;
      let same = 0;
      for (let i = 0; i < RUNS; i++) {
        const q = faceQ(level, rnd, prev);
        for (const f of [q.left, q.right]) {
          expect(f.n).toBeGreaterThanOrEqual(1);
          expect(f.n).toBeLessThan(f.d);
          expect(f.d).toBeLessThanOrEqual(12);
        }
        if (level === "bottom") expect(q.left.d === q.right.d && q.left.n !== q.right.n).toBe(true);
        if (level === "top") expect(q.left.n === q.right.n && q.left.d !== q.right.d).toBe(true);
        if (compareFrac(q.left, q.right) === 0) same++;
        if (prev) expect(`${q.left.n}/${q.left.d}|${q.right.n}/${q.right.d}`).not.toBe(`${prev.left.n}/${prev.left.d}|${prev.right.n}/${prev.right.d}`);
        prev = q;
      }
      // "Same" only on the mixed level, about 1 in 5
      if (level === "mixed") expect(same / RUNS).toBeGreaterThan(0.12);
      else expect(same).toBe(0);
    });
  }
});

describe("Fraction Challenge", () => {
  for (const level of ["unit", "amount", "add"] as ChallengeLevel[]) {
    it(`${level}: whole-number answers that are right`, () => {
      const rnd = seeded(23);
      let prev;
      for (let i = 0; i < RUNS; i++) {
        const q = challengeQ(level, rnd, prev);
        expect(Number.isInteger(q.answer)).toBe(true);
        expect(q.answer).toBeGreaterThan(0);
        if (q.kind === "of") {
          expect(q.whole % q.f.d).toBe(0);
          expect(q.answer).toBe((q.whole / q.f.d) * q.f.n);
          expect(q.whole).toBeLessThanOrEqual(100);
          if (level === "unit") expect(q.f.n).toBe(1);
        } else if (q.kind === "equiv") {
          expect(sameAmount(q.from, { n: q.answer, d: q.d })).toBe(true);
          expect(q.d).toBeGreaterThan(q.from.d);
        } else {
          expect(q.a.d).toBe(q.b.d);
          const sum = q.kind === "add" ? q.a.n + q.b.n : q.a.n - q.b.n;
          expect(q.answer).toBe(sum);
          expect(q.answer).toBeLessThan(q.a.d); // never more than a whole
        }
        expect(challengeHint(q).length).toBeGreaterThan(10);
        prev = q;
      }
    });
  }
});
