import { describe, expect, it } from "vitest";
import { computeEarnings, forecast, renewSoon, sumEarned, type EarnLesson } from "@/lib/earnings";

const L = (id: string, start: string, ids: string[], status = "done", len: number | null = null): EarnLesson => ({
  id,
  start_at: start,
  end_at: new Date(new Date(start).getTime() + 3_600_000).toISOString(),
  status,
  length_hours: len,
  charged: ids,
});

const students = [
  { id: "j", first_name: "Jaian", hour_account_id: "A" },
  { id: "n", first_name: "Nivaan", hour_account_id: "A" },
  { id: "g", first_name: "George", hour_account_id: "G", hourly_rate_thb: 600 },
  { id: "y", first_name: "Yina", hour_account_id: "Y" },
];
const accounts = [
  { id: "A", name: "Jaian & Nivaan", adjusted: 0 },
  { id: "G", name: "George", adjusted: 0 },
  { id: "Y", name: "Yina", adjusted: 0 },
];

describe("earnings", () => {
  it("values package classes at the package's price per hour, oldest package first", () => {
    const r = computeEarnings({
      accounts,
      students,
      packages: [
        { id: "p1", hour_account_id: "A", hours: 2, price_thb: 6000, start_date: "2026-10-01" }, // ฿3,000/h
        { id: "p2", hour_account_id: "A", hours: 10, price_thb: 25000, start_date: "2026-10-20" }, // ฿2,500/h
      ],
      lessons: [
        L("1", "2026-10-05T10:00:00Z", ["j", "n"], "done", 1.5), // siblings together: counted once
        L("2", "2026-10-12T10:00:00Z", ["j"], "done", 1), // 0.5 h from p1 + 0.5 h from p2
        L("3", "2026-10-14T10:00:00Z", ["j"], "cancelled", 1), // not charged
      ],
      upcoming: [],
      today: "2026-10-30",
    });
    expect(r.lessons.map((l) => [l.id, l.value])).toEqual([
      ["1", 4500],
      ["2", 2750],
    ]);
    const a = r.accounts.find((x) => x.id === "A")!;
    expect(a.packages.map((p) => [p.state, p.usedHours, p.usedValue])).toEqual([
      ["used", 2, 6000],
      ["current", 0.5, 1250],
    ]);
    expect(a.leftHours).toBe(9.5);
    expect(a.leftValue).toBe(23750);
    expect(a.earned).toBe(7250);
  });

  it("uses price per hour for students without a package, and flags classes with no price", () => {
    const r = computeEarnings({
      accounts,
      students,
      packages: [],
      lessons: [L("g1", "2026-10-28T10:00:00Z", ["g"]), L("y1", "2026-10-28T12:00:00Z", ["y"])],
      upcoming: [],
      today: "2026-10-30",
    });
    expect(r.lessons.find((l) => l.id === "g1")?.value).toBe(600);
    expect(r.lessons.find((l) => l.id === "y1")).toMatchObject({ value: null, unpriced: ["Yina"] });
  });

  it("adds up this week and this month", () => {
    const r = computeEarnings({
      accounts,
      students,
      packages: [],
      lessons: [L("a", "2026-10-26T10:00:00Z", ["g"]), L("b", "2026-10-29T10:00:00Z", ["g"], "done", 2), L("c", "2026-10-05T10:00:00Z", ["g"])],
      upcoming: [],
      today: "2026-10-30",
    });
    expect(sumEarned(r.lessons, "2026-10-26", "2026-11-02")).toEqual({ value: 1800, hours: 3, classes: 2 });
    expect(sumEarned(r.lessons, "2026-10-01", "2026-11-01").value).toBe(2400);
  });
});

