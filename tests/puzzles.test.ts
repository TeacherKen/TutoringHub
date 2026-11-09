import { describe, expect, it } from "vitest";
import { balanceQ, sideWeight, type BalanceLevel } from "@/lib/games/balance";
import { cluesOf, PICTURES, runs, solutionOf, solved } from "@/lib/games/nonogram";
import { apply, makeNumber, MN_LEVELS, type MNLevel } from "@/lib/games/makeNumber";
import { snakePuzzle, snakeDone, step, touching, type SnakeSize } from "@/lib/games/numberSnake";

const seeded = (s: number) => () => ((s = (s * 16807) % 2147483647) / 2147483647);

describe("balance puzzles", () => {
  it("every scale balances and the answer is the asked shape's weight", () => {
    const r = seeded(11);
    for (const level of ["easy", "medium", "hard"] as BalanceLevel[])
      for (let i = 0; i < 400; i++) {
        const q = balanceQ(level, r);
        for (const s of q.scales) expect(sideWeight(s.left, q.values)).toBe(sideWeight(s.right, q.values));
        expect(q.values[q.ask]).toBe(q.answer);
        expect(q.answer).toBeGreaterThan(1);
        for (const s of q.scales) for (const it of [...s.left, ...s.right]) if ("n" in it) expect(it.n).toBeLessThanOrEqual(60);
      }
  });
});

describe("picture logic", () => {
  it("every picture is square and its own answer solves it", () => {
    for (const [level, pics] of Object.entries(PICTURES)) {
      const n = level === "small" ? 5 : 8;
      for (const p of pics) {
        expect(p.rows.length, p.name).toBe(n);
        for (const row of p.rows) expect(row.length, `${p.name}: ${row}`).toBe(n);
        expect(solved(solutionOf(p), cluesOf(p))).toBe(true);
      }
    }
  });
  it("counts runs", () => {
    expect(runs([true, true, false, true])).toEqual([2, 1]);
    expect(runs([false, false])).toEqual([0]);
  });
  it("an empty grid isn't solved", () => {
    const p = PICTURES.small[0];
    expect(solved(p.rows.map((r) => [...r].map(() => false)), cluesOf(p))).toBe(false);
  });
});

describe("make the number", () => {
  it("the saved answer really makes the target, using every card once", () => {
    const r = seeded(5);
    for (const level of ["easy", "medium", "hard"] as MNLevel[])
      for (let i = 0; i < 300; i++) {
        const p = makeNumber(level, r);
        const L = MN_LEVELS[level];
        expect(p.cards.length).toBe(L.cards);
        expect(p.steps.length).toBe(L.cards - 1);
        let pool = [...p.cards];
        for (const s of p.steps) {
          expect(L.ops).toContain(s.op);
          expect(apply(s.a, s.op, s.b)).toBe(s.r);
          for (const v of [s.a, s.b]) {
            const k = pool.indexOf(v);
            expect(k).toBeGreaterThanOrEqual(0);
            pool.splice(k, 1);
          }
          pool = [...pool, s.r];
        }
        expect(pool).toEqual([p.target]);
        expect(p.target).toBeGreaterThanOrEqual(L.lo);
        expect(p.target).toBeLessThanOrEqual(L.hi);
      }
  });
  it("won't go below zero or share unequally", () => {
    expect(apply(3, "−", 5)).toBeNull();
    expect(apply(7, "÷", 2)).toBeNull();
    expect(apply(8, "÷", 2)).toBe(4);
  });
});

describe("number snake", () => {
  it("the hidden path touches square to square and fits the shown numbers", () => {
    const r = seeded(9);
    for (const n of [4, 5, 6] as SnakeSize[])
      for (let i = 0; i < 100; i++) {
        const p = snakePuzzle(n, r);
        expect(new Set(p.path).size).toBe(n * n);
        for (let k = 1; k < p.path.length; k++) expect(touching(p.path[k - 1], p.path[k], n)).toBe(true);
        for (const [cell, num] of p.given) expect(p.path[num - 1]).toBe(cell);
        expect([...p.given.values()]).toContain(1);
        expect([...p.given.values()]).toContain(n * n);
        // Following the hidden path step by step is always allowed and finishes the puzzle.
        let path = [p.path[0]];
        for (const cell of p.path.slice(1)) {
          const res = step(p, path, cell);
          expect(res.ok).toBe(true);
          if (res.ok) path = res.path;
        }
        expect(snakeDone(p, path)).toBe(true);
      }
  });
  it("explains a wrong move", () => {
    const p = snakePuzzle(4, seeded(2));
    const far = [...Array(16).keys()].find((c) => c !== p.path[0] && !touching(p.path[0], c, 4))!;
    const res = step(p, [p.path[0]], far);
    expect(res.ok).toBe(false);
  });
});
