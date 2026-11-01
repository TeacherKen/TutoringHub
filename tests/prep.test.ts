import { describe, expect, it } from "vitest";
import { buildPrep, type PrepInput } from "@/lib/prep";

const NOW = Date.parse("2026-11-04T08:00:00Z"); // Wednesday afternoon in Bangkok
const day = 86_400_000;
const iso = (ms: number) => new Date(ms).toISOString();

function input(over: Partial<PrepInput> = {}): PrepInput {
  return {
    now: NOW,
    lessons: [{ id: "L-today", start_at: iso(NOW + 3600_000), mode: "onsite", studentIds: ["jaian", "nivaan"] }],
    students: [
      { id: "jaian", first_name: "Jaian" },
      { id: "nivaan", first_name: "Nivaan", tt_tables: [2, 3, 4] },
    ],
    boards: [],
    history: [
      { student_id: "jaian", id: "L-mon", start_at: iso(NOW - 2 * day), end_at: iso(NOW - 2 * day + 3600_000), status: "done", next_time: "Long division with remainders", homework: "Book p.12" },
      { student_id: "jaian", id: "L-old", start_at: iso(NOW - 9 * day), end_at: iso(NOW - 9 * day + 3600_000), status: "done", next_time: "Old plan", homework: null },
      { student_id: "nivaan", id: "L-mon", start_at: iso(NOW - 2 * day), end_at: iso(NOW - 2 * day + 3600_000), status: "done", next_time: null, homework: null },
      { student_id: "nivaan", id: "L-cancel", start_at: iso(NOW - 1 * day), end_at: iso(NOW - 1 * day + 3600_000), status: "cancelled", next_time: "x", homework: null },
    ],
    sheets: [{ id: "W1", title: "Long division", student_id: "jaian", created_at: iso(NOW - 2 * day + 7200_000) }],
    rounds: [
      { student_id: "nivaan", score: 6, total: 10, created_at: iso(NOW - day) },
      { student_id: "nivaan", score: 9, total: 10, created_at: iso(NOW - day + 600_000) },
      { student_id: "nivaan", score: 10, total: 10, created_at: iso(NOW - 5 * day) }, // before the last lesson
    ],
    accounts: [{ studentIds: ["jaian", "nivaan"], leftHours: 1.5, low: true }],
    ...over,
  };
}

describe("✅ before class", () => {
  it("shows last lesson's plan and homework (not older ones, not cancelled ones)", () => {
    const [jaian, nivaan] = buildPrep(input()).get("L-today")!;
    expect(jaian.last).toMatchObject({ lessonId: "L-mon", nextTime: "Long division with remainders", homework: "Book p.12" });
    expect(nivaan.last).toMatchObject({ lessonId: "L-mon", nextTime: null }); // the cancelled lesson is skipped
  });

  it("finds the worksheet made since the last lesson, for printing", () => {
    const [jaian, nivaan] = buildPrep(input()).get("L-today")!;
    expect(jaian.sheet).toEqual({ id: "W1", title: "Long division" });
    expect(nivaan.sheet).toBeNull();
    expect(jaian.slides).toBeNull(); // onsite: no room check
  });

  it("counts football practice since the last lesson, only for times tables students", () => {
    const [jaian, nivaan] = buildPrep(input()).get("L-today")!;
    expect(nivaan.practice).toEqual({ rounds: 2, best: "9/10" });
    expect(jaian.practice).toBeNull();
    const none = buildPrep(input({ rounds: [] })).get("L-today")![1];
    expect(none.practice).toEqual({ rounds: 0, best: null });
  });

  it("shows hours left from the shared package, and warns when low", () => {
    const [jaian, nivaan] = buildPrep(input()).get("L-today")!;
    expect(jaian.hours).toEqual({ left: 1.5, low: true });
    expect(nivaan.hours).toEqual({ left: 1.5, low: true });
    expect(buildPrep(input({ accounts: [] })).get("L-today")![0].hours).toBeNull(); // e.g. Preply
  });

  it("online: says what's in the room — smart slides, Canva, or nothing (old slides don't count)", () => {
    const online = (students: PrepInput["students"], boards: PrepInput["boards"] = []) =>
      buildPrep(input({ lessons: [{ id: "L", start_at: iso(NOW + 3600_000), mode: "online", studentIds: ["alice"] }], students, boards })).get("L")![0];
    expect(online([{ id: "alice", first_name: "Alice", board_id: "B1" }], [{ id: "B1", title: "Worksheet: Ratio", created_at: iso(NOW - day) }]).slides).toEqual({ kind: "board", title: "Worksheet: Ratio" });
    expect(online([{ id: "alice", first_name: "Alice", board_id: "B1", slides_url: "https://canva.com/x", slides_label: "Alice Prep #52" }], [{ id: "B1", title: "Old", created_at: iso(NOW - 40 * day) }]).slides).toEqual({
      kind: "canva",
      title: "Alice Prep #52",
    });
    expect(online([{ id: "alice", first_name: "Alice" }]).slides).toEqual({ kind: "none" });
    expect(online([{ id: "alice", first_name: "Alice" }]).last).toBeNull(); // first lesson in the app
  });
});
