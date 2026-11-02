import { describe, expect, it } from "vitest";
import { PICTURES, PIECES, cellsKey, fits, hintFor, isSolved, orientations, pictureCells, solutionsFor, solve } from "@/lib/pentomino";

// 🧩 Shape Builder: the 12 pieces, 9 pictures of 60 squares, stored solutions and hints.

describe("the pieces", () => {
  it("are the 12 pentominoes, all different", () => {
    expect(PIECES).toHaveLength(12);
    for (const p of PIECES) expect(p.cells).toHaveLength(5);
    const keys = new Set(PIECES.flatMap((p) => orientations(p.cells).map(cellsKey)));
    expect(keys.size).toBe(63); // 2+4+8+8+4+8+1+4+8+4+8+4 ways to lie
  });
});

describe("the pictures", () => {
  for (const p of PICTURES) {
    it(`${p.name} has 60 squares and stored solutions that really solve it`, () => {
      expect(pictureCells(p)).toHaveLength(60);
      const sols = solutionsFor(p.id);
      expect(sols.length).toBeGreaterThanOrEqual(2);
      for (const s of sols) expect(isSolved(p, s)).toBe(true);
    });
  }
  it("a different arrangement counts too, not just the stored one", () => {
    const p = PICTURES.find((x) => x.id === "camel")!;
    const fresh = solve(p, [], { budget: 2_000_000 })!;
    expect(isSolved(p, fresh)).toBe(true);
  });
  it("refuses overlaps, gaps and pieces outside", () => {
    const p = PICTURES.find((x) => x.id === "three")!;
    const sol = solutionsFor(p.id)[0];
    expect(isSolved(p, sol.slice(0, 11))).toBe(false);
    const moved = sol.map((x, i) => (i === 0 ? { ...x, cells: x.cells.map(([r, c]) => [r, c + 20] as [number, number]) } : x));
    expect(isSolved(p, moved)).toBe(false);
    expect(fits(p, sol[0].cells, sol.slice(1))).toBe(true);
    expect(fits(p, sol[0].cells, sol)).toBe(false);
  });
});

describe("hints", () => {
  const p = PICTURES.find((x) => x.id === "duck")!;
  it("gives the next piece of a solution that matches what's placed", () => {
    const sol = solutionsFor(p.id)[1];
    const h = hintFor(p.id, sol.slice(0, 3));
    expect(h && "place" in h).toBe(true);
    if (h && "place" in h) expect(isSolved(p, [...sol.filter((s) => s.id !== h.place.id), h.place])).toBe(true);
  });
  it("points at a piece that's in the way when nothing fits any more", () => {
    const sol = solutionsFor(p.id)[0];
    const bad = { ...sol[0], cells: sol[1].cells }; // piece 0 sitting where piece 1 should be
    const h = hintFor(p.id, [bad, ...sol.slice(2)]);
    expect(h).toEqual({ wrong: sol[0].id });
  });
});

import { starsFor } from "@/components/games/ShapeBuilder";
describe("Shape Builder stars", () => {
  it("gives 3 with no hints, 2 with one or two, 1 with more", () => {
    expect([0, 1, 2, 3, 9].map(starsFor)).toEqual([3, 2, 2, 1, 1]);
  });
});
