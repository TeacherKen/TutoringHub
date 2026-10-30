import "server-only";
import { createClient } from "@/lib/supabase/server";
import { bkkStartOfDay, todayKey } from "@/lib/time";

/** Past classes (matched to a student) that are still "scheduled". */
export async function unmarkedPastLessonIds(opts: { before: Date; from?: string | null }): Promise<string[]> {
  const supabase = await createClient();
  let q = supabase
    .from("lessons")
    .select("id, lesson_students!inner(student_id)")
    .eq("status", "scheduled")
    .eq("ignored", false)
    .eq("in_calendar", true)
    .lt("end_at", opts.before.toISOString())
    .limit(500);
  if (opts.from) q = q.gte("start_at", bkkStartOfDay(opts.from).toISOString());
  const { data } = await q;
  return [...new Set((data ?? []).map((r) => r.id as string))];
}

/**
 * If "mark classes done automatically" is on: classes from yesterday or earlier that are
 * still in the calendar and not marked become "done". Today's classes are left alone,
 * so there's a day to mark a cancellation.
 */
export async function autoMarkDone(): Promise<number> {
  const supabase = await createClient();
  const { data: s, error } = await supabase.from("settings").select("auto_done, track_from").eq("id", 1).maybeSingle();
  if (error || !s?.auto_done) return 0;
  const ids = await unmarkedPastLessonIds({ before: bkkStartOfDay(todayKey()), from: s.track_from as string | null });
  if (!ids.length) return 0;
  const { error: upErr } = await supabase.from("lessons").update({ status: "done" }).in("id", ids).eq("status", "scheduled");
  return upErr ? 0 : ids.length;
}
