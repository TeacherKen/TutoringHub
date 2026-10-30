import "server-only";
import type { createClient } from "@/lib/supabase/server";

type Client = Awaited<ReturnType<typeof createClient>>;

export const receiptPattern = (year: number) => `R-${year}-`;

/** Next number like R-2026-007 (numbers start again each year). */
export function nextReceiptNo(existing: (string | null)[], year: number): string {
  const prefix = receiptPattern(year);
  const max = existing.reduce((m, r) => {
    if (!r?.startsWith(prefix)) return m;
    const n = Number(r.slice(prefix.length));
    return Number.isFinite(n) && n > m ? n : m;
  }, 0);
  return `${prefix}${String(max + 1).padStart(3, "0")}`;
}

/** Give a paid package a receipt number (once). Works quietly before database update 0012. */
export async function assignReceipt(supabase: Client, packageId: string, paidOn: string): Promise<string | null> {
  const year = Number(paidOn.slice(0, 4));
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data: cur, error } = await supabase.from("packages").select("receipt_no").eq("id", packageId).maybeSingle();
    if (error) return null;
    if (cur?.receipt_no) return cur.receipt_no as string;
    const { data: used } = await supabase.from("packages").select("receipt_no").like("receipt_no", `${receiptPattern(year)}%`);
    const no = nextReceiptNo((used ?? []).map((r) => r.receipt_no as string | null), year);
    const { error: upErr } = await supabase.from("packages").update({ receipt_no: no }).eq("id", packageId).is("receipt_no", null);
    if (!upErr) return no; // a clash with another number (unique) → try the next one
  }
  return null;
}
