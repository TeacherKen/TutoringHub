import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import { parseOccurrences, upgradeKey } from "./parse";
import { eventName, isPreplyTitle, matchStudents } from "./match";
import { bkkDateKey } from "@/lib/time";

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

  // 0. Lessons saved with the old kind of repeat id get the new one, so they stay the same lesson.
  const margin = 2 * 86_400_000;
  const stop = async (msg: string): Promise<SyncResult> => {
    await admin.from("settings").update({ last_sync_error: msg }).eq("id", 1); // so Home shows it
    return { ok: false, error: msg };
  };
  const { data: oldKeyed, error: oldErr } = await admin
    .from("lessons")
    .select("id, occurrence_key, status")
    .gte("start_at", new Date(from.getTime() - margin).toISOString())
    .lte("start_at", new Date(to.getTime() + margin).toISOString())
    .neq("occurrence_key", "single")
    .not("occurrence_key", "like", "d:%");
  // If this step can't finish, stop: carrying on would save a second copy next to each lesson.
  if (oldErr) return stop("Couldn't read your lessons. Press Refresh to try again.");
  // Marked lessons first: if a series move already made a copy, the one with the note and hours keeps the id.
  const toUpgrade = ((oldKeyed ?? []) as { id: string; occurrence_key: string; status: string }[]).sort((a, b) => Number(a.status === "scheduled") - Number(b.status === "scheduled"));
  for (const r of toUpgrade) {
    const key = upgradeKey(r.occurrence_key);
    if (!key) continue;
    const { error } = await admin.from("lessons").update({ occurrence_key: key }).eq("id", r.id);
    // 23505 = another row already has that id (a copy from before): leave this one, it drops out as usual.
    if (error && error.code !== "23505") return stop("Couldn't update your lessons. Press Refresh to try again.");
  }

  // Finished lessons keep their time and length, even if the whole series is changed in the calendar
  // later — otherwise hours already used would change. (A day's grace to correct a time.)
  const { data: doneRows, error: doneErr } = await admin
    .from("lessons")
    .select("event_uid, occurrence_key, start_at, end_at")
    .gte("start_at", new Date(from.getTime() - margin).toISOString())
    .lt("end_at", new Date(now - 86_400_000).toISOString())
    .neq("status", "scheduled");
  if (doneErr) return stop("Couldn't read your lessons. Press Refresh to try again.");
  const frozen = new Map(((doneRows ?? []) as { event_uid: string; occurrence_key: string; start_at: string; end_at: string }[]).map((r) => [`${r.event_uid}|${r.occurrence_key}`, r]));

  // 1. Upsert lesson rows (time, title, place only — notes are left alone).
  const unique = new Map<string, Record<string, unknown>>();
  for (const { src, occ } of okSources) {
    for (const o of occ) {
      const matched = matchStudents(o.title, studentList);
      // A new time on the same day keeps the old one; moved to another day (a make-up lesson) moves it.
      const old = frozen.get(`${o.uid}|${o.key}`);
      const keep = old && bkkDateKey(old.start_at) === bkkDateKey(o.start) ? old : null;
      unique.set(`${o.uid}|${o.key}`, {
        event_uid: o.uid,
        occurrence_key: o.key,
        start_at: keep?.start_at ?? o.start.toISOString(),
        end_at: keep?.end_at ?? o.end.toISOString(),
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
    if (error) {
      const msg = "Couldn't save lessons from your calendar. Press Refresh to try again.";
      await admin.from("settings").update({ last_sync_error: msg }).eq("id", 1); // so Home shows it
      return { ok: false, error: msg };
    }
    saved.push(...(data ?? []));
  }

  // 2. Lessons no longer in a calendar that was read successfully: moved or cancelled, so hidden.
  // (Lessons from a calendar that failed to load are left alone.) Only lessons that haven't ended:
  // Preply's link stops listing lessons once they're over, and a lesson that was taught (and used
  // package hours) must stay on Week, Home and the student page.
  const seen = new Set(saved.map((s) => s.id));
  const okIds = okSources.map((x) => x.src.id);
  const { data: windowRows } = await admin
    .from("lessons")
    .select("id, calendar_source_id, end_at")
    .gte("start_at", from.toISOString())
    .lte("start_at", to.toISOString())
    .eq("in_calendar", true);
  const gone = (windowRows ?? [])
    .filter((r) => Date.parse(r.end_at as string) > Date.now())
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

  // 4. Events named like ones Mr Ken hid ("Not a lesson") stay hidden, e.g. a new week of his own classes.
  const { data: hiddenRows } = await admin.from("lessons").select("title").eq("ignored", true).order("start_at", { ascending: false }).limit(500);
  const hiddenNames = new Set(((hiddenRows ?? []) as { title: string | null }[]).map((r) => eventName(r.title)).filter(Boolean));
  // Flights from Mr Ken's travel plans aren't lessons either.
  const flight = (t: string | null) => /\bflights?\b|✈/i.test(t ?? "");
  {
    const linked = new Set(links.map((l) => l.lesson_id));
    const toHide = unlocked.filter((s) => !linked.has(s.id) && (hiddenNames.has(eventName(s.title)) || flight(s.title))).map((s) => s.id);
    if (toHide.length) await admin.from("lessons").update({ ignored: true }).in("id", toHide).eq("ignored", false);
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
/** Read the calendars again if it's been 10 minutes. Returns true if it did. */
export async function syncIfStale(): Promise<boolean> {
  const admin = createAdminClient();
  const { data } = await admin.from("settings").select("last_attempt_at, calendar_connected").eq("id", 1).single();
  if (!data?.calendar_connected) return false;
  // Uses the last *attempt*, so a broken link doesn't slow down every page.
  const last = data.last_attempt_at ? new Date(data.last_attempt_at).getTime() : 0;
  if (Date.now() - last < STALE_MINUTES * 60_000) return false;
  const r = await syncCalendar();
  return r.ok;
}

/** True if a refresh was tried in the last few seconds (stops button-mashing). */
export async function refreshedJustNow(): Promise<boolean> {
  const admin = createAdminClient();
  const { data } = await admin.from("settings").select("last_attempt_at").eq("id", 1).single();
  const last = data?.last_attempt_at ? new Date(data.last_attempt_at).getTime() : 0;
  return Date.now() - last < MIN_REFRESH_SECONDS * 1000;
}
