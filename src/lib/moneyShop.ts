// 🛒 Money Shop: the maths behind it (no drawing here, so it can be tested).
// All amounts are whole numbers in the smallest unit: baht for ฿, cents for $ (so $1.25 is 125).

export type Currency = "THB" | "USD";
export type ShopLevel = "exact" | "exact-big" | "change" | "basket";

export const SHOP_LEVELS: Record<ShopLevel, string> = {
  exact: "Pay the exact price · P2",
  "exact-big": "Bigger prices · P2–P3",
  change: "Give the change · P3–P4",
  basket: "Shopping basket + change · P4–P5",
};

export type Money = { value: number; kind: "coin" | "note" };

/** Thai coins and notes (no satang), and US dollars and cents. */
export const MONEY: Record<Currency, Money[]> = {
  THB: [
    { value: 1, kind: "coin" },
    { value: 2, kind: "coin" },
    { value: 5, kind: "coin" },
    { value: 10, kind: "coin" },
    { value: 20, kind: "note" },
    { value: 50, kind: "note" },
    { value: 100, kind: "note" },
    { value: 500, kind: "note" },
    { value: 1000, kind: "note" },
  ],
  USD: [
    { value: 1, kind: "coin" },
    { value: 5, kind: "coin" },
    { value: 10, kind: "coin" },
    { value: 25, kind: "coin" },
    { value: 100, kind: "note" },
    { value: 500, kind: "note" },
    { value: 1000, kind: "note" },
    { value: 2000, kind: "note" },
  ],
};

/** "฿45", "$3.50", "25¢". */
export function fmt(amount: number, c: Currency): string {
  if (c === "THB") return `฿${amount.toLocaleString("en-US")}`;
  if (amount < 100 && amount > 0) return `${amount}¢`;
  return `$${(amount / 100).toFixed(amount % 100 ? 2 : 0)}`;
}

/** What's printed on a coin or note: "10", "฿100", "25¢", "$5". */
export const face = (m: Money, c: Currency) => (c === "THB" ? (m.kind === "note" ? `฿${m.value}` : String(m.value)) : fmt(m.value, c));

type Item = { name: string; img: string; thb: [number, number]; usd: [number, number] };
// 🛡️ The adventure market: gear and food for adventurers (pictures: Kenney Voxel Pack, CC0).
// Price ranges: baht in baht, dollars in cents.
const ITEM = (k: string) => `/games/art/items/${k}.png`;
const ITEMS: Item[] = [
  { name: "apple", img: ITEM("apple"), thb: [5, 15], usd: [25, 95] },
  { name: "magic seed", img: ITEM("seed"), thb: [5, 12], usd: [20, 75] },
  { name: "wheat", img: ITEM("wheat"), thb: [8, 20], usd: [40, 120] },
  { name: "sea shell", img: ITEM("shell"), thb: [5, 15], usd: [25, 80] },
  { name: "grilled fish", img: ITEM("fish"), thb: [10, 25], usd: [50, 150] },
  { name: "bucket of water", img: ITEM("water"), thb: [12, 30], usd: [75, 225] },
  { name: "roast meat", img: ITEM("meat"), thb: [15, 45], usd: [125, 350] },
  { name: "bowl of stew", img: ITEM("stew"), thb: [35, 79], usd: [275, 575] },
  { name: "torch", img: ITEM("torch"), thb: [20, 59], usd: [150, 450] },
  { name: "arrows", img: ITEM("arrow"), thb: [15, 49], usd: [100, 350] },
  { name: "slingshot", img: ITEM("slingshot"), thb: [25, 69], usd: [200, 500] },
  { name: "cooking pot", img: ITEM("pot"), thb: [40, 99], usd: [300, 700] },
  { name: "shovel", img: ITEM("shovel"), thb: [60, 250], usd: [350, 1200] },
  { name: "fishing rod", img: ITEM("fishingpole"), thb: [60, 199], usd: [350, 1000] },
  { name: "pickaxe", img: ITEM("pickaxe"), thb: [95, 295], usd: [499, 1499] },
  { name: "axe", img: ITEM("axe"), thb: [95, 295], usd: [499, 1499] },
  { name: "hammer", img: ITEM("hammer"), thb: [80, 260], usd: [450, 1300] },
  { name: "bow", img: ITEM("bow"), thb: [120, 399], usd: [700, 1800] },
  { name: "iron sword", img: ITEM("sword"), thb: [150, 450], usd: [800, 1900] },
  { name: "ruby", img: ITEM("ruby"), thb: [120, 399], usd: [700, 1800] },
  { name: "emerald", img: ITEM("emerald"), thb: [150, 450], usd: [800, 1900] },
  { name: "gold sword", img: ITEM("goldsword"), thb: [250, 890], usd: [1200, 1999] },
  { name: "diamond", img: ITEM("diamond"), thb: [250, 890], usd: [1200, 1999] },
  { name: "diamond sword", img: ITEM("diamondsword"), thb: [300, 950], usd: [1300, 1999] },
  { name: "boat", img: ITEM("boat"), thb: [400, 990], usd: [1500, 1999] },
];

