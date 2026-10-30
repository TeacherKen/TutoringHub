// Mr Ken's price list (Settings), used in renewal messages, PromptPay QR codes and new packages.
export type PriceOption = { id: string; label: string; hours: number; price: number };

export function cleanPriceOptions(raw: unknown): PriceOption[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((o) => {
      const r = (o ?? {}) as Record<string, unknown>;
      const hours = Number(r.hours);
      const price = Number(r.price);
      const id = typeof r.id === "string" && /^[\w-]{1,40}$/.test(r.id) ? r.id : Math.random().toString(36).slice(2, 10);
      const label = typeof r.label === "string" ? r.label.trim().slice(0, 40) : "";
      return { id, label, hours, price };
    })
    .filter((o) => o.hours > 0 && o.hours <= 500 && o.price >= 0 && o.price <= 10_000_000)
    .slice(0, 12);
}

export const optionText = (o: { hours: number; price: number; label?: string }) =>
  `${o.label ? `${o.label}: ` : ""}${Math.round(o.hours * 100) / 100} ${o.hours === 1 ? "hour" : "hours"} for ฿${Math.round(o.price).toLocaleString("en-US")}`;
