import { describe, expect, it } from "vitest";
import { buildMonthlyPrompt, groupByMonth } from "@/lib/monthlyReport";

const L = (month: string, date: string, learned: string | null, topics: string[] = []) => ({ month, monthLabel: month === "2026-10" ? "October 2026" : "September 2026", date, learned, topics, how: "good", homework: null });

describe("monthly report", () => {
  it("groups lessons with notes by month, newest first", () => {
    const m = groupByMonth([L("2026-10", "Wed 28 Oct", "fractions"), L("2026-10", "Mon 26 Oct", null), L("2026-09", "Mon 28 Sep", "decimals")]);
    expect(m.map((x) => [x.key, x.lessons.length])).toEqual([["2026-10", 1], ["2026-09", 1]]);
  });
  it("builds a prompt with only first names and the month's notes", () => {
    const [month] = groupByMonth([L("2026-10", "Wed 28 Oct", "Adding fractions with unlike denominators", ["fractions"]), L("2026-10", "Mon 26 Oct", "Equivalent fractions")]);
    const p = buildMonthlyPrompt({ studentName: "Angela Smith", parentName: "Ms Lee", level: "P5", month, progress: "got it: equivalent fractions", nextPlan: "word problems", hoursLeft: 3, tutorName: "Mr Ken", tone: "warm", allowEmoji: false });
    expect(p).toContain("about Angela (P5) for October 2026");
    expect(p).not.toContain("Smith");
    expect(p).toContain("2 lessons this month");
    expect(p.indexOf("Mon 26 Oct")).toBeLessThan(p.indexOf("Wed 28 Oct")); // oldest first
    expect(p).toContain("Package hours left: 3");
  });
});
