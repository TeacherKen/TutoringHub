import { describe, expect, it } from "vitest";
import { accountBalance, type HoursLesson } from "@/lib/hours";
import { buildFeedbackPrompt } from "@/lib/feedbackPrompt";

const L = (id: string, start: string, status: string, ids: string[], length: number | null = null): HoursLesson => ({
  id,
  start_at: start,
  end_at: new Date(new Date(start).getTime() + 3_600_000).toISOString(),
  status,
  length_hours: length,
  charged_student_ids: ids,
});

describe("package hours", () => {
  const pkg = [{ hours: 12, start_date: "2026-10-01" }];

  it("counts done, charged cancellations and no-shows", () => {
    const b = accountBalance(["j"], pkg, [], [
      L("1", "2026-10-05T10:00:00Z", "done", ["j"]),
      L("2", "2026-10-07T10:00:00Z", "cancelled_charged", ["j"]),
      L("3", "2026-10-09T10:00:00Z", "no_show", ["j"]),
      L("4", "2026-10-12T10:00:00Z", "cancelled", ["j"]),
      L("5", "2026-10-14T10:00:00Z", "scheduled", ["j"]),
    ]);
    expect(b.used).toBe(3);
    expect(b.left).toBe(9);
  });

  it("uses the lesson length the tutor set", () => {
    const b = accountBalance(["j"], pkg, [], [L("1", "2026-10-05T10:00:00Z", "done", ["j"], 1.5)]);
    expect(b.used).toBe(1.5);
  });

  it("counts a siblings' lesson once when they share hours", () => {
    const b = accountBalance(["j", "n"], pkg, [], [L("1", "2026-10-05T10:00:00Z", "done", ["j", "n"])]);
    expect(b.used).toBe(1);
  });

  it("does not charge a sibling who was marked as not using hours", () => {
    const b = accountBalance(["n"], pkg, [], [L("1", "2026-10-05T10:00:00Z", "done", ["j"])]);
    expect(b.used).toBe(0);
  });

  it("ignores lessons before the package started (Bangkok date)", () => {
    // 30 Sep 23:30 Bangkok = 30 Sep 16:30 UTC → before 1 Oct
    const b = accountBalance(["j"], pkg, [], [
      L("1", "2026-09-30T16:30:00Z", "done", ["j"]),
      // 1 Oct 00:30 Bangkok = 30 Sep 17:30 UTC → counts
      L("2", "2026-09-30T17:30:00Z", "done", ["j"]),
    ]);
    expect(b.countedLessonIds).toEqual(["2"]);
  });

  it("adds packages and adjustments, and can go below zero", () => {
    const b = accountBalance(
      ["j"],
      [{ hours: 1, start_date: "2026-10-01" }, { hours: 1, start_date: "2026-10-10" }],
      [{ hours: -0.5 }],
      [L("1", "2026-10-05T10:00:00Z", "done", ["j"], 2), L("2", "2026-10-06T10:00:00Z", "done", ["j"], 1)],
    );
    expect(b.bought).toBe(2);
    expect(b.left).toBe(-1.5);
  });

  it("has nothing to count with no package", () => {
    const b = accountBalance(["j"], [], [], [L("1", "2026-10-05T10:00:00Z", "done", ["j"])]);
    expect(b.used).toBe(0);
    expect(b.left).toBe(0);
  });
});

describe("feedback prompt", () => {
  const base = {
    studentNames: ["Jaian Kumar"],
    parentName: "Ms Aradhana",
    level: "P4",
    date: "Wed 28 Oct",
    learned: "Long division with remainders",
    nextTime: "Word problems",
    homework: "Worksheet page 3",
    howItWent: "good" as const,
    topics: ["long division"],
    tutorName: "Mr Ken",
    tone: "warm",
    allowEmoji: false,
  };

  it("uses the first name only", () => {
    const p = buildFeedbackPrompt(base);
    expect(p).toContain("about Jaian (P4)");
    expect(p).not.toContain("Kumar");
  });
  it("includes the notes and parent name", () => {
    const p = buildFeedbackPrompt(base);
    expect(p).toContain("Ms Aradhana");
    expect(p).toContain("Long division with remainders");
    expect(p).toContain("Word problems");
    expect(p).toContain("Do not use emojis.");
  });
  it("handles siblings", () => {
    const p = buildFeedbackPrompt({ ...base, studentNames: ["Jaian", "Nivaan"] });
    expect(p).toContain("about Jaian and Nivaan");
  });
  it("uses a custom template from Settings", () => {
    expect(buildFeedbackPrompt({ ...base, template: "Hi {{parent}} re {{student}} {{unknown}}" })).toBe(
      "Hi Ms Aradhana re Jaian {{unknown}}",
    );
  });
});

import { renewalText } from "@/components/RenewalMessage";

describe("renewal message", () => {
  it("mentions hours left and the same package price", () => {
    const t = renewalText({ parentName: "Ms Aradhana", names: ["Jaian", "Nivaan"], hoursLeft: 1.5, lastHours: 12, lastPrice: 33600, tutorName: "Mr Ken" });
    expect(t).toContain("Hi Ms Aradhana");
    expect(t).toContain("Jaian and Nivaan have 1.5 hours left");
    expect(t).toContain("12 hours for ฿33,600");
    expect(t).toContain("Mr Ken");
  });
  it("handles used-up packages", () => {
    expect(renewalText({ parentName: null, names: ["Alice"], hoursLeft: -1, lastHours: null, lastPrice: null, tutorName: "Mr Ken" })).toContain(
      "Alice has used all the package hours, plus 1 hour extra.",
    );
  });
});
