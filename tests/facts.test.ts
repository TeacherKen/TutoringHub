import { describe, expect, it } from "vitest";
import { cleanAnswers, cleanTables, factsFor, level, pickRound, updateFact, type FactState } from "@/lib/facts";

const now = new Date("2026-10-31T10:00:00Z");
let seed = 1;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

describe("remembering each fact", () => {
  it("quick right answers move a fact up; wrong answers send it back to box 1", () => {
    let s = updateFact(undefined, { fact: "3x7", correct: true, ms: 2000 }, now);
    expect(s.box).toBe(2);
    expect(s.due_at).toBe("2026-11-01T10:00:00.000Z"); // tomorrow
    s = updateFact(s, { fact: "3x7", correct: true, ms: 2500 }, now);
    expect(s.box).toBe(3);
    s = updateFact(s, { fact: "3x7", correct: false, ms: 6000 }, now);
    expect(s).toMatchObject({ box: 1, correct: 2, wrong: 1, due_at: now.toISOString() });
  });
  it("a slow right answer keeps the fact where it is", () => {
    const s = updateFact({ fact: "4x8", box: 3, correct: 2, wrong: 0, avg_ms: 3000, due_at: "", last_seen: null }, { fact: "4x8", correct: true, ms: 9000 }, now);
    expect(s.box).toBe(3);
  });
});

describe("choosing the 10 kicks", () => {
  it("puts weak, due facts first and uses only the chosen tables", () => {
    const progress: FactState[] = [
      { fact: "3x7", box: 1, correct: 0, wrong: 3, avg_ms: 8000, due_at: now.toISOString(), last_seen: null },
      { fact: "3x8", box: 5, correct: 9, wrong: 0, avg_ms: 1500, due_at: "2026-12-01T00:00:00Z", last_seen: null },
    ];
    const round = pickRound([3], progress, now, 10, rand);
    expect(round).toHaveLength(10);
    expect(round).toContain("3x7");
    expect(round.every((f) => f.startsWith("3x"))).toBe(true);
    for (let i = 1; i < round.length; i++) expect(round[i]).not.toBe(round[i - 1]);
  });
  it("covers 2× to 10×", () => {
    expect(factsFor([2, 3, 4, 5, 6, 7, 8, 9, 10])).toHaveLength(90);
  });
});

describe("checking what the game sends", () => {
  it("drops anything odd", () => {
    expect(cleanAnswers([{ fact: "3x7", correct: true, ms: 1200 }, { fact: "DROP TABLE", correct: true }, { fact: "99x99", correct: false }])).toEqual([{ fact: "3x7", correct: true, ms: 1200 }]);
    expect(cleanTables([3, "4", 4, 1, 50, 2])).toEqual([2, 3, 4]);
  });
  it("labels facts for the chart", () => {
    expect([level(undefined), level({ box: 1 } as FactState), level({ box: 5 } as FactState)]).toEqual(["new", "weak", "mastered"]);
  });
});
