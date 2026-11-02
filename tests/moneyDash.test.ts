import { describe, expect, it } from "vitest";
import { computeEarnings, type EarnLesson } from "@/lib/earnings";
import { buildMoneyDashboard, shortThb } from "@/lib/moneyDash";

// A small copy of real data (names kept as nicknames only): three package families, three per-class students.
const accounts = [
  { id: "acc-angela", name: "Angela", adjusted: 0 },
  { id: "acc-ipiq", name: "IP & IQ", adjusted: 0 },
  { id: "acc-jn", name: "Jaian & Nivaan", adjusted: 0 },
  { id: "acc-alice", name: "Alice", adjusted: 0 },
  { id: "acc-yina", name: "Yina", adjusted: 0 },
  { id: "acc-george", name: "George", adjusted: 0 },
];
const students = [
  { id: "angela", first_name: "Angela", hour_account_id: "acc-angela" },
  { id: "ip", first_name: "IP", hour_account_id: "acc-ipiq" },
  { id: "iq", first_name: "IQ", hour_account_id: "acc-ipiq" },
  { id: "jaian", first_name: "Jaian", hour_account_id: "acc-jn" },
  { id: "nivaan", first_name: "Nivaan", hour_account_id: "acc-jn" },
  { id: "alice", first_name: "Alice", hour_account_id: "acc-alice", class_price_thb: 1500 },
  { id: "yina", first_name: "Yina", hour_account_id: "acc-yina", class_price_thb: 2000 },
  { id: "george", first_name: "George", hour_account_id: "acc-george", class_price_thb: 1500 },
];
const packages = [
  { id: "p1", hour_account_id: "acc-jn", hours: 24, price_thb: 40800, start_date: "2026-10-29", paid_on: "2026-08-27", hours_used_before: 22.5 },
  { id: "p2", hour_account_id: "acc-ipiq", hours: 24, price_thb: 40800, start_date: "2026-10-25", paid_on: "2026-09-19", hours_used_before: 8 },
  { id: "p3", hour_account_id: "acc-angela", hours: 24, price_thb: 43200, start_date: "2026-10-16", paid_on: "2026-10-01", hours_used_before: 3 },
  { id: "p4", hour_account_id: "acc-jn", hours: 24, price_thb: 60000, start_date: "2026-11-05", paid_on: "2026-11-03", hours_used_before: 0 },
];
let n = 0;
const L = (start: string, hours: number, charged: string[], status = "done"): EarnLesson => {
  const s = new Date(start);
  return { id: `l${++n}`, start_at: s.toISOString(), end_at: new Date(s.getTime() + hours * 3_600_000).toISOString(), status, length_hours: null, charged };
};
const past = [
  L("2026-10-15T18:00:00+07:00", 50 / 60, ["alice"]),
  L("2026-10-20T14:00:00+07:00", 50 / 60, ["george"]),
  L("2026-10-22T15:30:00+07:00", 50 / 60, ["george"]),
  L("2026-10-25T09:00:00+07:00", 50 / 60, ["yina"]),
  L("2026-10-27T18:00:00+07:00", 50 / 60, ["alice"]),
  L("2026-10-30T19:00:00+07:00", 1, ["angela"]),
  L("2026-10-31T11:00:00+07:00", 4, ["ip", "iq"]),
  L("2026-10-31T17:00:00+07:00", 50 / 60, ["alice"]),
  L("2026-11-01T09:00:00+07:00", 50 / 60, ["yina"]),
  L("2026-11-01T10:00:00+07:00", 50 / 60, ["alice"]),
];
const upcoming = [
  L("2026-11-04T16:30:00+07:00", 1.5, ["jaian", "nivaan"], "scheduled"),
  L("2026-11-05T18:00:00+07:00", 50 / 60, ["alice"], "scheduled"),
  L("2026-11-05T19:00:00+07:00", 1, ["angela"], "scheduled"),
  L("2026-11-07T11:00:00+07:00", 4, ["ip", "iq"], "scheduled"),
  L("2026-11-08T09:00:00+07:00", 50 / 60, ["yina"], "scheduled"),
  L("2026-11-09T17:00:00+07:00", 2, ["jaian", "nivaan"], "scheduled"),
  L("2026-11-14T11:00:00+07:00", 4, ["ip", "iq"], "scheduled"),
  L("2026-11-21T11:00:00+07:00", 4, ["ip", "iq"], "scheduled"),
  L("2026-12-02T16:30:00+07:00", 1.5, ["jaian", "nivaan"], "scheduled"),
  L("2026-12-01T11:00:00+07:00", 2, [], "scheduled"), // a calendar event with nobody charged
];
const today = "2026-11-03";
const real = computeEarnings({ accounts, students, packages, lessons: past, upcoming, today });
const d = buildMoneyDashboard({ accounts, students, packages, past, upcoming, accountMoney: real.accounts, today });

