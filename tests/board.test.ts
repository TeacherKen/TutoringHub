import { describe, expect, it } from "vitest";
import { boardLayout, cleanLive, cleanMark, hitsMark, insertPage, pageKind, removePage } from "@/lib/boardShared";

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
    expect(cleanLive({ page: 1, tool: "pen", color: "#2563eb" }, [0, 1])).toMatchObject({ page: 1, tool: "pen" });
    expect(cleanLive({ page: 5, tool: "pen" }, [0, 1])).toBeNull();
    expect(cleanLive({ page: 0, tool: "hack", go_to: 9 }, [0, 1])).toMatchObject({ tool: null, go_to: null });
  });
  it("the eraser finds lines it touches", () => {
    const line = { t: "pen" as const, c: "#000000", w: 0.003, p: [0.1, 0.1, 0.2, 0.1] };
    expect(hitsMark(line, 0.2, 0.105, 0.015, 0.5625)).toBe(true);
    expect(hitsMark(line, 0.5, 0.5, 0.015, 0.5625)).toBe(false);
  });
});

describe("smart slides: added pages", () => {
  it("adds blank and squared pages after the current page, keeping page numbers stable", () => {
    let l = boardLayout(3, null);
    expect(l).toEqual([0, 1, 2]);
    l = insertPage(l, 0, "blank")!;
    l = insertPage(l, 1000, "grid")!;
    l = insertPage(l, 2, "blank")!;
    expect(l).toEqual([0, 1000, 2000, 1, 2, 1001]);
    expect([pageKind(0), pageKind(1001), pageKind(2000)]).toEqual(["slide", "blank", "grid"]);
  });
  it("only added pages can be removed", () => {
    expect(removePage([0, 1000, 1], 1000)).toEqual([0, 1]);
    expect(removePage([0, 1000, 1], 1)).toBeNull();
  });
  it("live info must be on a real page", () => {
    expect(cleanLive({ page: 2000, tool: "pen" }, [0, 2000])).toMatchObject({ page: 2000 });
    expect(cleanLive({ page: 2001, tool: "pen" }, [0, 2000])).toBeNull();
  });
});

import { boardExpired, boardExpiry } from "@/lib/boardShared";
describe("smart slides delete after 4 weeks", () => {
  it("added 1 Oct → deleted 29 Oct", () => {
    const added = "2026-10-01T03:00:00Z";
    expect(boardExpiry(added).toISOString().slice(0, 10)).toBe("2026-10-29");
    expect(boardExpired(added, Date.parse("2026-10-28T23:00:00Z"))).toBe(false);
    expect(boardExpired(added, Date.parse("2026-10-29T03:00:00Z"))).toBe(true);
  });
});
