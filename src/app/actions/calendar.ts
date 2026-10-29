"use server";
import { revalidatePath } from "next/cache";
import { assertTutor, getMe } from "@/lib/auth";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { syncCalendar, validateCalendarUrl } from "@/lib/calendar/sync";

export type ActionState = { ok?: boolean; message?: string } | null;

/** Refresh button (tutor or viewer). */
export async function refreshCalendar(): Promise<ActionState> {
  const me = await getMe();
  if (!me || (me.role !== "tutor" && me.role !== "viewer")) return { ok: false, message: "Not allowed." };
  const r = await syncCalendar();
  revalidatePath("/", "layout");
  return r.ok ? { ok: true, message: `Updated — ${r.count} calendar events read.` } : { ok: false, message: r.error };
}

export async function saveCalendarLink(_: ActionState, form: FormData): Promise<ActionState> {
  await assertTutor();
  const raw = String(form.get("ical_url") ?? "");
  const url = validateCalendarUrl(raw);
  if (!url) {
    return {
      ok: false,
      message: "That doesn't look like a Google Calendar iCal link. It should start with https://calendar.google.com and end with .ics",
    };
  }
  const admin = createAdminClient();
  await admin.from("private_settings").update({ ical_url: url }).eq("id", 1);
  await admin.from("settings").update({ calendar_connected: true, last_synced_at: null }).eq("id", 1);
  const r = await syncCalendar();
  revalidatePath("/", "layout");
  return r.ok
    ? { ok: true, message: `Calendar connected. ${r.count} events read.` }
    : { ok: false, message: r.error };
}

export async function removeCalendarLink(): Promise<void> {
  await assertTutor();
  const admin = createAdminClient();
  await admin.from("private_settings").update({ ical_url: null }).eq("id", 1);
  await admin.from("settings").update({ calendar_connected: false }).eq("id", 1);
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
