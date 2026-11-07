import { describe, expect, it } from "vitest";
import { compareWorking, mixed, sameBottoms, simplify, sumWorking } from "@/lib/fractions";

describe("teacher fraction maker", () => {
  it("compares 1/2 and 7/9 the way it's taught", () => {
    expect(sameBottoms({ n: 1, d: 2 }, { n: 7, d: 9 })).toEqual({ common: 18, a2: { n: 9, d: 18 }, b2: { n: 14, d: 18 } });
    const lines = compareWorking({ n: 1, d: 2 }, { n: 7, d: 9 });
    expect(lines).toContain("Now compare the tops: 9 < 14.");
    expect(lines.at(-1)).toBe("7/9 is bigger.");
    expect(compareWorking({ n: 3, d: 4 }, { n: 6, d: 8 }).at(-1)).toMatch(/same amount/);
    expect(compareWorking({ n: 2, d: 5 }, { n: 4, d: 5 })[0]).toMatch(/2 < 4/);
    expect(compareWorking({ n: 1, d: 3 }, { n: 1, d: 8 })[0]).toMatch(/1\/3 has bigger slices/);
  });
  it("adds with the smallest shared bottom, simplifies, and gives wholes", () => {
    const s = sumWorking({ n: 1, d: 2 }, { n: 7, d: 9 });
    expect(s.raw).toEqual({ n: 23, d: 18 });
    expect(s.simple).toEqual({ n: 23, d: 18 });
    expect(s.lines.at(-1)).toBe("23/18 is more than 1 whole: 1 and 5/18.");
    const t = sumWorking({ n: 1, d: 4 }, { n: 1, d: 4 });
    expect(t.simple).toEqual({ n: 1, d: 2 });
    expect(t.lines.join(" ")).toMatch(/Simplify/);
    expect(sumWorking({ n: 1, d: 2 }, { n: 1, d: 2 }).lines.at(-1)).toBe("2/2 = 1 whole.");
    expect(sumWorking({ n: 3, d: 4 }, { n: 1, d: 3 }, "-").raw).toEqual({ n: 5, d: 12 });
    expect(simplify({ n: 6, d: 8 })).toEqual({ n: 3, d: 4 });
    expect(mixed({ n: 23, d: 18 })).toEqual({ whole: 1, part: { n: 5, d: 18 } });
  });
});
