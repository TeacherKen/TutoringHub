import { describe, expect, it } from "vitest";
import { nextMilestone, summarise, type PreplyStats } from "@/lib/preply";

const row = (id: string, income: number, lessons: number): PreplyStats => ({
  student_id: id, account_name: null, plan: "subscription", lesson_price_usd: 60, list_price_usd: 80, income_usd: income, lessons, months: 3,
  per_four_weeks: 4, booked: 0, booked_of: 2, renews_on: null, as_of: "2026-11-05", updated_at: "2026-11-05T05:00:00Z",
});

describe("🟣 Preply card", () => {
  it("adds up, sorts the top earner first and works out each share", () => {
    const s = summarise([row("g", 315, 8), row("a", 5761.8, 130), row("y", 120, 3)], new Map([["a", "Alice"], ["g", "George"], ["y", "Yina"]]), new Map([["a", 2]]));
    expect(s.income).toBeCloseTo(6196.8);
    expect(s.rows.map((r) => r.name)).toEqual(["Alice", "George", "Yina"]);
    expect(Math.round(s.rows[0].share * 100)).toBe(93);
    expect(s.rows[0].lessonsNow).toBe(132); // 130 from Preply + 2 marked done since
    expect(s.lessons).toBe(143);
  });
  it("next lesson milestone: Alice at 130 with 8 every 4 weeks is 20 away, about 10 weeks", () => {
    expect(nextMilestone(130, 8)).toEqual({ at: 150, left: 20, weeks: 10 });
    expect(nextMilestone(8, 4)).toEqual({ at: 10, left: 2, weeks: 2 });
    expect(nextMilestone(150, null)).toEqual({ at: 200, left: 50, weeks: null });
  });
});
