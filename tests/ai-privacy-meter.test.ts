import { describe, expect, it } from "vitest";
import { makeHider, showAll } from "@/lib/hideNames";
import { costUsd, cycleStart, nextCycle } from "@/lib/aiCost";

describe("hiding names from the AI", () => {
  const h = makeHider({
    students: [{ name: "Alice" }, { name: "IP" }, { name: "IQ" }, { name: "Yina" }],
    parents: [{ name: "Chloe L." }, { name: "Ms Gloy" }],
  });

  it("swaps every way a name is written", () => {
    expect(h.hide("Alice Prep #52 · Alice's work")).toBe("{child1} Prep #52 · {child1}'s work");
    expect(h.hide("Dear Ms Gloy, IP and IQ did well. Hi Chloe!")).toBe("Dear {parent2}, {child2} and {child3} did well. Hi {parent1}!");
    expect(h.hide("ALICE and alice")).toBe("{child1} and {child1}");
  });

  it("leaves ordinary words alone", () => {
    // short names only match in capitals, and never inside a word
    expect(h.hide("tip: equip the zip; iq test")).toBe("tip: equip the zip; iq test");
    expect(h.hide("Malice and Yinai")).toBe("Malice and Yinai");
  });

  it("puts the names back, even with small spacing changes", () => {
    expect(h.show("Dear {parent2}, { child4 } and {CHILD1} did well.")).toBe("Dear Ms Gloy, Yina and Alice did well.");
    expect(h.show("{child9} stays as it is")).toBe("{child9} stays as it is");
    expect(showAll({ a: ["{child1}"], b: { c: "{parent1}" }, n: 3 }, h)).toEqual({ a: ["Alice"], b: { c: "Chloe L." }, n: 3 });
  });
});

describe("the AI meter", () => {
  it("counts the cost of each model", () => {
    expect(costUsd("claude-haiku-5-5", { input_tokens: 50_000, output_tokens: 50_000 })).toBeCloseTo(0.03, 6);
    expect(costUsd("claude-sonnet-5-5", { input_tokens: 10_000, output_tokens: 4_000 })).toBeCloseTo(0.06, 6);
    // Haiku is 5 times dearer for very long requests
    expect(costUsd("claude-haiku-5-5", { input_tokens: 200_000 })).toBeCloseTo(0.1, 6);
    // an unknown model is counted at the careful model's price, never as free
    expect(costUsd("claude-new-thing", { output_tokens: 1000 })).toBeCloseTo(0.01, 6);
  });

  it("knows when the monthly credit started and when it renews", () => {
    expect(cycleStart(new Date("2026-11-01T03:00:00Z"), 28).toISOString().slice(0, 10)).toBe("2026-10-28");
    expect(cycleStart(new Date("2026-11-28T00:00:00Z"), 28).toISOString().slice(0, 10)).toBe("2026-11-28");
    expect(cycleStart(new Date("2027-01-05T00:00:00Z"), 28).toISOString().slice(0, 10)).toBe("2026-12-28");
    expect(nextCycle(new Date("2026-11-01T03:00:00Z"), 28).toISOString().slice(0, 10)).toBe("2026-11-28");
    expect(nextCycle(new Date("2026-12-30T03:00:00Z"), 28).toISOString().slice(0, 10)).toBe("2027-01-28");
    // a day that some months don't have
    expect(cycleStart(new Date("2027-03-05T00:00:00Z"), 31).toISOString().slice(0, 10)).toBe("2027-02-28");
  });
});
