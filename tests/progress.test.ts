import { describe, expect, it } from "vitest";
import { buildFeedbackPrompt } from "@/lib/feedbackPrompt";
import { mergeProgress, progressLine } from "@/lib/progress";

describe("topic progress", () => {
  const lessons = [
    { start_at: "2026-10-10T10:00:00Z", topics: ["fractions", "Long Division"] },
    { start_at: "2026-10-20T10:00:00Z", topics: ["long division"] },
  ];
  it("lesson topics count as learning, with how many lessons", () => {
    const rows = mergeProgress([], lessons);
    expect(rows.map((r) => [r.name, r.status, r.lessons])).toEqual([
      ["long division", "learning", 2],
      ["fractions", "learning", 1],
    ]);
  });
  it("keeps what the tutor marked", () => {
    const rows = mergeProgress([{ name: "fractions", status: "got_it", updated_at: "2026-10-11T00:00:00Z" }], lessons);
    expect(rows.find((r) => r.name === "fractions")?.status).toBe("got_it");
  });
  it("coming-up topics move to learning once a later lesson covers them", () => {
    const rows = mergeProgress(
      [
        { name: "long division", status: "next", updated_at: "2026-10-15T00:00:00Z" },
        { name: "decimals", status: "next", updated_at: "2026-10-15T00:00:00Z" },
      ],
      lessons,
    );
    expect(rows.find((r) => r.name === "long division")?.status).toBe("learning");
    expect(rows.find((r) => r.name === "decimals")?.status).toBe("next");
  });
  it("goes into the parent message prompt", () => {
    const rows = mergeProgress([{ name: "fractions", status: "got_it", updated_at: "2026-10-11T00:00:00Z" }], lessons);
    const line = progressLine(rows)!;
    expect(line).toBe("got it: fractions; still practising: long division");
    const p = buildFeedbackPrompt({
      studentNames: ["Alice"], parentName: null, level: null, date: "x", learned: "x", nextTime: null, homework: null,
      howItWent: null, topics: [], tutorName: "Mr Ken", tone: "warm", allowEmoji: false, progress: line,
    });
    expect(p).toContain("Progress so far: got it: fractions");
  });
});
