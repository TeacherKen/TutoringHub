import { MONEY, type Currency, type Money } from "@/lib/moneyShop";

// 🐷 Piggy Bank Rain (P1–P3): coins and notes fall; tap the right ones to fill the piggy to exactly the amount.

export type PiggyLevel = "small" | "big";
export const PIGGY_LEVELS: Record<PiggyLevel, string> = { small: "Coins only · P1–P2", big: "Coins and notes · P2–P3" };

type Rand = () => number;
const int = (lo: number, hi: number, r: Rand) => lo + Math.floor(r() * (hi - lo + 1));

/** The coins and notes that fall at this level. */
export function piggyMoney(c: Currency, level: PiggyLevel): Money[] {
  if (level === "small") return MONEY[c].filter((m) => m.kind === "coin");
  return MONEY[c].filter((m) => (c === "THB" ? m.value <= 100 : m.value <= 1000));
}

/** How much to put in the piggy. */
export function piggyTarget(c: Currency, level: PiggyLevel, r: Rand = Math.random, prev?: number): number {
  for (let i = 0; i < 10; i++) {
    const t = c === "THB" ? (level === "small" ? int(3, 30, r) : int(25, 180, r)) : level === "small" ? int(5, 75, r) : int(20, 300, r) * 5;
    if (t !== prev) return t;
  }
  return c === "THB" ? 12 : 35;
}

/** What falls next: usually something that fits (so the piggy can always be finished), sometimes a big one to skip. */
export function nextDrop(c: Currency, level: PiggyLevel, left: number, r: Rand = Math.random): number {
  const all = piggyMoney(c, level).map((m) => m.value);
  const fits = all.filter((v) => v <= left);
  if (!fits.length || r() < 0.3) return all[Math.floor(r() * all.length)];
  // Lean towards the biggest that fits, so children learn to grab big ones first.
  return r() < 0.5 ? fits[fits.length - 1] : fits[Math.floor(r() * fits.length)];
}
