// What each AI use costs, and when the monthly credit starts again.
// Prices are US dollars per million tokens (from Anthropic's price list, Nov 2026).

export const MODELS = {
  quick: "claude-haiku-5-5", // short writing (parent messages)
  careful: "claude-sonnet-5-5", // reading work and making worksheets
} as const;

const PRICES: Record<string, { input: number; output: number }> = {
  "claude-haiku-5-5": { input: 0.1, output: 0.5 },
  "claude-sonnet-5-5": { input: 2, output: 10 },
  "claude-opus-5-5": { input: 4, output: 20 },
};

export type Usage = {
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
};

/** The cost of one AI use in US dollars. Unknown models are counted at the careful model's price. */
export function costUsd(model: string, u: Usage): number {
  const price = PRICES[model] ?? Object.entries(PRICES).find(([k]) => model.startsWith(k))?.[1] ?? PRICES[MODELS.careful];
  const input = u.input_tokens ?? 0;
  const write = u.cache_creation_input_tokens ?? 0;
  const read = u.cache_read_input_tokens ?? 0;
  const output = u.output_tokens ?? 0;
  // Haiku costs 5 times more when a request is over 100,000 tokens.
  const k = model.includes("haiku") && input + write + read > 100_000 ? 5 : 1;
  return (k * (price.input * (input + write * 1.25 + read * 0.1) + price.output * output)) / 1_000_000;
}

const daysIn = (y: number, m: number) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();

/** When the current month of AI credit started (the credit renews on `day` of each month). */
export function cycleStart(now: Date, day: number): Date {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const here = new Date(Date.UTC(y, m, Math.min(day, daysIn(y, m))));
  if (here <= now) return here;
  const py = m === 0 ? y - 1 : y;
  const pm = m === 0 ? 11 : m - 1;
  return new Date(Date.UTC(py, pm, Math.min(day, daysIn(py, pm))));
}

/** When the credit renews next. */
export function nextCycle(now: Date, day: number): Date {
  const s = cycleStart(now, day);
  const y = s.getUTCMonth() === 11 ? s.getUTCFullYear() + 1 : s.getUTCFullYear();
  const m = (s.getUTCMonth() + 1) % 12;
  return new Date(Date.UTC(y, m, Math.min(day, daysIn(y, m))));
}

export const usd = (n: number) => `$${n < 10 ? n.toFixed(2) : n.toFixed(0)}`;
