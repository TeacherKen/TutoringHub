import { describe, expect, it } from "vitest";
import { addMinutes, clockQ, CLOCK_LEVELS, hourFromAngle, minutesBetween, minutesFromAngle, words, digital, hourAngle, type ClockLevel } from "@/lib/clock";
import { fewest, fmt, MONEY, shopQ, SHOP_LEVELS, sum, wallet, type Currency, type ShopLevel } from "@/lib/moneyShop";

describe("clock", () => {
  it("says times the way children learn them", () => {
    expect(words({ h: 4, m: 0 })).toBe("4 o'clock");
    expect(words({ h: 4, m: 30 })).toBe("half past 4");
    expect(words({ h: 4, m: 15 })).toBe("quarter past 4");
    expect(words({ h: 4, m: 45 })).toBe("quarter to 5");
    expect(words({ h: 12, m: 45 })).toBe("quarter to 1");
    expect(words({ h: 4, m: 25 })).toBe("25 past 4");
    expect(words({ h: 4, m: 50 })).toBe("10 to 5");
    expect(digital({ h: 4, m: 5 })).toBe("4:05");
  });
  it("adds and counts minutes across the hour and past 12", () => {
    expect(addMinutes({ h: 3, m: 40 }, 35)).toEqual({ h: 4, m: 15 });
    expect(addMinutes({ h: 11, m: 50 }, 20)).toEqual({ h: 12, m: 10 });
    expect(addMinutes({ h: 12, m: 30 }, 45)).toEqual({ h: 1, m: 15 });
    expect(addMinutes({ h: 1, m: 0 }, -10)).toEqual({ h: 12, m: 50 });
    expect(minutesBetween({ h: 3, m: 40 }, { h: 4, m: 15 })).toBe(35);
    expect(minutesBetween({ h: 12, m: 50 }, { h: 1, m: 5 })).toBe(15);
  });
  it("turns dragged hands back into a time", () => {
    expect(minutesFromAngle(268, 15)).toBe(45);
    expect(minutesFromAngle(358, 5)).toBe(0);
    expect(minutesFromAngle(80, 30)).toBe(0);
    expect(minutesFromAngle(160, 30)).toBe(30);
    // At 4:45 the short hand sits near the 5 but means 4.
    expect(hourFromAngle(hourAngle({ h: 4, m: 45 }), 45)).toBe(4);
    expect(hourFromAngle(150, 45)).toBe(4); // pointing right at the 5 still counts as 4 for "quarter to 5"
    expect(hourFromAngle(0, 0)).toBe(12);
    expect(hourFromAngle(355, 30)).toBe(11);
  });
  it("makes sensible questions at every level", () => {
    let seed = 1;
    const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (const level of Object.keys(CLOCK_LEVELS) as ClockLevel[]) {
      for (let i = 0; i < 300; i++) {
        const q = clockQ(level, r);
        if (q.kind === "read" || q.kind === "later") {
          expect(new Set(q.options).size).toBe(q.options.length);
          expect(q.options.length).toBeGreaterThanOrEqual(3);
          expect(q.answer).toBeGreaterThanOrEqual(0);
        }
        if (q.kind === "read" && level === "hour") expect([0, 30]).toContain(q.time.m);
        if (q.kind === "set" && level === "quarter") expect(q.target.m % 15).toBe(0);
        if (q.kind === "later") expect(q.options[q.answer]).toBe(digital(addMinutes(q.start, q.add)));
        if (q.kind === "between") expect(minutesBetween(q.from, q.to)).toBe(q.answer);
        if (level !== "later") expect(["set", "read"]).toContain(q.kind);
      }
    }
  });
});

describe("money shop", () => {
  it("writes money the way it's said", () => {
    expect(fmt(45, "THB")).toBe("฿45");
    expect(fmt(1000, "THB")).toBe("฿1,000");
    expect(fmt(350, "USD")).toBe("$3.50");
    expect(fmt(500, "USD")).toBe("$5");
    expect(fmt(25, "USD")).toBe("25¢");
  });
  it("can always be paid with the money on screen", () => {
    let seed = 7;
    const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (const c of ["THB", "USD"] as Currency[]) {
      for (const level of Object.keys(SHOP_LEVELS) as ShopLevel[]) {
        for (let i = 0; i < 300; i++) {
          const q = shopQ(c, level, r);
          expect(q.target).toBeGreaterThan(0);
          expect(q.total).toBe(sum(q.items.map((x) => x.price)));
          if (q.paid != null) {
            expect(q.paid).toBeGreaterThan(q.total);
            expect(MONEY[c].some((m) => m.kind === "note" && m.value === q.paid)).toBe(true);
          }
          if (c === "THB" && level === "exact") expect(q.total).toBeLessThan(100);
          if (c === "USD" && level === "exact") expect(q.total % 100).toBe(0);
          // The answer can be made from the coins and notes shown.
          const w = wallet(c, q).map((m) => m.value);
          const made = fewest(q.target, c);
          expect(sum(made)).toBe(q.target);
          for (const v of made) expect(w).toContain(v);
        }
      }
    }
  });
});
