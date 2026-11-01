import { describe, expect, it } from "vitest";
import { needsFeedback, needsNote, type Lesson } from "@/lib/data";
import { untilText } from "@/components/home/Dashboard";

const past = new Date(Date.now() - 2 * 86_400_000);
const lesson = (over: Partial<Lesson> = {}): Lesson =>
  ({
    id: "l", start_at: past.toISOString(), end_at: new Date(past.getTime() + 3600_000).toISOString(), status: "done", learned: null, sent_at: null,
    lesson_students: [{ student_id: "s", uses_hours: true, match_source: "auto", students: null }], ...over,
  }) as Lesson;
const key = (iso: string) => iso.slice(0, 10);
const today = new Date().toISOString().slice(0, 10);

describe("🧹 Clear all on Home", () => {
  it("a lesson with no note is flagged, unless it was cleared", () => {
    expect(needsNote(lesson())).toBe(true);
    expect(needsNote(lesson({ note_skipped: true }))).toBe(false);
    expect(needsNote(lesson({ learned: "fractions" }))).toBe(false);
  });
  it("feedback is flagged until sent, or cleared (clearing the note clears feedback too)", () => {
    expect(needsFeedback(lesson(), today, key)).toBe(true);
    expect(needsFeedback(lesson({ feedback_skipped: true }), today, key)).toBe(false);
    expect(needsFeedback(lesson({ note_skipped: true }), today, key)).toBe(false);
    expect(needsFeedback(lesson({ sent_at: new Date().toISOString() }), today, key)).toBe(false);
    expect(needsFeedback(lesson({ status: "cancelled" }), today, key)).toBe(false);
  });
  it("says how long until the next lesson in plain words", () => {
    expect(untilText(30_000)).toBe("starting now");
    expect(untilText(25 * 60_000)).toBe("in 25 min");
    expect(untilText(100 * 60_000)).toBe("in 1 h 40 min");
    expect(untilText(120 * 60_000)).toBe("in 2 h");
  });
});
