import { describe, expect, it } from "vitest";
import { cleanLive, cleanMark, hitsMark } from "@/lib/boardShared";

describe("smart slides: checking what browsers send", () => {
  it("accepts a normal pen line and rounds it", () => {
    expect(cleanMark({ t: "pen", c: "#2563eb", w: 0.003, p: [0.1, 0.2, 0.123456789, 0.3] })).toEqual({ t: "pen", c: "#2563eb", w: 0.003, p: [0.1, 0.2, 0.1235, 0.3] });
  });
  it("refuses bad colours, sizes and points", () => {
    expect(cleanMark({ t: "pen", c: "red;", w: 0.003, p: [0, 0] })).toBeNull();
    expect(cleanMark({ t: "pen", c: "#000000", w: 5, p: [0, 0] })).toBeNull();
    expect(cleanMark({ t: "pen", c: "#000000", w: 0.003, p: [0, 0, 7, 7] })).toBeNull();
    expect(cleanMark({ t: "pen", c: "#000000", w: 0.003, p: [0, 0, 0.1] })).toBeNull();
    expect(cleanMark({ t: "pen", c: "#000000", w: 0.003, p: new Array(5000).fill(0.5) })).toBeNull();
    expect(cleanMark({ t: "script", c: "#000000" })).toBeNull();
  });
  it("cleans typed words", () => {
    expect(cleanMark({ t: "text", c: "#000000", s: 0.03, x: 0.5, y: 0.5, text: "  17/24\n " })).toMatchObject({ text: "17/24" });
    expect(cleanMark({ t: "text", c: "#000000", s: 0.03, x: 0.5, y: 0.5, text: "   " })).toBeNull();
    expect((cleanMark({ t: "text", c: "#000000", s: 0.03, x: 0.5, y: 0.5, text: "x".repeat(500) }) as { text: string }).text).toHaveLength(200);
  });
  it("live info stays inside the slides", () => {
    expect(cleanLive({ page: 1, tool: "pen", color: "#2563eb" }, 2)).toMatchObject({ page: 1, tool: "pen" });
    expect(cleanLive({ page: 5, tool: "pen" }, 2)).toBeNull();
    expect(cleanLive({ page: 0, tool: "hack", go_to: 9 }, 2)).toMatchObject({ tool: null, go_to: null });
  });
  it("the eraser finds lines it touches", () => {
    const line = { t: "pen" as const, c: "#000000", w: 0.003, p: [0.1, 0.1, 0.2, 0.1] };
    expect(hitsMark(line, 0.2, 0.105, 0.015, 0.5625)).toBe(true);
    expect(hitsMark(line, 0.5, 0.5, 0.015, 0.5625)).toBe(false);
  });
});
