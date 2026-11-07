import "server-only";

// 💱 US dollars → Thai baht for the Preply card. Today's rate from a free public feed, checked twice a day;
// if it can't be reached, a recent typical rate is used (and the card says it's approximate).

const FALLBACK = 33;

export async function usdToThb(): Promise<{ rate: number; live: boolean }> {
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD", { next: { revalidate: 43200 }, signal: AbortSignal.timeout(3000) });
    if (!res.ok) throw new Error(String(res.status));
    const j = (await res.json()) as { rates?: Record<string, number> };
    const r = Number(j.rates?.THB);
    if (r > 20 && r < 60) return { rate: r, live: true };
  } catch {
    /* use the fallback */
  }
  return { rate: FALLBACK, live: false };
}
