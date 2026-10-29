import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import { parseOccurrences } from "./parse";
import { isPreplyTitle, matchStudents } from "./match";

const PAST_DAYS = 14;
const FUTURE_DAYS = 42;
const STALE_MINUTES = 10;
const MIN_REFRESH_SECONDS = 30;

export type SyncResult = { ok: true; count: number } | { ok: false; error: string };

/** Only Google Calendar's own iCal addresses are accepted. */
export function validateCalendarUrl(raw: string): string | null {
  const s = raw.trim().replace(/^webcal:\/\//i, "https://");
  try {
    const u = new URL(s);
    if (u.protocol !== "https:" || u.hostname !== "calendar.google.com") return null;
    if (!u.pathname.startsWith("/calendar/ical/") || !u.pathname.endsWith(".ics")) return null;
    if (u.username || u.password || u.port) return null;
    return u.toString();
  } catch {
    return null;
  }
}

/**
 * Reads the Google Calendar link (server only), and saves each occurrence as a
 * lesson row. Notes already written are never touched. The calendar link is
 * never returned, logged, or put in an error message.
 */
export async function syncCalendar(): Promise<SyncResult> {
  const admin = createAdminClient();
  const { data: priv } = await admin.from("private_settings").select("ical_url").eq("id", 1).single();
  const url = priv?.ical_url ? validateCalendarUrl(priv.ical_url as string) : null;
  if (!url) return { ok: false, error: "No calendar link saved yet. Add it in Settings." };
  await admin.from("settings").update({ last_attempt_at: new Date().toISOString() }).eq("id", 1);

  const now = Date.now();
  const from = new Date(now - PAST_DAYS * 86_400_000);
  const to = new Date(now + FUTURE_DAYS * 86_400_000);

  let ics: string;
  try {
    const res = await fetch(url, { cache: "no-store", redirect: "error", signal: AbortSignal.timeout(15_000) });
    if (!res.ok) throw new Error(`status ${res.status}`);
    ics = await res.text();
    if (!ics.includes("BEGIN:VCALENDAR")) throw new Error("not a calendar");
  } catch {
    const error = "Couldn't read your Google Calendar. Check the calendar link in Settings.";
    await admin.from("settings").update({ last_sync_error: error }).eq("id", 1);
    return { ok: false, error };
  }

  let occurrences;
  try {
    occurrences = parseOccurrences(ics, from, to);
  } catch {
    const error = "Your calendar was read, but it couldn't be understood.";
    await admin.from("settings").update({ last_sync_error: error }).eq("id", 1);
    return { ok: false, error };
  }

  const { data: students } = await admin.from("students").select("id, keywords, source").eq("active", true);
  const studentList = (students ?? []) as { id: string; keywords: string[]; source: string }[];
  const preplyIds = new Set(studentList.filter((s) => s.source === "preply").map((s) => s.id));

  // 1. Upsert lesson rows (time, title, place only — notes are left alone).
  const unique = new Map(occurrences.map((o) => [`${o.uid}|${o.key}`, o]));
  const rows = [...unique.values()].map((o) => {
    const matched = matchStudents(o.title, studentList);
    return {
      event_uid: o.uid,
      occurrence_key: o.key,
      start_at: o.start.toISOString(),
      end_at: o.end.toISOString(),
      title: o.title.slice(0, 300),
      location: o.location?.slice(0, 300) ?? null,
      is_preply: isPreplyTitle(o.title) || matched.some((id) => preplyIds.has(id)),
      in_calendar: true,
    };
  });

  type Saved = { id: string; title: string; students_locked: boolean; status: string };
  const saved: Saved[] = [];
  for (let i = 0; i < rows.length; i += 200) {
    const { data, error } = await admin
      .from("lessons")
      .upsert(rows.slice(i, i + 200), { onConflict: "event_uid,occurrence_key" })
      .select("id, title, students_locked, status");
    if (error) return { ok: false, error: "Couldn't save lessons from your calendar." };
    saved.push(...(data ?? []));
  }

  // 2. Lessons in this window that are no longer in the calendar.
  const seen = new Set(saved.map((s) => s.id));
  const { data: windowRows } = await admin
    .from("lessons")
    .select("id")
    .gte("start_at", from.toISOString())
    .lte("start_at", to.toISOString())
    .eq("in_calendar", true);
  const gone = (windowRows ?? []).map((r) => r.id as string).filter((id) => !seen.has(id));
  if (gone.length) await admin.from("lessons").update({ in_calendar: false }).in("id", gone);

  // 3. Automatic student matches. Only lessons that are still "scheduled" and
  // that the tutor hasn't edited by hand are re-matched, so finished lessons
  // never lose their student (or their hours) when keywords change.
  const unlocked = saved.filter((s) => !s.students_locked && s.status === "scheduled");
  const ids = unlocked.map((s) => s.id);
  for (let i = 0; i < ids.length; i += 200) {
    await admin.from("lesson_students").delete().in("lesson_id", ids.slice(i, i + 200)).eq("match_source", "auto");
  }
  const links = unlocked.flatMap((s) =>
    matchStudents(s.title ?? "", studentList).map((student_id) => ({
      lesson_id: s.id,
      student_id,
      match_source: "auto",
      uses_hours: true,
    })),
  );
  for (let i = 0; i < links.length; i += 500) {
    await admin
      .from("lesson_students")
      .upsert(links.slice(i, i + 500), { onConflict: "lesson_id,student_id", ignoreDuplicates: true });
  }

  await admin
    .from("settings")
    .update({ last_synced_at: new Date().toISOString(), last_sync_error: null, calendar_connected: true })
    .eq("id", 1);
  return { ok: true, count: saved.length };
}

/** Sync only if it's been a while (used when a page opens). */
export async function syncIfStale(): Promise<void> {
  const admin = createAdminClient();
  const { data } = await admin.from("settings").select("last_attempt_at, calendar_connected").eq("id", 1).single();
  if (!data?.calendar_connected) return;
  // Uses the last *attempt*, so a broken link doesn't slow down every page.
  const last = data.last_attempt_at ? new Date(data.last_attempt_at).getTime() : 0;
  if (Date.now() - last < STALE_MINUTES * 60_000) return;
  await syncCalendar();
}

/** True if a refresh was tried in the last few seconds (stops button-mashing). */
export async function refreshedJustNow(): Promise<boolean> {
  const admin = createAdminClient();
  const { data } = await admin.from("settings").select("last_attempt_at").eq("id", 1).single();
  const last = data?.last_attempt_at ? new Date(data.last_attempt_at).getTime() : 0;
  return Date.now() - last < MIN_REFRESH_SECONDS * 1000;
}
