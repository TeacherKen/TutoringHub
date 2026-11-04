import { describe, expect, it, vi, beforeEach } from "vitest";
import { parseOccurrences, upgradeKey } from "@/lib/calendar/parse";
import { isUnmarked, needsFeedback, needsNote, reminderSince, type Lesson } from "@/lib/data";
import { forecast, type EarnLesson } from "@/lib/earnings";
import { addDays, fmtDay } from "@/lib/time";
import { lockPicture } from "@/components/WatchScreen";

// 🔍 The fixes from the code review (Nov 2026): each test is a bug that really happened or could have.

const usage = { error: null as unknown };
vi.mock("@/lib/supabase/server", () => {
  const chain = () => {
    const q: Record<string, unknown> = {};
    for (const k of ["select", "gte", "eq", "limit", "order", "maybeSingle"]) q[k] = () => q;
    (q as { then: unknown }).then = (ok: (v: unknown) => unknown) => ok({ data: usage.error ? null : [], error: usage.error });
    return q;
  };
  return { createClient: async () => ({ from: chain }), createAdminClient: () => ({ from: chain }) };
});

const series = (time: string) => `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:weekly-9@google.com
DTSTART;TZID=Asia/Bangkok:20261007T${time}00
DTEND;TZID=Asia/Bangkok:20261007T180000
RRULE:FREQ=WEEKLY;BYDAY=WE
SUMMARY:Jaian & Nivaan
END:VEVENT
END:VCALENDAR`;

describe("calendar: moving the whole weekly series to a new time", () => {
  const from = new Date("2026-10-01T00:00:00Z");
  const to = new Date("2026-11-01T00:00:00Z");
  it("keeps every past lesson the same lesson (no copies counted twice)", () => {
    const before = parseOccurrences(series("1700"), from, to).map((o) => o.key);
    const after = parseOccurrences(series("1730"), from, to).map((o) => o.key);
    expect(before).toEqual(["d:2026-10-07", "d:2026-10-14", "d:2026-10-21", "d:2026-10-28"]);
    expect(after).toEqual(before);
  });
  it("two repeats on the same day keep separate ids (none is dropped)", () => {
    const twice = series("0900").replace("RRULE:FREQ=WEEKLY;BYDAY=WE", "RRULE:FREQ=DAILY;BYHOUR=9,16;COUNT=4");
    const keys = parseOccurrences(twice, from, to).map((o) => o.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.length).toBeGreaterThanOrEqual(2);
  });
  it("lessons saved with the old kind of id are switched over to the new one", () => {
    expect(upgradeKey("2026-10-21T10:00:00.000Z")).toBe("d:2026-10-21");
    expect(upgradeKey("2026-10-21T18:00:00.000Z")).toBe("d:2026-10-22"); // 1 am Bangkok, the next day
    expect(upgradeKey("single")).toBeNull();
    expect(upgradeKey("d:2026-10-21")).toBeNull();
    expect(upgradeKey("junk")).toBeNull();
  });
});

const ago = (days: number) => new Date(Date.now() - days * 86_400_000);
const lesson = (days: number, over: Partial<Lesson> = {}): Lesson =>
  ({
    id: `l${days}`, start_at: ago(days).toISOString(), end_at: new Date(ago(days).getTime() + 3600_000).toISOString(), status: "scheduled", learned: null, sent_at: null,
    lesson_students: [{ student_id: "s", uses_hours: true, match_source: "auto", students: null }], ...over,
  }) as Lesson;

describe("reminders agree everywhere (Home, Week, Money)", () => {
  const today = "2026-11-01";
  it("go back to the tracking date, but never more than 30 days", () => {
    expect(reminderSince(null, today)).toBe("2026-10-02");
    expect(reminderSince("2026-10-28", today)).toBe("2026-10-28");
    expect(reminderSince("2025-01-01", today)).toBe("2026-10-02");
  });
  it("a lesson before the tracking date never shows 'Note missing' or 'Feedback not sent'", () => {
    const since = addDays(new Date().toISOString().slice(0, 10), -3);
    expect(needsNote(lesson(10), since, true)).toBe(false);
    expect(needsNote(lesson(1), since, true)).toBe(true);
    const done = lesson(10, { status: "done", learned: "fractions" });
    expect(needsFeedback(done, "2999-01-01", undefined, since)).toBe(false);
    expect(needsFeedback({ ...done, start_at: ago(1).toISOString() }, "2999-01-01", undefined, since)).toBe(true);
  });
  it("a cleared lesson that was never marked done still shows as not marked (it doesn't count for money yet)", () => {
    const cleared = lesson(2, { note_skipped: true });
    expect(needsNote(cleared)).toBe(false);
    expect(isUnmarked(cleared)).toBe(true);
    expect(isUnmarked(lesson(2, { status: "done" }))).toBe(false);
    expect(isUnmarked(lesson(-1))).toBe(false); // still to come
    expect(isUnmarked(lesson(2, { lesson_students: [] }))).toBe(false); // no student: not a class
  });
});