describe("money dashboard", () => {
  it("groups families with packages first, then per-class students, each with a fixed colour", () => {
    expect(d.groups.map((g) => [g.name, g.slot])).toEqual([
      ["Angela", 1],
      ["IP & IQ", 2],
      ["Jaian & Nivaan", 3],
      ["Alice", 4],
      ["George", 5],
      ["Yina", 6],
    ]);
  });

  it("works out baht per hour of lesson time", () => {
    const rate = Object.fromEntries(d.groups.map((g) => [g.name, Math.round(g.perHour ?? 0)]));
    expect(rate).toEqual({ Angela: 1800, "IP & IQ": 1700, "Jaian & Nivaan": 2500, Alice: 1800, George: 1800, Yina: 2400 });
  });

  it("counts money in when it's paid (packages) or taught (per class), month by month", () => {
    const m = Object.fromEntries(d.months.map((x) => [x.month, x.received]));
    expect(m["2026-08"]).toBe(40800);
    expect(m["2026-09"]).toBe(40800);
    expect(m["2026-10"]).toBe(43200 + 1500 * 3 + 1500 * 2 + 2000);
    expect(m["2026-11"]).toBe(60000 + 2000 + 1500);
    // expected: booked per-class lessons still to come this month, and IP & IQ's renewal (runs out 21 Nov)
    expect(d.renewals.find((r) => r.name === "IP & IQ")!.date).toBe("2026-11-21");
    expect(d.months.find((x) => x.month === "2026-11")!.expected).toBe(1500 + 2000 + 40800);
  });

  it("splits this week into taught and booked, and leaves calendar events with nobody out", () => {
    const now = d.weeks.find((w) => w.when === "now")!;
    expect(now.start).toBe("2026-11-02");
    expect(Object.values(now.done).reduce((a, b) => a + b, 0)).toBe(0);
    expect(Math.round(Object.values(now.booked).reduce((a, b) => a + b, 0))).toBe(now.total);
    expect(now.classes).toBe(5);
    // starts at the week of the first lesson (12 Oct), not with empty weeks before it; then 8 weeks ahead
    expect(d.weeks[0].start).toBe("2026-10-12");
    expect(d.weeks).toHaveLength(3 + 1 + 8);
  });

  it("this month: earned so far, booked, and lessons still owed from packages", () => {
    expect(d.kpi.monthDone).toBe(3500);
    expect(d.kpi.monthDoneClasses).toBe(2);
    expect(d.kpi.monthBooked).toBeGreaterThan(0);
    expect(d.kpi.owedInLessons).toBeGreaterThan(0);
    expect(d.rows[0].monthDone + d.rows[0].monthBooked).toBeGreaterThanOrEqual(d.rows[1].monthDone + d.rows[1].monthBooked);
  });

  it("lists renewals in date order", () => {
    const dates = d.renewals.map((r) => r.date);
    expect([...dates].sort()).toEqual(dates);
    expect(d.renewals.every((r) => r.amount != null)).toBe(true);
  });

  it("short baht labels for chart axes", () => {
    expect([shortThb(0), shortThb(800), shortThb(1500), shortThb(12000), shortThb(60000)]).toEqual(["฿0", "฿800", "฿1.5k", "฿12k", "฿60k"]);
  });
});
