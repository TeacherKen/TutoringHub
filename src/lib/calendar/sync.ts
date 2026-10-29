import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import { parseOccurrences } from "./parse";
import { isPreplyTitle, matchStudents } from "./match";

const PAST_DAYS = 14;
const FUTURE_DAYS = 42;
const STALE_MINUTES = 10;
const MIN_REFRESH_SECONDS = 30;

export type SyncResult = { ok: true; count: number } | { ok: false; error: string };

/**
 * Accepted calendar links:
 * - Google Calendar's own "Secret address in iCal format"
 * - Preply's calendar export link (https on preply.com)
 */
export function validateCalendarUrl(raw: string): string | null {
  const s = raw.trim().replace(/^webcal:\/\//i, "https://");
  try {
    const u = new URL(s);
    if (u.protocol !== "https:" || u.username || u.password || u.port) return null;
    if (u.hostname === "calendar.google.com") {
      if (!u.pathname.startsWith("/calendar/ical/") || !u.pathname.endsWith(".ics")) return null;
      return u.toString();
    }
    if (u.hostname === "preply.com" || u.hostname.endsWith(".preply.com")) return u.toString();
    return null;
  } catch {
    return null;
  }
}

type Source = { id: string; label: string; ical_url: string; is_preply: boolean };

async function readSource(src: Source, from: Date, to: Date) {
  const url = validateCalendarUrl(src.ical_url);
  if (!url) throw new Error("bad link");
  const res = await fetch(url, { cache: "no-store", redirect: "error", signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`status ${res.status}`);
  const ics = await res.text();
  if (!ics.includes("BEGIN:VCALENDAR")) throw new Error("not a calendar");
  return parseOccurrences(ics, from, to);
}

/**
 * Reads every saved calendar (server only) and saves each occurrence as a
 * lesson row. Notes already written are never touched. Calendar links are
 * never returned, logged, or put in an error message.
 */
export async function syncCalendar(): Promise<SyncResult> {
  const admin = createAdminClient();
  const { data: srcRows } = await admin.from("calendar_sources").select("id, label, ical_url, is_preply").order("created_at");
  const sources = (srcRows ?? []) as Source[];
  if (!sources.length) return { ok: false, error: "No calendar link saved yet. Add it in Settings." };
  await admin.from("settings").update({ last_attempt_at: new Date().toISOString() }).eq("id", 1);

  const now = Date.now();
  const from = new Date(now - PAST_DAYS * 86_400_000);
  const to = new Date(now + FUTURE_DAYS * 86_400_000);

  // Read all calendars at the same time. One broken calendar doesn't stop the others.
  const results = await Promise.allSettled(sources.map((src) => readSource(src, from, to)));
  const okSources: { src: Source; occ: Awaited<ReturnType<typeof readSource>> }[] = [];
  const failed: string[] = [];
  results.forEach((r, i) => (r.status === "fulfilled" ? okSources.push({ src: sources[i], occ: r.value }) : failed.push(sources[i].label)));
  const failMsg = failed.length ? `Couldn't read: ${failed.join(", ")}. Check the link in Settings.` : null;
  if (!okSources.length) {
    await admin.from("settings").update({ last_sync_error: failMsg }).eq("id", 1);
    return { ok: false, error: failMsg! };
  }

  const { data: students } = await admin.from("students").select("id, keywords, source").eq("active", true);
  const studentList = (students ?? []) as { id: string; keywords: string[]; source: string }[];
  const preplyIds = new Set(studentList.filter((s) => s.source === "preply").map((s) => s.id));

  // 1. Upsert lesson rows (time, title, place only — notes are left alone).
  const unique = new Map<string, Record<string, unknown>>();
  for (const { src, occ } of okSources) {
    for (const o of occ) {
      const matched = matchStudents(o.title, studentList);
      unique.set(`${o.uid}|${o.key}`, {
        event_uid: o.uid,
        occurrence_key: o.key,
        start_at: o.start.toISOString(),
        end_at: o.end.toISOString(),
        title: o.title.slice(0, 300),
        location: o.location?.slice(0, 300) ?? null,
        is_preply: src.is_preply || isPreplyTitle(o.title) || matched.some((id) => preplyIds.has(id)),
        in_calendar: true,
        calendar_source_id: src.id,
      });
    }
  }
  const rows = [...unique.values()];

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

  // 2. Lessons no longer in a calendar that was read successfully.
  // (Lessons from a calendar that failed to load are left alone.)
  const seen = new Set(saved.map((s) => s.id));
  const okIds = okSources.map((x) => x.src.id);
  const { data: windowRows } = await admin
    .from("lessons")
    .select("id, calendar_source_id")
    .gte("start_at", from.toISOString())
    .lte("start_at", to.toISOString())
    .eq("in_calendar", true);
  const gone = (windowRows ?? [])
    .filter((r) => !seen.has(r.id as string) && (r.calendar_source_id == null || okIds.includes(r.calendar_source_id as string)))
    .map((r) => r.id as string);
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
    .update({ last_synced_at: new Date().toISOString(), last_sync_error: failMsg, calendar_connected: true })
    .eq("id", 1);
  return failMsg ? { ok: false, error: failMsg } : { ok: true, count: saved.length };
}

/** Calendar names for the Settings page (never the links). */
export async function listCalendarSources(): Promise<{ id: string; label: string; is_preply: boolean }[]> {
  const admin = createAdminClient();
  const { data } = await admin.from("calendar_sources").select("id, label, is_preply").order("created_at");
  return (data ?? []) as { id: string; label: string; is_preply: boolean }[];
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