describe("'runs out around' for a new student", () => {
  const wk = (n: number, start: string): EarnLesson[] =>
    Array.from({ length: n }, (_, i) => {
      const s = new Date(Date.parse(start) + i * 7 * 86_400_000);
      return { id: `p${start}${i}`, start_at: s.toISOString(), end_at: new Date(s.getTime() + 3600_000).toISOString(), status: "done", length_hours: null, charged: ["a"] };
    });
  it("uses the weeks they've actually been coming, not always 4", () => {
    // Started 2 weeks ago, 1 hour a week, 19 hours left: about 19 weeks, not 76.
    const f = forecast(19, ["a"], wk(2, "2026-10-21T10:00:00Z"), [], "2026-11-01");
    expect(f.endDate! < "2027-04-01").toBe(true);
    expect(f.endDate! > "2027-02-01").toBe(true);
  });
  it("a student who's been coming for months keeps the 4-week pace", () => {
    const every2 = [...wk(1, "2026-08-05T10:00:00Z"), ...wk(1, "2026-10-14T10:00:00Z"), ...wk(1, "2026-10-28T10:00:00Z")];
    const f = forecast(4, ["a"], every2, [], "2026-11-01");
    expect(f.endDate).toBe(addDays("2026-11-01", 56)); // 0.5 h a week → 8 weeks
  });
  it("dates far away show the year", () => {
    expect(fmtDay("2028-01-06", "2026-11-01")).toBe("Thu 6 Jan 2028");
    expect(fmtDay("2026-11-04", "2026-11-01")).toBe("Wed 4 Nov");
  });
});

describe("security fixes", () => {
  it("a child's screen picture can only load things from the app", () => {
    const evil = `<!doctype html><html><img src="https://evil.example/track.gif"><head></head></html>`;
    const out = lockPicture(evil);
    expect(out.startsWith(`<!doctype html><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src 'self'`)).toBe(true);
    expect(out.match(/<!doctype/gi)?.length).toBe(1); // still a normal page, not quirks mode
    expect(lockPicture("")).toBe("");
  });

  it("the live slides channel needs the room link, and a new link closes the old channel", async () => {
    const { liveKey } = await import("@/lib/board");
    const board = "11111111-1111-4111-8111-111111111111";
    expect(liveKey("tokenA", board)).toBe(liveKey("tokenA", board));
    expect(liveKey("tokenB", board)).not.toBe(liveKey("tokenA", board));
    expect(liveKey("tokenA", board)).not.toContain("tokenA");
  });

  describe("AI spending stop", () => {
    beforeEach(() => {
      process.env.ANTHROPIC_API_KEY = "test-key";
      usage.error = null;
    });
    it("if the meter can't be read, the AI doesn't run (the $4.50 stop can't be skipped)", async () => {
      usage.error = { message: "database hiccup" };
      const fetchSpy = vi.spyOn(globalThis, "fetch");
      const { callClaude, aiBudget } = await import("@/lib/aiCall");
      expect((await aiBudget()).ok).toBe(false);
      const r = await callClaude({ feature: "message", model: "claude-haiku-5-5", max_tokens: 10, messages: [{ role: "user", content: "hi" }] } as never);
      expect(r.error).toMatch(/couldn't check/);
      expect(fetchSpy).not.toHaveBeenCalled();
      fetchSpy.mockRestore();
    });
  });

  it("every page refuses to be shown inside another website", async () => {
    const config = (await import("../next.config")).default;
    const rules = await config.headers!();
    const all = rules.find((r) => r.source === "/:path*")!.headers;
    expect(all).toEqual(expect.arrayContaining([{ key: "X-Frame-Options", value: "SAMEORIGIN" }, { key: "Content-Security-Policy", value: "frame-ancestors 'self'" }]));
  });
});