export type ShopItem = { name: string; img: string; price: number };
export type ShopQ = { items: ShopItem[]; total: number; paid: number | null; target: number };

type Rand = () => number;
const int = (lo: number, hi: number, r: Rand) => lo + Math.floor(r() * (hi - lo + 1));

function priceFor(item: Item, c: Currency, level: ShopLevel, r: Rand): number {
  const [lo, hi] = c === "THB" ? item.thb : item.usd;
  if (c === "THB") return int(lo, hi, r);
  // Easiest level: whole dollars only. Then 5¢ steps (never fiddly 1¢ amounts until the basket).
  if (level === "exact") return Math.max(100, Math.round(int(lo, hi, r) / 100) * 100);
  const step = level === "basket" ? 1 : 5;
  return Math.max(step, Math.round(int(lo, hi, r) / step) * step);
}

/** Which items suit a level (small prices for the first level, so P2 children count small amounts). */
function itemsFor(c: Currency, level: ShopLevel): Item[] {
  const max = c === "THB" ? (level === "exact" ? 99 : 999) : 2000;
  const min = c === "USD" && level === "exact" ? 100 : 0;
  return ITEMS.filter((i) => (c === "THB" ? i.thb[0] : i.usd[0]) <= max && (c === "THB" ? i.thb[1] : i.usd[1]) >= min);
}

/** The smallest note that pays for the total (a ฿37 snack is paid with ฿50 or ฿100; a $3.40 one with $5). */
export function payWith(total: number, c: Currency, r: Rand = Math.random): number {
  const notes = MONEY[c].filter((m) => m.kind === "note" && m.value > total).map((m) => m.value);
  if (!notes.length) return total;
  // Sometimes the next note up, for bigger change (but never more than 5× the price for the youngest).
  return notes.length > 1 && r() < 0.35 && notes[1] <= total * 10 ? notes[1] : notes[0];
}

export function shopQ(c: Currency, level: ShopLevel, r: Rand = Math.random, prev?: ShopQ | null): ShopQ {
  for (let tries = 0; tries < 20; tries++) {
    const q = makeShopQ(c, level, r);
    if (!prev || q.total !== prev.total || q.items[0].name !== prev.items[0].name) return q;
  }
  return makeShopQ(c, level, r);
}

function makeShopQ(c: Currency, level: ShopLevel, r: Rand): ShopQ {
  const pool = itemsFor(c, level);
  const count = level === "basket" ? int(2, 3, r) : 1;
  const chosen: ShopItem[] = [];
  const used = new Set<string>();
  while (chosen.length < count) {
    const it = pool[Math.floor(r() * pool.length)];
    if (used.has(it.name)) continue;
    used.add(it.name);
    let price = priceFor(it, c, level, r);
    if (c === "THB" && level === "exact") price = Math.min(price, 99);
    chosen.push({ name: it.name, img: it.img, price });
  }
  const total = chosen.reduce((s, i) => s + i.price, 0);
  // Change is always from one note, so the basket must cost less than the biggest note.
  const biggest = MONEY[c].at(-1)!.value;
  if (level !== "exact" && level !== "exact-big" && total >= biggest) return makeShopQ(c, level, r);
  if (level === "exact" || level === "exact-big") return { items: chosen, total, paid: null, target: total };
  const paid = payWith(total, c, r);
  return { items: chosen, total, paid, target: paid - total };
}

/** The coins and notes a child may use: to pay, all of them; for change, only ones smaller than the note paid. */
export function wallet(c: Currency, q: ShopQ): Money[] {
  const all = MONEY[c];
  const limit = q.paid ?? Infinity;
  return all.filter((m) => m.value < limit && (q.paid != null || m.value <= Math.max(q.total * 2, all[0].value)));
}

export const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);

/** Fewest coins and notes for an amount (to show "one way" after a wrong try). */
export function fewest(amount: number, c: Currency): number[] {
  const out: number[] = [];
  let left = amount;
  for (const m of [...MONEY[c]].reverse()) {
    while (left >= m.value) {
      out.push(m.value);
      left -= m.value;
    }
  }
  return out;
}

export function shopHint(q: ShopQ, given: number, c: Currency): string {
  const need = q.target;
  if (given > need) return `That's ${fmt(given, c)}, which is ${fmt(given - need, c)} too much. Tap money in the tray to take it back.`;
  if (given < need) return `That's ${fmt(given, c)}. You need ${fmt(need - given, c)} more.`;
  return "";
}

/** "Change" questions: how to say it. */
export function changeHint(q: ShopQ, c: Currency): string {
  if (q.paid == null) return "";
  return `Count up from ${fmt(q.total, c)} to ${fmt(q.paid, c)}. That gap is the change.`;
}
