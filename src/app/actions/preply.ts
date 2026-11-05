"use server";
import { revalidatePath } from "next/cache";
import { assertTutor } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type PreplyFormState = { ok?: string; error?: string } | null;

const num = (f: FormData, k: string, max: number): number | null => {
  const raw = String(f.get(k) ?? "").replace(/[$,\s]/g, "");
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 && n <= max ? n : NaN;
};

/** Save the numbers copied from Preply's student page for one student. */
export async function savePreplyStats(_: PreplyFormState, form: FormData): Promise<PreplyFormState> {
  await assertTutor();
  const studentId = String(form.get("student_id") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(studentId)) return { error: "Choose a student." };
  const plan = String(form.get("plan") ?? "");
  if (!["subscription", "package", "trial"].includes(plan)) return { error: "Choose the type." };
  const v = {
    income_usd: num(form, "income_usd", 1_000_000),
    lessons: num(form, "lessons", 10_000),
    months: num(form, "months", 600),
    lesson_price_usd: num(form, "lesson_price_usd", 1000),
    list_price_usd: num(form, "list_price_usd", 1000),
    per_four_weeks: num(form, "per_four_weeks", 100),
    booked: num(form, "booked", 1000),
    booked_of: num(form, "booked_of", 1000),
  };
  if (Object.values(v).some((x) => Number.isNaN(x))) return { error: "Numbers only, please (e.g. 5761.80)." };
  if (v.booked != null && v.booked_of != null && v.booked > v.booked_of) return { error: "Booked can't be more than the total." };
  const renews = String(form.get("renews_on") ?? "");
  const supabase = await createClient();
  const { error } = await supabase.from("preply_stats").upsert(
    {
      student_id: studentId,
      account_name: String(form.get("account_name") ?? "").trim().slice(0, 60) || null,
      plan,
      ...v,
      income_usd: v.income_usd ?? 0,
      lessons: Math.round(v.lessons ?? 0),
      months: Math.round(v.months ?? 0),
      renews_on: /^\d{4}-\d{2}-\d{2}$/.test(renews) ? renews : null,
      as_of: new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10), // today in Bangkok
      updated_at: new Date().toISOString(),
    },
    { onConflict: "student_id" },
  );
  if (error) return { error: "Couldn't save. Has database update 0026 been run?" };
  revalidatePath("/money");
  return { ok: "Saved." };
}
