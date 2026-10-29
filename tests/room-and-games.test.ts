import { describe, expect, it } from "vitest";
import { canvaEmbed, isValidToken } from "@/lib/room";
import { isValidSolution, solvedGrid } from "@/components/games/MiniSudoku";

describe("student room", () => {
  it("turns Canva share links into embeddable links", () => {
    expect(canvaEmbed("https://www.canva.com/design/DAGabc123/xyz789/view?utm_content=x")).toBe(
      "https://www.canva.com/design/DAGabc123/xyz789/view?embed",
    );
    expect(canvaEmbed("https://www.canva.com/design/DAGabc123/edit")).toBe("https://www.canva.com/design/DAGabc123/view?embed");
    expect(canvaEmbed("https://example.com/design/DAGabc123/view")).toBeNull();
    expect(canvaEmbed("not a link")).toBeNull();
  });
  it("only accepts long random-looking link codes", () => {
    expect(isValidToken("a".repeat(32))).toBe(true);
    expect(isValidToken("short")).toBe(false);
    expect(isValidToken("x".repeat(30) + "'; drop")).toBe(false);
  });
});

describe("mini sudoku", () => {
  it("always makes valid 4×4 and 6×6 grids", () => {
    for (let i = 0; i < 200; i++) {
      expect(isValidSolution(solvedGrid(4), 4)).toBe(true);
      expect(isValidSolution(solvedGrid(6), 6)).toBe(true);
    }
  });
  it("spots a wrong grid", () => {
    const g = solvedGrid(4);
    [g[0][0], g[0][1]] = [g[0][1], g[0][0]];
    expect(isValidSolution(g, 4)).toBe(false);
  });
});
