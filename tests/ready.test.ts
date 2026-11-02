import { describe, expect, it } from "vitest";
import { buildReady, type ReadyInput } from "@/lib/ready";

// ✅ "Coming up · 3 of 6 ready": the real week of 2 Nov 2026 (Bangkok times written as UTC+7).
const t = (s: string) => new Date(`${s}+07:00`).toISOString();
const lesson = (id: string, start: string, mode: "onsite" | "online", studentIds: string[], ready_at: string | null = null) => ({ id, start_at: t(start), mode, studentIds, ready_at });
const hist = (student_id: string, id: string, start: string, end: string, status = "done") => ({ student_id, id, start_at: t(start), end_at: t(end), status });

const base: ReadyInput = {
  lessons: [],
  students: [
    { id: "alice", first_name: "Alice", board_id: "bA" },
    { id: "angela", first_name: "Angela", board_id: "bG" },
    { id: "yina", first_name: "Yina", board_id: "bY" },
    { id: "ip", first_name: "IP" },
    { id: "iq", first_name: "IQ" },
    { id: "kim", first_name: "Kim", slides_url: "https://www.canva.com/design/x/view" },
  ],
  boards: [
    { id: "bA", title: "Alice_Prep_Session_53", created_at: t("2026-11-02T11:18:00") },
    { id: "bG", title: "Angela Learning #4", created_at: t("2026-10-30T09:59:00") },
    { id: "bY", title: "Yina_Times_Tables_3_and_4", created_at: t("2026-11-02T11:16:00") },
  ],
  history: [
    hist("alice", "a0", "2026-10-31T17:00:00", "2026-10-31T17:50:00"),
    hist("alice", "a1", "2026-11-05T18:00:00", "2026-11-05T18:50:00", "scheduled"),
    hist("alice", "a2", "2026-11-07T17:00:00", "2026-11-07T17:50:00", "scheduled"),
    hist("angela", "g0", "2026-10-30T19:00:00", "2026-10-30T20:00:00"),
    hist("yina", "y0", "2026-11-01T09:00:00", "2026-11-01T09:50:00"),
    hist("ip", "p0", "2026-10-31T11:00:00", "2026-10-31T15:00:00"),
    hist("iq", "p0", "2026-10-31T11:00:00", "2026-10-31T15:00:00"),
  ],
  sheets: [],
};

describe("is each coming lesson ready?", () => {
  it("online: ready when new smart slides were uploaded after the last lesson", () => {
    const r = buildReady({ ...base, lessons: [lesson("y1", "2026-11-08T09:00:00", "online", ["yina"])] }).get("y1")!;
    expect(r).toEqual({ ready: true, how: "slides", text: "Slides ready · Yina_Times_Tables_3_and_4" });
  });

  it("online: slides uploaded before the last lesson are last week's, so not ready", () => {
    const r = buildReady({ ...base, lessons: [lesson("g1", "2026-11-05T19:00:00", "online", ["angela"])] }).get("g1")!;
    expect(r.ready).toBe(false);
    expect(r.text).toBe("Slides not updated since Fri 30 Oct");
  });

  it("twice a week: Thursday's upload covers Thursday, Saturday needs a new one", () => {
    const m = buildReady({ ...base, lessons: [lesson("a1", "2026-11-05T18:00:00", "online", ["alice"]), lesson("a2", "2026-11-07T17:00:00", "online", ["alice"])] });
    expect(m.get("a1")!.ready).toBe(true);
    expect(m.get("a2")).toMatchObject({ ready: false, text: "Slides not updated since Thu 5 Nov" });
  });

  it("onsite: a worksheet to print until ticked, with a hint when one was made here", () => {
    const l = lesson("p1", "2026-11-07T11:00:00", "onsite", ["ip", "iq"]);
    expect(buildReady({ ...base, lessons: [l] }).get("p1")).toEqual({ ready: false, need: "worksheet", text: "Worksheet to print", hint: undefined });
    const withSheet = buildReady({ ...base, lessons: [l], sheets: [{ title: "Fractions of amounts", student_id: "iq", created_at: t("2026-11-02T10:00:00") }] }).get("p1")!;
    expect(withSheet).toMatchObject({ ready: false, hint: "Made: Fractions of amounts" });
    const old = buildReady({ ...base, lessons: [l], sheets: [{ title: "Old one", student_id: "iq", created_at: t("2026-10-20T10:00:00") }] }).get("p1")!;
    expect(old).toMatchObject({ hint: undefined });
    expect(buildReady({ ...base, lessons: [{ ...l, ready_at: t("2026-11-06T20:00:00") }] }).get("p1")).toEqual({ ready: true, how: "ticked", text: "Ready" });
  });

  it("online with a Canva link only, no slides, or slides that expire first", () => {
    const m = buildReady({
      ...base,
      lessons: [lesson("k1", "2026-11-06T18:00:00", "online", ["kim"]), lesson("g9", "2026-11-28T19:00:00", "online", ["angela"])],
      history: [],
    });
    expect(m.get("k1")!.text).toBe("Canva link only, tick when it's updated");
    expect(m.get("g9")!.text).toBe("Slides expire before this lesson"); // uploaded 30 Oct, kept 28 days
  });

  it("a ticked online lesson is ready whatever its slides", () => {
    expect(buildReady({ ...base, lessons: [lesson("g1", "2026-11-05T19:00:00", "online", ["angela"], t("2026-11-05T08:00:00"))] }).get("g1")!.ready).toBe(true);
  });
});
