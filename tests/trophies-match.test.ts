import { describe, expect, it } from "vitest";
import { addRound, newTrophies, roundStars, shelf, statsFrom, trophies, type RoundRow } from "@/lib/trophies";
import { answerFor, factKey, makeQuestion, questionParts, questionWithAnswer, type FactState } from "@/lib/facts";
import { scoreAnswer } from "@/lib/match";

const at = (d: string) => `${d}T10:00:00.000Z`;
const round = (score: number, extra: Partial<RoundRow> = {}): RoundRow => ({ score, total: 10, game: "tt", created_at: at("2026-11-01"), ...extra });
const mastered = (t: number, n: number): FactState => ({ fact: factKey(t, n), box: 5, correct: 6, wrong: 0, avg_ms: 1500, due_at: at("2026-12-01"), last_seen: at("2026-11-01") });

describe("stars", () => {
  it("gives practice stars by score and match stars for winning or playing", () => {
    expect([10, 9, 8, 7, 6, 5, 4].map((s) => roundStars(round(s)))).toEqual([3, 3, 2, 2, 1, 1, 0]);
    expect(roundStars({ score: 10, game: "match", won: true })).toBe(3);
    expect(roundStars({ score: 4, game: "match", won: false })).toBe(1);
  });
});

describe("trophies", () => {
  it("starts with nothing won", () => {
    expect(trophies(statsFrom([], [])).filter((t) => t.got)).toEqual([]);
  });

  it("works out kick-off, perfect, on fire, stars and days", () => {
    const rounds = [round(10, { best_streak: 6, powers: 7, created_at: at("2026-11-01") }), round(8, { powers: 4, created_at: at("2026-11-02") })];
    const won = new Set(trophies(statsFrom(rounds, [])).filter((t) => t.got).map((t) => t.id));
    expect(won).toEqual(new Set(["first", "perfect", "fire", "power10"]));
    const s = statsFrom(rounds, []);
    expect(s.stars).toBe(5);
    expect(s.dayKeys).toEqual(["2026-11-01", "2026-11-02"]);
  });

  it("counts Bangkok days, not UTC days", () => {
    // 20:00 UTC on 1 Nov is 03:00 on 2 Nov in Bangkok.
    const s = statsFrom([round(5, { created_at: "2026-11-01T20:00:00.000Z" }), round(5, { created_at: "2026-11-02T03:00:00.000Z" })], []);
    expect(s.dayKeys).toEqual(["2026-11-02"]);
  });

  it("gives a table trophy only when all ten facts are known really well", () => {
    const nine = Array.from({ length: 9 }, (_, i) => mastered(3, i + 1));
    expect(trophies(statsFrom([round(5)], nine)).find((t) => t.id === "table3")).toMatchObject({ got: false, have: 9, need: 10 });
    const ten = [...nine, mastered(3, 10)];
    expect(trophies(statsFrom([round(5)], ten)).find((t) => t.id === "table3")?.got).toBe(true);
  });

  it("spots new trophies after a round", () => {
    const before = statsFrom([round(6, { powers: 8 })], []);
    const after = addRound(before, round(10, { powers: 3, best_streak: 5, created_at: at("2026-11-03") }), []);
    const fresh = newTrophies(trophies(before), trophies(after)).map((t) => t.id);
    expect(fresh.sort()).toEqual(["fire", "perfect", "power10"]);
  });

  it("counts match wins and doesn't call a match a perfect practice round", () => {
    const s = statsFrom([round(10, { game: "match", won: true, total: 12 }), round(10, { game: "match", won: false, total: 10 })], []);
    expect(s.wins).toBe(1);
    expect(s.perfect).toBe(0);
    expect(trophies(s).find((t) => t.id === "win1")?.got).toBe(true);
  });

  it("only shows table trophies a child works on, won ones first", () => {
    const all = trophies(statsFrom([round(10)], [mastered(9, 1)]));
    const ids = shelf(all, [2, 3]).map((t) => t.id);
    expect(ids.slice(0, 2)).toEqual(["first", "perfect"]);
    expect(ids).toContain("table2");
    expect(ids).toContain("table9"); // started on it
    expect(ids).not.toContain("table7");
  });
});

describe("match answers", () => {
  const p = { tables: [3, 4], goals: 2, misses: 1, powers: 0, streak: 2, best_streak: 2 };

  it("adds a goal, a streak and a power shot for a quick right answer", () => {
    expect(scoreAnswer(p, "3x7", "times", 21, 2500)).toEqual({
      correct: true,
      time: 2500,
      next: { goals: 3, misses: 1, powers: 1, streak: 3, best_streak: 3 },
    });
  });

  it("counts a wrong answer as a save and resets the streak", () => {
    expect(scoreAnswer(p, "4x8", "times", 30, 6000)?.next).toEqual({ goals: 2, misses: 2, powers: 0, streak: 0, best_streak: 2 });
  });

  it("refuses facts from someone else's tables and nonsense", () => {
    expect(scoreAnswer(p, "9x9", "times", 81, 1000)).toBeNull();
    expect(scoreAnswer(p, "3x7", "times", NaN, 1000)).toBeNull();
    expect(scoreAnswer(p, "drop table", "times", 1, 1000)).toBeNull();
  });

  it("checks division and missing-number answers, but only in the player's own game", () => {
    const mixed = { ...p, mode: "mixed" };
    expect(scoreAnswer(mixed, "4x6", "divide", 6, 3000)?.correct).toBe(true); // 24 ÷ 4 = 6
    expect(scoreAnswer(mixed, "4x6", "divide", 24, 3000)?.correct).toBe(false);
    expect(scoreAnswer(mixed, "4x6", "missingL", 6, 3000)?.correct).toBe(true); // ? × 4 = 24
    expect(scoreAnswer({ ...p, mode: "divide" }, "4x6", "times", 24, 3000)).toBeNull(); // not this child's game
    expect(scoreAnswer({ ...p, mode: "times" }, "4x6", "divide", 6, 3000)).toBeNull();
  });
});

describe("game modes", () => {
  it("writes each kind of question from the same fact", () => {
    expect(questionWithAnswer({ fact: "4x6", kind: "times" })).toBe("4 × 6 = 24");
    expect(questionWithAnswer({ fact: "4x6", kind: "divide" })).toBe("24 ÷ 4 = 6");
    expect(questionWithAnswer({ fact: "4x6", kind: "missingL" })).toBe("6 × 4 = 24");
    expect(questionWithAnswer({ fact: "4x6", kind: "missingR" })).toBe("4 × 6 = 24");
    expect(questionParts({ fact: "4x6", kind: "missingL" })).toEqual([null, "×", "4", "=", "24"]);
    expect(answerFor({ fact: "4x6", kind: "missingR" })).toBe(6);
  });

  it("only asks the kinds of question the mode allows", () => {
    let i = 0;
    const r = () => [0.1, 0.4, 0.6, 0.9][i++ % 4];
    expect(Array.from({ length: 4 }, () => makeQuestion("3x5", "mixed", r).kind)).toEqual(["times", "divide", "missingL", "missingR"]);
    expect(makeQuestion("3x5", "divide").kind).toBe("divide");
    expect(["missingL", "missingR"]).toContain(makeQuestion("3x5", "missing").kind);
    expect(makeQuestion("3x5", "times").kind).toBe("times");
  });
});
