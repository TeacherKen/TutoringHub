/**
 * Send JSON to one of the app's own web addresses and read the JSON answer.
 * Used for slow jobs (AI, calendar) instead of Server Actions: Next.js runs Server Actions
 * one at a time, so a one-minute AI job would make every other button wait behind it.
 */
export async function postJson<T extends object>(url: string, body: unknown): Promise<T & { error?: string }> {
  try {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}), cache: "no-store" });
    const data = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
    if (data) return data;
    return { error: res.status === 504 ? "That took too long. Try again." : "Something went wrong. Try again." } as T & { error?: string };
  } catch {
    return { error: "The internet dropped. Try again." } as T & { error?: string };
  }
}
