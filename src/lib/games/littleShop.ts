import { MONEY, type Currency } from "@/lib/moneyShop";

// 🏪 My Little Shop (P3–P5): run a shop, serve animal customers, give change, earn money, buy upgrades.
// Prices are fixed (a real shop has a price list), so children get to know them. Amounts: baht, or cents.

export type StockItem = { id: string; name: string; emoji: string; thb: number; usd: number; shelf: "snacks" | "drinks" | "toys" };
export const STOCK: StockItem[] = [
  { id: "candy", name: "candy", emoji: "🍬", thb: 5, usd: 25, shelf: "snacks" },
  { id: "eraser", name: "eraser", emoji: "🧽", thb: 8, usd: 40, shelf: "snacks" },
  { id: "banana", name: "banana", emoji: "🍌", thb: 10, usd: 35, shelf: "snacks" },
  { id: "pencil", name: "pencil", emoji: "✏️", thb: 12, usd: 65, shelf: "snacks" },
  { id: "apple", name: "apple", emoji: "🍎", thb: 15, usd: 80, shelf: "snacks" },
  { id: "cookie", name: "cookie", emoji: "🍪", thb: 18, usd: 115, shelf: "snacks" },
  { id: "milk", name: "milk", emoji: "🥛", thb: 22, usd: 125, shelf: "drinks" },
  { id: "juice", name: "juice", emoji: "🧃", thb: 25, usd: 150, shelf: "drinks" },
  { id: "icecream", name: "ice cream", emoji: "🍦", thb: 35, usd: 275, shelf: "drinks" },
  { id: "bubbletea", name: "bubble tea", emoji: "🧋", thb: 55, usd: 450, shelf: "drinks" },
  { id: "kite", name: "kite", emoji: "🪁", thb: 120, usd: 625, shelf: "toys" },
  { id: "car", name: "toy car", emoji: "🚗", thb: 180, usd: 850, shelf: "toys" },
  { id: "ball", name: "football", emoji: "⚽", thb: 290, usd: 1200, shelf: "toys" },
  { id: "teddy", name: "teddy bear", emoji: "🧸", thb: 350, usd: 1500, shelf: "toys" },
];
export const price = (it: StockItem, c: Currency) => (c === "THB" ? it.thb : it.usd);

export type Upgrade = { id: string; name: string; emoji: string; thb: number; usd: number; what: string };
export const UPGRADES: Upgrade[] = [
  { id: "drinks", name: "Drinks fridge", emoji: "🧊", thb: 150, usd: 1000, what: "Sell milk, juice, ice cream and bubble tea" },
  { id: "basket", name: "Big counter", emoji: "🧺", thb: 300, usd: 1500, what: "Customers buy 2 or 3 different things" },
  { id: "toys", name: "Toy shelf", emoji: "🧸", thb: 400, usd: 2500, what: "Sell toys (bigger notes!)" },
  { id: "plant", name: "Plant", emoji: "🪴", thb: 60, usd: 300, what: "Makes the shop pretty" },
  { id: "lights", name: "Fairy lights", emoji: "💡", thb: 90, usd: 500, what: "A cosy glow" },
  { id: "cat", name: "Shop cat", emoji: "🐈", thb: 120, usd: 700, what: "Sleeps on the counter" },
  { id: "music", name: "Music", emoji: "🎵", thb: 150, usd: 900, what: "Happy shop music" },
  { id: "fish", name: "Fish tank", emoji: "🐠", thb: 220, usd: 1200, what: "Customers love it" },
  { id: "sign", name: "Neon sign", emoji: "🌟", thb: 300, usd: 1600, what: "Your shop's name in lights" },
];
export const cost = (u: Upgrade, c: Currency) => (c === "THB" ? u.thb : u.usd);

export const CUSTOMERS = [
  ["🐼", "Panda"],
  ["🐰", "Bunny"],
  ["🐻", "Bear"],
  ["🦊", "Fox"],
  ["🐨", "Koala"],
  ["🐯", "Tiger"],
  ["🐸", "Frog"],
  ["🐵", "Monkey"],
  ["🐧", "Penguin"],
  ["🦁", "Lion"],
] as const;

export type ShopSave = { currency: Currency; money: number; day: number; owned: string[]; served: number; stars: number };
export const newShop = (currency: Currency): ShopSave => ({ currency, money: 0, day: 1, owned: [], served: 0, stars: 0 });
export const PER_DAY = 5;

export type Line = { item: StockItem; qty: number };
export type Order = { who: (typeof CUSTOMERS)[number]; lines: Line[]; total: number; paid: number };

type Rand = () => number;
const int = (lo: number, hi: number, r: Rand) => lo + Math.floor(r() * (hi - lo + 1));

/** The notes a customer might hand over: the smallest that covers it, sometimes the next one up. */
export function customerPays(total: number, c: Currency, r: Rand): number {
  const notes = MONEY[c].filter((m) => m.kind === "note" && m.value > total).map((m) => m.value);
  if (!notes.length) return total;
  return notes.length > 1 && r() < 0.35 ? notes[1] : notes[0];
}

export function nextOrder(s: ShopSave, r: Rand = Math.random): Order {
  const c = s.currency;
  const shelves = new Set(["snacks", ...(s.owned.includes("drinks") ? ["drinks"] : []), ...(s.owned.includes("toys") ? ["toys"] : [])]);
  const pool = STOCK.filter((it) => shelves.has(it.shelf));
  const biggest = MONEY[c].at(-1)!.value;
  for (let tries = 0; tries < 50; tries++) {
    const kinds = s.owned.includes("basket") && r() < 0.7 ? int(2, 3, r) : 1;
    const picked = [...pool].sort(() => r() - 0.5).slice(0, kinds);
    const lines = picked.map((item) => ({ item, qty: price(item, c) * 3 < biggest / 4 && s.day > 1 && r() < 0.4 ? int(2, 3, r) : 1 }));
    const total = lines.reduce((t, l) => t + price(l.item, c) * l.qty, 0);
    if (total >= biggest) continue;
    return { who: CUSTOMERS[Math.floor(r() * CUSTOMERS.length)], lines, total, paid: customerPays(total, c, r) };
  }
  const item = pool[0];
  return { who: CUSTOMERS[0], lines: [{ item, qty: 1 }], total: price(item, c), paid: customerPays(price(item, c), c, r) };
}

/** Stars for one customer: right first time and quick = 3. */
export const starsFor = (tries: number, secs: number) => (tries === 1 ? (secs <= 20 ? 3 : 2) : 1);
/** A tip for great service (3 stars): about a tenth of the sale, at least the smallest coin. */
export function tipFor(stars: number, total: number, c: Currency): number {
  if (stars < 3) return 0;
  const step = c === "THB" ? 1 : 5;
  return Math.max(step, Math.round(total / 10 / step) * step);
}
