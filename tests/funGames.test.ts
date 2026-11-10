import { describe, expect, it } from "vitest";
import { nextDrop, piggyMoney, piggyTarget } from "@/lib/games/piggy";
import { newShop, nextOrder, price, starsFor as shopStars, tipFor, UPGRADES, STOCK } from "@/lib/games/littleShop";
import { HEARTS, longQ, newQuest, questQ, stageKey, stageOpen, starsFor, story, TOWNS, townOpen } from "@/lib/games/clockQuest";
import { timeJumps, duration } from "@/lib/clock";
import type { Currency } from "@/lib/moneyShop";

const seeded = (s: number) => () => ((s = (s * 16807) % 2147483647) / 2147483647);

describe("piggy bank rain", () => {
  it("targets fit the level and the piggy can always be filled exactly", () => {
    const r = seeded(3);
    for (const c of ["THB", "USD"] as Currency[])
      for (const level of ["small", "big"] as const)
        for (let i = 0; i < 200; i++) {
          const t = piggyTarget(c, level, r);
          if (c === "THB" && level === "small") expect(t).toBeLessThanOrEqual(30);
          let left = t;
          let guard = 0;
          while (left > 0 && guard++ < 500) {
            const v = nextDrop(c, level, left, r);
            if (v <= left) left -= v;
          }
          expect(left).toBe(0);
          expect(piggyMoney(c, level).length).toBeGreaterThan(2);
        }
  });
});

describe("my little shop", () => {
  it("orders use only shelves the shop owns, and change comes from one note", () => {
    const r = seeded(5);
    for (const c of ["THB", "USD"] as Currency[]) {
      const s = newShop(c);
      for (let i = 0; i < 200; i++) {
        const o = nextOrder(s, r);
        expect(o.lines.every((l) => l.item.shelf === "snacks")).toBe(true);
        expect(o.lines).toHaveLength(1);
        expect(o.paid).toBeGreaterThan(o.total);
      }
      const rich = { ...s, day: 4, owned: UPGRADES.map((u) => u.id) };
      for (let i = 0; i < 200; i++) {
        const o = nextOrder(rich, r);
        expect(o.total).toBe(o.lines.reduce((t, l) => t + price(l.item, c) * l.qty, 0));
        expect(o.paid).toBeGreaterThan(o.total);
      }
    }
    expect(STOCK.every((it) => it.thb > 0 && it.usd > 0)).toBe(true);
    expect(shopStars(1, 10)).toBe(3);
    expect(shopStars(2, 5)).toBe(1);
    expect(tipFor(3, 55, "THB")).toBe(6);
    expect(tipFor(2, 55, "THB")).toBe(0);
  });
});

describe("clock tower quest", () => {
  it("opens towns and monsters in order", () => {
    const s = newQuest("🧙");
    expect(townOpen(s, 0)).toBe(true);
    expect(stageOpen(s, 0, 1)).toBe(false);
    expect(townOpen(s, 1)).toBe(false);
    const beat = { ...s, stars: { [stageKey(0, 0)]: 3, [stageKey(0, 1)]: 1, [stageKey(0, 2)]: 2 } };
    expect(townOpen(beat, 1)).toBe(true);
    expect(stageOpen(beat, 1, 0)).toBe(true);
    expect(starsFor(HEARTS)).toBe(3);
    expect(starsFor(1)).toBe(1);
  });
  it("makes castle questions with the right answer in the options", () => {
    const r = seeded(9);
    for (let i = 0; i < 300; i++) {
      const q = longQ(r);
      expect(q.options[q.answer]).toBe(duration(timeJumps(q.from, q.to).total));
      expect(new Set(q.options).size).toBe(q.options.length);
      expect(q.options.length).toBeGreaterThanOrEqual(3);
    }
    for (const t of TOWNS) for (let i = 0; i < 30; i++) expect(story(questQ(t.level, r), t, r).length).toBeGreaterThan(10);
  });
});

describe("Clock Tower Quest heroes", () => {
  it("swaps old emoji heroes for drawn ones", async () => {
    const { heroOf, heroImage, HEROES } = await import("@/lib/games/clockQuest");
    expect(heroOf("k:robot")).toBe("k:robot");
    expect(HEROES).toContain(heroOf("🧙"));
    expect(HEROES).toContain(heroOf("🧑‍🚀"));
    expect(heroOf("anything else")).toBe(HEROES[0]);
    expect(heroImage("🧝", "hurt")).toMatch(/^\/games\/art\/heroes\/\w+_hurt\.png$/);
  });
});
