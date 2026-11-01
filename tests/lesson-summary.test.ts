import { describe, expect, it } from "vitest";
import { cleanSummary, lessonWindow } from "@/lib/lessonSummary";
import { lessonWriting, type Mark } from "@/lib/boardShared";

const pen = { t: "pen", c: "#000", w: 2, p: [0.1, 0.1, 0.2, 0.2] } as unknown as Mark["data"];
const mark = (id: string, page: number, at: string, deleted = false): Mark => ({ id, page, author: "student", data: pen, created_at: at, deleted });

describe("which writing belongs to the lesson", () => {
  it("takes a little before the start to a while after the end", () => {
    expect(lessonWindow("2026-11-04T09:30:00.000Z", "2026-11-04T10:30:00.000Z")).toEqual({ from: "2026-11-04T09:10:00.000Z", to: "2026-11-04T11:15:00.000Z" });
  });

  it("keeps this lesson's writing, not last week's or rubbed-out lines, in page order", () => {
    const w = lessonWindow("2026-11-04T09:30:00.000Z", "2026-11-04T10:30:00.000Z");
    const marks = [
      mark("a", 3, "2026-11-04T09:40:00.000Z"),
      mark("b", 1, "2026-11-04T10:05:00.000Z"),
      mark("c", 2, "2026-10-28T09:40:00.000Z"), // last week
      mark("d", 2, "2026-11-04T09:50:00.000Z", true), // rubbed out
      { ...mark("e", 2, ""), created_at: undefined },
    ];
    const r = lessonWriting(marks, [0, 1, 2, 3, 1000], w.from, w.to);
    expect(r.marks.map((m) => m.id)).toEqual(["a", "b"]);
    expect(r.pages).toEqual([1, 3]);
  });
});

describe("checking what the AI sends back", () => {
  const good = {
    what_we_did: "Fractions of a set with bar models.",
    went_well: ["Drew bar models neatly"],
    mistakes: [{ question: "3/4 of 24", what_happened: "wrote 6", why: "found one quarter but stopped" }],
    topics: ["Fractions Of A Set"],
    how_it_went: "good",
    homework: "",
    next_time: "Fractions of a set word problems.",
    parent_message: "Hi Priya, today Nivaan…",
    worksheet_prompt: "Create a worksheet for Nivaan (P3)…",
  };

  it("accepts a proper summary and tidies it", () => {
    const s = cleanSummary(good);
    expect(s?.topics).toEqual(["fractions of a set"]);
    expect(s?.mistakes[0].question).toBe("3/4 of 24");
    expect(s?.how_it_went).toBe("good");
  });

  it("refuses one without the two parts, and fixes odd values", () => {
    expect(cleanSummary({ ...good, parent_message: "" })).toBeNull();
    expect(cleanSummary({ ...good, worksheet_prompt: 42 })).toBeNull();
    expect(cleanSummary(null)).toBeNull();
    expect(cleanSummary({ ...good, how_it_went: "amazing", mistakes: "lots", went_well: [1, "ok"] })).toMatchObject({ how_it_went: "good", mistakes: [], went_well: ["ok"] });
  });
});
