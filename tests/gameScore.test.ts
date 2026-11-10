import { describe, expect, it } from "vitest";
import { fmtScore, isMissionGame, lowerIsBetter, variantLabel, MISSION_GAMES } from "@/lib/gameScore";
import { BUILT_IN } from "@/lib/games";

describe("game scores", () => {
  it("formats each unit", () => {
    expect(fmtScore(324, "ds")).toBe("32.4s");
    expect(fmtScore(45, "s")).toBe("45s");
    expect(fmtScore(125, "s")).toBe("2m 05s");
    expect(fmtScore(12, "pts")).toBe("12 points");
    expect(fmtScore(1, "pts")).toBe("1 point");
    expect(fmtScore(3, "stars")).toBe("★★★");
    expect(fmtScore(0, "stars")).toBe("0 stars");
  });
  it("knows which way is better", () => {
    expect(lowerIsBetter("ds")).toBe(true);
    expect(lowerIsBetter("s")).toBe(true);
    expect(lowerIsBetter("pts")).toBe(false);
    expect(lowerIsBetter("stars")).toBe(false);
  });
  it("names levels", () => {
    expect(variantLabel("qm", "qm-easy")).toBe("Easy");
    expect(variantLabel("sd", "sudoku-4")).toBe("4 × 4");
    expect(variantLabel("tt", "tt-2-3-4")).toBe("×2, 3, 4");
    expect(variantLabel("ms", "ms-thb-change")).toBe("THB · Change");
    expect(variantLabel("sb", "sb-cat-hard")).toBe("Hard");
    expect(variantLabel("qm", "")).toBe("");
  });
  it("only lets built-in games be missions", () => {
    for (const g of MISSION_GAMES) expect((BUILT_IN as readonly string[]).includes(g)).toBe(true);
    expect(isMissionGame("cq")).toBe(false);
    expect(isMissionGame("qm")).toBe(true);
  });
});
