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
      expect(isValidSolution(solvedGrid(9), 9)).toBe(true);
    }
  });
  it("spots a wrong grid", () => {
    const g = solvedGrid(4);
    [g[0][0], g[0][1]] = [g[0][1], g[0][0]];
    expect(isValidSolution(g, 4)).toBe(false);
  });
});

import { cleanWvs, otherSide } from "@/lib/wvs";
describe("🐺🐑 Wolf vs Sheep online: checking messages between screens", () => {
  it("accepts real moves and game messages", () => {
    expect(cleanWvs({ type: "move", from: "tutor", n: 3, move: { pieceId: "sheep12", to: "n24" } })).toEqual({ type: "move", from: "tutor", n: 3, move: { pieceId: "sheep12", to: "n24" } });
    expect(cleanWvs({ type: "invite", from: "tutor", studentSide: "sheep", moves: [{ pieceId: "wolf", to: "n16" }] })?.moves).toHaveLength(1);
    expect(otherSide("wolf")).toBe("sheep");
  });
  it("refuses anything odd", () => {
    expect(cleanWvs({ type: "move", n: 1, move: { pieceId: "dragon", to: "n1" } })).toBeNull();
    expect(cleanWvs({ type: "move", n: 1, move: { pieceId: "wolf", to: "n25" } })).toBeNull();
    expect(cleanWvs({ type: "move", move: { pieceId: "wolf", to: "n2" } })).toBeNull(); // no move number
    expect(cleanWvs({ type: "sync", moves: [{ pieceId: "wolf", to: "x" }] })).toBeNull();
    expect(cleanWvs({ type: "hack" })).toBeNull();
    expect(cleanWvs({ type: "invite", studentSide: "dragon" })?.studentSide).toBeUndefined();
  });
});
