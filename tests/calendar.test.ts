import { describe, expect, it } from "vitest";
import { parseOccurrences } from "@/lib/calendar/parse";
import { matchStudents, isPreplyTitle } from "@/lib/calendar/match";
import { fmtTime, bkkDateKey } from "@/lib/time";
import { validateCalendarUrl } from "@/lib/calendar/sync";

// Weekly Wednesday 17:00–18:00 Bangkok lesson, starting Wed 7 Oct 2026.
// - 14 Oct is deleted (EXDATE)
// - 21 Oct is moved to 18:30–19:30 (RECURRENCE-ID override)
// Plus: a one-off Saturday lesson, a cancelled one-off, and an all-day event.
const ICS = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Google Inc//Google Calendar 70.9054//EN
BEGIN:VTIMEZONE
TZID:Asia/Bangkok
BEGIN:STANDARD
TZOFFSETFROM:+0700
TZOFFSETTO:+0700
TZNAME:+07
DTSTART:19700101T000000
END:STANDARD
END:VTIMEZONE
BEGIN:VEVENT
UID:weekly-1@google.com
DTSTART;TZID=Asia/Bangkok:20261007T170000
DTEND;TZID=Asia/Bangkok:20261007T180000
RRULE:FREQ=WEEKLY;BYDAY=WE
EXDATE;TZID=Asia/Bangkok:20261014T170000
SUMMARY:Jaian & Nivaan maths
LOCATION:Nana
END:VEVENT
BEGIN:VEVENT
UID:weekly-1@google.com
RECURRENCE-ID;TZID=Asia/Bangkok:20261021T170000
DTSTART;TZID=Asia/Bangkok:20261021T183000
DTEND;TZID=Asia/Bangkok:20261021T193000
SUMMARY:Jaian & Nivaan maths (moved)
LOCATION:Nana
END:VEVENT
BEGIN:VEVENT
UID:single-1@google.com
DTSTART:20261024T040000Z
DTEND:20261024T080000Z
SUMMARY:IP and IQ
END:VEVENT
BEGIN:VEVENT
UID:cancelled-1@google.com
DTSTART:20261025T020000Z
DTEND:20261025T030000Z
STATUS:CANCELLED
SUMMARY:Yina
END:VEVENT
BEGIN:VEVENT
UID:allday-1@google.com
DTSTART;VALUE=DATE:20261023
DTEND;VALUE=DATE:20261024
SUMMARY:Chulalongkorn Day
END:VEVENT
END:VCALENDAR`;

const from = new Date("2026-10-01T00:00:00Z");
const to = new Date("2026-11-01T00:00:00Z");

describe("calendar parsing", () => {
  const occ = parseOccurrences(ICS, from, to);
  const weekly = occ.filter((o) => o.uid === "weekly-1@google.com");

  it("expands the weekly lesson, skipping the deleted week", () => {
    expect(weekly.map((o) => bkkDateKey(o.start))).toEqual(["2026-10-07", "2026-10-21", "2026-10-28"]);
  });

  it("shows times in Bangkok time", () => {
    expect(fmtTime(weekly[0].start)).toBe("17:00");
    expect(fmtTime(weekly[0].end)).toBe("18:00");
  });

  it("uses the moved time for the changed week but keeps its original id", () => {
    const moved = weekly[1];
    expect(fmtTime(moved.start)).toBe("18:30");
    expect(moved.title).toContain("moved");
    expect(moved.key).toBe(new Date("2026-10-21T10:00:00Z").toISOString());
  });

  it("keeps one-off lessons with a stable id", () => {
    const single = occ.find((o) => o.uid === "single-1@google.com")!;
    expect(single.key).toBe("single");
    expect(fmtTime(single.start)).toBe("11:00");
  });

  it("drops cancelled and all-day events", () => {
    expect(occ.find((o) => o.uid === "cancelled-1@google.com")).toBeUndefined();
    expect(occ.find((o) => o.uid === "allday-1@google.com")).toBeUndefined();
  });

  it("has exactly the expected lessons", () => {
    expect(occ.length).toBe(4);
  });
});

describe("matching lessons to students", () => {
  const students = [
    { id: "j", keywords: ["Jaian"] },
    { id: "n", keywords: ["Nivaan"] },
    { id: "ip", keywords: ["IP"] },
    { id: "a", keywords: ["Alice", "Alice Prep"] },
  ];

  it("matches siblings in one lesson", () => {
    expect(matchStudents("Jaian & Nivaan maths", students).sort()).toEqual(["j", "n"]);
  });
  it("is not fooled by part of a word", () => {
    expect(matchStudents("Shipping", students)).toEqual([]);
    expect(matchStudents("IP and IQ", students)).toEqual(["ip"]);
  });
  it("ignores capital letters", () => {
    expect(matchStudents("alice prep (online)", students)).toEqual(["a"]);
  });
  it("finds Preply lessons", () => {
    expect(isPreplyTitle("Lesson with Alice - Preply")).toBe(true);
    expect(isPreplyTitle("Alice maths")).toBe(false);
  });
});


describe("calendar link check", () => {
  it("accepts Google's secret iCal address", () => {
    expect(validateCalendarUrl("https://calendar.google.com/calendar/ical/abc%40gmail.com/private-123/basic.ics")).toBeTruthy();
    expect(validateCalendarUrl("webcal://calendar.google.com/calendar/ical/abc/private-1/basic.ics")).toMatch(/^https:/);
    expect(validateCalendarUrl("https://preply.com/en/calendar/ical/abc123.ics")).toBeTruthy();
  });
  it("rejects anything else", () => {
    for (const bad of [
      "https://evil.com/calendar/ical/x/basic.ics",
      "https://calendar.google.com.evil.com/calendar/ical/x/basic.ics",
      "https://preply.com.evil.com/a.ics",
      "http://preply.com/a.ics",
      "https://www.google.com/url?q=https://evil.com/a.ics",
      "http://calendar.google.com/calendar/ical/x/basic.ics",
      "https://calendar.google.com/calendar/embed?src=x",
      "not a link",
    ]) {
      expect(validateCalendarUrl(bad)).toBeNull();
    }
  });
});