describe("package forecast", () => {
  const weekly = (n: number, from: string) => Array.from({ length: n }, (_, i) => L(`u${i}`, new Date(new Date(from).getTime() + i * 7 * 86_400_000).toISOString(), ["j"], "scheduled", 1.5));

  it("uses the calendar when it has enough lessons", () => {
    const f = forecast(4.5, ["j"], [], weekly(6, "2026-11-02T10:00:00Z"), "2026-10-30");
    expect(f).toEqual({ lessonsLeft: 3, endDate: "2026-11-16", basis: "calendar" });
  });

  it("carries on at the usual weekly pace after the calendar ends", () => {
    const past = [L("p1", "2026-10-05T10:00:00Z", ["j"], "done", 1.5), L("p2", "2026-10-12T10:00:00Z", ["j"], "done", 1.5), L("p3", "2026-10-19T10:00:00Z", ["j"], "done", 1.5), L("p4", "2026-10-26T10:00:00Z", ["j"], "done", 1.5)];
    const f = forecast(9, ["j"], past, weekly(2, "2026-11-02T10:00:00Z"), "2026-10-30");
    // 2 lessons in the calendar (3 h), then 6 h left at 1.5 h a week = 4 more weeks after 9 Nov.
    expect(f).toEqual({ lessonsLeft: 6, endDate: "2026-12-07", basis: "average" });
  });

  it("reminds a set number of weeks before the end", () => {
    const base = { id: "A", name: "A", studentIds: ["j"], packages: [{ id: "p", hours: 12, price: 1, rate: 1, usedHours: 1, usedValue: 1, startDate: "2026-10-01", state: "current" as const }], bought: 12, leftValue: 1, earned: 1, paid: 1 };
    expect(renewSoon({ ...base, leftHours: 6, forecast: { lessonsLeft: 4, endDate: "2026-11-10", basis: "calendar" } }, "2026-10-30", 2, 2)).toBe(true);
    expect(renewSoon({ ...base, leftHours: 6, forecast: { lessonsLeft: 4, endDate: "2026-11-30", basis: "calendar" } }, "2026-10-30", 2, 2)).toBe(false);
    expect(renewSoon({ ...base, leftHours: 1.5, forecast: { lessonsLeft: 1, endDate: "2026-12-30", basis: "average" } }, "2026-10-30", 2, 2)).toBe(true);
  });
});

import { nextReceiptNo } from "@/lib/receipts";
describe("receipt numbers", () => {
  it("count up within the year and start again next year", () => {
    expect(nextReceiptNo([], 2026)).toBe("R-2026-001");
    expect(nextReceiptNo(["R-2026-001", "R-2026-009", "R-2025-120", null], 2026)).toBe("R-2026-010");
    expect(nextReceiptNo(["R-2026-041"], 2027)).toBe("R-2027-001");
  });
});

describe("packages that started before the app, and Preply prices per class", () => {
  it("counts hours already used, and values earlier classes without using hours twice", () => {
    const r = computeEarnings({
      accounts,
      students,
      packages: [{ id: "p", hour_account_id: "A", hours: 24, price_thb: 40800, start_date: "2026-10-29", paid_on: "2026-08-27", hours_used_before: 22.5 }],
      lessons: [
        L("old", "2026-10-28T10:00:00Z", ["j"], "done", 1.5), // already inside the 22.5 h
        L("new", "2026-11-02T10:00:00Z", ["j"], "done", 1.5), // the last 1.5 h
      ],
      upcoming: [],
      today: "2026-11-02",
    });
    const a = r.accounts.find((x) => x.id === "A")!;
    expect(a.leftHours).toBe(0);
    expect(a.packages[0]).toMatchObject({ usedHours: 24, usedValue: 40800, state: "used" });
    expect(r.lessons.map((l) => [l.id, l.value])).toEqual([
      ["old", 2550],
      ["new", 2550],
    ]);
  });

  it("uses a flat price per class for Preply students", () => {
    const r = computeEarnings({
      accounts,
      students: [{ id: "a", first_name: "Alice", hour_account_id: "AL", class_price_thb: 1500 }],
      packages: [],
      lessons: [L("p1", "2026-10-31T10:00:00Z", ["a"], "done", 0.75)],
      upcoming: [],
      today: "2026-10-31",
    });
    expect(r.lessons[0].value).toBe(1500);
  });
});
