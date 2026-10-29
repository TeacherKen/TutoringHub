"use server";
import { revalidatePath } from "next/cache";
import { assertTutor, getMe } from "@/lib/auth";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { refreshedJustNow, syncCalendar, validateCalendarUrl } from "@/lib/calendar/sync";

export type ActionState = { ok?: boolean; message?: string } | null;

/** Refresh button (tutor or viewer). */
export async function refreshCalendar(): Promise<ActionState> {
  const me = await getMe();
  if (!me || (me.role !== "tutor" && me.role !== "viewer")) return { ok: false, message: "Not allowed." };
  if (await refreshedJustNow()) return { ok: true, message: "Already up to date." };
  const r = await syncCalendar();
  revalidatePath("/", "layout");
  return r.ok ? { ok: true, message: `Updated — ${r.count} calendar events read.` } : { ok: false, message: r.error };
}

export async function addCalendar(_: ActionState, form: FormData): Promise<ActionState> {
  await assertTutor();
  const url = validateCalendarUrl(String(form.get("ical_url") ?? ""));
  if (!url) {
    return {
      ok: false,
      message:
        "That doesn't look like a calendar link. Use Google Calendar's “Secret address in iCal format” (starts with https://calendar.google.com, ends with .ics).",
    };
  }
  const isPreply = form.get("is_preply") === "on";
  const label = String(form.get("label") ?? "").trim().slice(0, 40) || (isPreply ? "Preply" : "Lessons");
  const admin = createAdminClient();
  const { error } = await admin.from("calendar_sources").insert({ label, ical_url: url, is_preply: isPreply });
  if (error) return { ok: false, message: "Couldn't save the calendar." };
  await admin.from("settings").update({ calendar_connected: true, last_synced_at: null, last_attempt_at: null }).eq("id", 1);
  const r = await syncCalendar();
  revalidatePath("/", "layout");
  return r.ok ? { ok: true, message: `“${label}” added. ${r.count} events read.` } : { ok: false, message: r.error };
}

export async function removeCalendar(form: FormData): Promise<void> {
  await assertTutor();
  const admin = createAdminClient();
  await admin.from("calendar_sources").delete().eq("id", String(form.get("id")));
  const { count } = await admin.from("calendar_sources").select("id", { count: "exact", head: true });
  if (!count) await admin.from("settings").update({ calendar_connected: false }).eq("id", 1);
  else await syncCalendar();
  revalidatePath("/", "layout");
}

export async function setCalendarPreply(form: FormData): Promise<void> {
  await assertTutor();
  const admin = createAdminClient();
  await admin
    .from("calendar_sources")
    .update({ is_preply: form.get("is_preply") === "true" })
    .eq("id", String(form.get("id")));
  await syncCalendar();
  revalidatePath("/", "layout");
}

/** Link an unmatched calendar event to a student (optionally learn the word). */
export async function linkEventToStudent(form: FormData): Promise<void> {
  await assertTutor();
  const lessonId = String(form.get("lesson_id"));
  const studentId = String(form.get("student_id"));
  const keyword = String(form.get("keyword") ?? "").trim();
  const supabase = await createClient();
  await supabase
    .from("lesson_students")
    .upsert({ lesson_id: lessonId, student_id: studentId, match_source: "manual", uses_hours: true });
  if (keyword) {
    const { data: s } = await supabase.from("students").select("keywords").eq("id", studentId).single();
    const kws = new Set<string>((s?.keywords as string[]) ?? []);
    kws.add(keyword.slice(0, 60));
    await supabase.from("students").update({ keywords: [...kws] }).eq("id", studentId);
    await syncCalendar();
  }
  revalidatePath("/", "layout");
}

export async function setIgnored(form: FormData): Promise<void> {
  await assertTutor();
  const supabase = await createClient();
  await supabase
    .from("lessons")
    .update({ ignored: form.get("ignored") === "true" })
    .eq("id", String(form.get("lesson_id")));
  revalidatePath("/", "layout");
}
