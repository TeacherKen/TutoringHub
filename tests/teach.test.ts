import { describe, expect, it } from "vitest";
import { cleanTeach, teachChannel } from "@/lib/teach";
import { needsFeedback, type Lesson } from "@/lib/data";

describe("teach together", () => {
  it("accepts only real fraction demos", () => {
    expect(cleanTeach({ kind: "fraction", parts: 4, on: [0, 1, 1, 9, -1, "2"], shape: "pizza", hidden: false })).toEqual({ kind: "fraction", parts: 4, on: [0, 1, 2], shape: "pizza", hidden: false });
    expect(cleanTeach({ kind: "fraction", parts: 7, on: [] })).toBeNull();
    expect(cleanTeach({ kind: "off" })).toEqual({ kind: "off" });
    expect(cleanTeach({ kind: "hack" })).toBeNull();
    expect(cleanTeach(null)).toBeNull();
    expect(teachChannel("abc")).toBe("tutoringhub-teach-abc");
  });
});

describe("lesson not finished", () => {
  const base = { status: "scheduled", sent_at: null, note_skipped: false, feedback_skipped: false, start_at: "2026-11-07T10:00:00Z", end_at: "2026-11-07T11:00:00Z", lesson_students: [{ student_id: "a" }] } as unknown as Lesson;
  it("counts a past lesson that was never marked done", () => {
    expect(needsFeedback(base, "2026-11-08")).toBe(true);
    expect(needsFeedback({ ...base, end_at: "2999-01-01T00:00:00Z" } as Lesson, "2026-11-08")).toBe(false);
    expect(needsFeedback({ ...base, lesson_students: [] } as unknown as Lesson, "2026-11-08")).toBe(false);
    expect(needsFeedback({ ...base, sent_at: "2026-11-07T12:00:00Z" } as Lesson, "2026-11-08")).toBe(false);
  });
});
