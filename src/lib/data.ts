import "server-only";
import { createClient } from "@/lib/supabase/server";
import { accountBalance, CHARGED_STATUSES, type Balance, type HoursLesson } from "@/lib/hours";
import { addDays, bkkDateKey as dateKeyOf, bkkStartOfDay } from "@/lib/time";

export type Student = {
  id: string;
  first_name: string;
  level: string | null;
  parent_name: string | null;
  contact_app: "whatsapp" | "line" | "wechat" | "other" | null;
  contact: string | null;
  mode: "onsite" | "online";
  source: "private" | "preply";
  place: string | null;
  keywords: string[];
  book: string | null;
  private_notes: string | null;
  active: boolean;
  hour_account_id: string | null;
  room_token?: string | null;
  games_open?: boolean;
  games_opened_at?: string | null;
  tt_tables?: number[] | null;
  tt_mode?: string | null;
};

export type LessonStudent = {
  student_id: string;
  uses_hours: boolean;
  /** This child's own topics in a shared lesson (update 0024); empty = the lesson's topics. */
  topics?: string[] | null;
  match_source: "auto" | "manual";
  students: Pick<Student, "first_name" | "mode" | "place" | "source" | "parent_name" | "level"> | null;
};

export type Lesson = {
  id: string;
  event_uid: string;
  start_at: string;
  end_at: string;
  title: string | null;
  location: string | null;
  is_preply: boolean;
  in_calendar: boolean;
  ignored: boolean;
  students_locked: boolean;
  status: "scheduled" | "done" | "cancelled" | "cancelled_charged" | "no_show";
  length_hours: number | null;
  learned: string | null;
  next_time: string | null;
  homework: string | null;
  how_it_went: "great" | "good" | "needs_practice" | null;
  topics: string[];
  final_message: string | null;
  sent_at: string | null;
  note_updated_at: string | null;
  /** "Clear all" on Home: no note needed / no feedback needed (database update 0021). */
  note_skipped?: boolean;
  /** Ticked "Ready" for a coming lesson (database update 0022). */
  ready_at?: string | null;
  feedback_skipped?: boolean;
  lesson_students: LessonStudent[];
};

export type Settings = {
  prompt_template: string | null;
  tone: string;
  allow_emoji: boolean;
  low_hours_threshold: number;
  calendar_connected: boolean;
  last_synced_at: string | null;
  last_sync_error: string | null;
  track_from: string | null;
  renew_weeks?: number;
  auto_done?: boolean;
  promptpay_id?: string | null;
  last_backup_at?: string | null;
  price_options?: unknown;
  ai_pictures?: boolean; // let the AI read pictures of written work (database update 0020)
};

const LESSON_SELECT =
  "*, lesson_students(student_id, uses_hours, match_source, topics, students(first_name, mode, place, source, parent_name, level))";

export async function getLessons(fromIso: string, toIso: string, opts: { includeIgnored?: boolean } = {}) {
  const supabase = await createClient();
  let q = supabase
    .from("lessons")
    .select(LESSON_SELECT)
    .gte("start_at", fromIso)
    .lt("start_at", toIso)
    .eq("in_calendar", true)
    .order("start_at");
  if (!opts.includeIgnored) q = q.eq("ignored", false);
  const { data } = await q;
  return (data ?? []) as Lesson[];
}

/** Finished classes with a student since `sinceKey` (Bangkok date): what the reminders on Home are made from.
 *  Its own small query, so Home's main one stays short. */
export async function getReminderLessons(sinceKey: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("lessons")
    .select(LESSON_SELECT.replace("lesson_students(", "lesson_students!inner("))
    .gte("start_at", bkkStartOfDay(sinceKey).toISOString())
    .lt("end_at", new Date().toISOString())
    .in("status", ["scheduled", "done"])
    .eq("in_calendar", true)
    .eq("ignored", false)
    .order("start_at")
    .limit(500);
  return (data ?? []) as unknown as Lesson[];
}

export async function getLesson(id: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("lessons").select(LESSON_SELECT).eq("id", id).maybeSingle();
  return data as Lesson | null;
}

export async function getStudents(opts: { activeOnly?: boolean } = {}) {
  const supabase = await createClient();
  let q = supabase.from("students").select("*").order("first_name");
  if (opts.activeOnly) q = q.eq("active", true);
  const { data } = await q;
  return (data ?? []) as Student[];
}

export async function getSettings(): Promise<Settings> {
  const supabase = await createClient();
  const { data } = await supabase.from("settings").select("*").eq("id", 1).maybeSingle();
  return (
    (data as Settings | null) ?? {
      prompt_template: null,
      tone: "warm",
      allow_emoji: false,
      low_hours_threshold: 2,
      calendar_connected: false,
      last_synced_at: null,
      last_sync_error: null,
      track_from: null,
    }
  );
}

export type Package = {
  id: string;
  hour_account_id: string;
  hours: number;
  price_thb: number | null;
  paid_on: string | null;
  paid_by: string | null;
  start_date: string;
  note: string | null;
  created_at: string;
};
export type Adjustment = { id: string; hour_account_id: string; hours: number; reason: string; adjusted_on: string };

export type AccountSummary = {
  id: string;
  name: string;
  students: Pick<Student, "id" | "first_name" | "source">[];
  packages: Package[];
  adjustments: Adjustment[];
  balance: Balance;
};

/** Hours bought / used / left for every hour account. */
/** Just what the colour dots need: family names and which families have packages (no lesson history). */
export async function getColourInputs(): Promise<{ packages: { hour_account_id: string }[]; accountNames: Map<string, string> }> {
  const supabase = await createClient();
  const [{ data: accounts }, { data: packages }] = await Promise.all([
    supabase.from("hour_accounts").select("id, name"),
    supabase.from("packages").select("hour_account_id"),
  ]);
  return {
    packages: (packages ?? []) as { hour_account_id: string }[],
    accountNames: new Map(((accounts ?? []) as { id: string; name: string }[]).map((a) => [a.id, a.name])),
  };
}

/** Every family's hours. With `onlyId`, just that one family (much faster: only their own lessons are read). */
export async function getAccountSummaries(onlyId?: string): Promise<AccountSummary[]> {
  const supabase = await createClient();
  let accountsQ = supabase.from("hour_accounts").select("id, name");
  let studentsQ = supabase.from("students").select("id, first_name, source, hour_account_id");
  let packagesQ = supabase.from("packages").select("*");
  let adjustQ = supabase.from("hour_adjustments").select("*");
  if (onlyId) {
    accountsQ = accountsQ.eq("id", onlyId);
    studentsQ = studentsQ.eq("hour_account_id", onlyId);
    packagesQ = packagesQ.eq("hour_account_id", onlyId);
    adjustQ = adjustQ.eq("hour_account_id", onlyId);
  }
  const [{ data: accounts }, { data: students }, { data: packages }, { data: adjustments }] = await Promise.all([
    accountsQ.order("name"),
    studentsQ,
    packagesQ.order("start_date"),
    adjustQ.order("adjusted_on"),
  ]);
  const pk = (packages ?? []) as Package[];
  const earliest = pk.map((p) => p.start_date).sort()[0];
  const memberIds = ((students ?? []) as { id: string }[]).map((s) => s.id);

  let lessons: HoursLesson[] = [];
  if (earliest) {
    const fromIso = new Date(new Date(`${earliest}T00:00:00Z`).getTime() - 7 * 3_600_000).toISOString();
    // Page through in blocks of 1,000 (the database's maximum per request).
    const data: { id: string; start_at: string; end_at: string; status: string; length_hours: number | null; lesson_students: unknown }[] = [];
    for (let fromRow = 0; ; fromRow += 1000) {
      let q = supabase
        .from("lessons")
        .select(onlyId ? "id, start_at, end_at, status, length_hours, lesson_students!inner(student_id, uses_hours)" : "id, start_at, end_at, status, length_hours, lesson_students(student_id, uses_hours)")
        .gte("start_at", fromIso);
      if (onlyId) q = q.in("lesson_students.student_id", memberIds.length ? memberIds : ["00000000-0000-0000-0000-000000000000"]);
      const { data: page, error: pageErr } = await q
        .in("status", [...CHARGED_STATUSES])
        .eq("ignored", false)
        .order("start_at")
        .order("id")
        .range(fromRow, fromRow + 999);
      if (pageErr) throw new Error("Couldn't load the hours. Please refresh.");
      data.push(...((page ?? []) as unknown as typeof data));
      if (!page || page.length < 1000) break;
    }
    lessons = data.map((l) => ({
      id: l.id,
      start_at: l.start_at,
      end_at: l.end_at,
      status: l.status,
      length_hours: l.length_hours,
      charged_student_ids: (l.lesson_students as { student_id: string; uses_hours: boolean }[])
        .filter((x) => x.uses_hours)
        .map((x) => x.student_id),
    }));
  }

  const st = (students ?? []) as (Pick<Student, "id" | "first_name" | "source"> & { hour_account_id: string | null })[];
  const adj = (adjustments ?? []) as Adjustment[];
  return (accounts ?? []).map((a) => {
    const members = st.filter((s) => s.hour_account_id === a.id);
    const p = pk.filter((x) => x.hour_account_id === a.id);
    const ad = adj.filter((x) => x.hour_account_id === a.id);
    return {
      id: a.id,
      name: a.name,
      students: members.map(({ id, first_name, source }) => ({ id, first_name, source })),
      packages: p,
      adjustments: ad,
      balance: accountBalance(
        members.map((m) => m.id),
        p,
        ad,
        lessons,
      ),
    };
  });
}

export function lessonNames(l: Lesson): string {
  const names = [...new Set(l.lesson_students.map((ls) => ls.students?.first_name).filter(Boolean) as string[])];
  return names.length ? names.join(" & ") : (l.title ?? "Untitled event");
}

export function lessonMode(l: Lesson): "onsite" | "online" | null {
  if (l.is_preply) return "online";
  const modes = l.lesson_students.map((ls) => ls.students?.mode);
  if (modes.includes("onsite")) return "onsite";
  if (modes.includes("online")) return "online";
  return null;
}

export function lessonPlace(l: Lesson): string | null {
  if (lessonMode(l) === "online") return null;
  return l.lesson_students.map((ls) => ls.students?.place).find(Boolean) ?? l.location ?? null;
}

/**
 * Where the lesson happens: "Preply", "Google Meet" (Mr Ken's own online lessons, e.g. Angela), "Zoom" or
 * "Teams" if the calendar says so, or the place for onsite lessons.
 */
export function lessonVia(l: Lesson): { kind: "preply" | "meet" | "zoom" | "teams" | "onsite" | null; label: string | null } {
  const loc = (l.location ?? "").toLowerCase();
  if (l.is_preply || loc.includes("preply.com")) return { kind: "preply", label: "Preply" };
  const mode = lessonMode(l);
  if (mode === "onsite") return { kind: "onsite", label: lessonPlace(l) ?? "Onsite" };
  if (loc.includes("zoom.us")) return { kind: "zoom", label: "Zoom" };
  if (loc.includes("teams")) return { kind: "teams", label: "Teams" };
  if (mode === "online") return { kind: "meet", label: "Google Meet" };
  return { kind: null, label: null };
}

// ⏰ Reminders. Home, Week, Money and the "Mark all done" button all use these, so they always agree.

/** Reminders go back to Settings' "start tracking from" date, but never more than 30 days: older is history. */
export const REMINDER_DAYS = 30;
export function reminderSince(trackFrom: string | null | undefined, today: string): string {
  const floor = addDays(today, -REMINDER_DAYS);
  return trackFrom && trackFrom > floor ? trackFrom : floor;
}

/** A class that has ended but is still "scheduled": it doesn't count for hours or money until it's marked. */
export function isUnmarked(l: Lesson, now = Date.now(), since?: string | null): boolean {
  return l.status === "scheduled" && l.lesson_students.length > 0 && new Date(l.end_at).getTime() < now && (!since || dateKeyOf(l.start_at) >= since);
}

/** A finished class with no note yet (and not cleared with "Clear all" / "Skip"). */
/** Notes are optional (Mr Ken rarely writes them), so nothing asks for one. Set to true to bring the reminders back. */
export const ASK_FOR_NOTES = false;
export function needsNote(l: Lesson, since?: string | null, ask: boolean = ASK_FOR_NOTES): boolean {
  return (
    ask &&
    !l.note_skipped &&
    (!since || dateKeyOf(l.start_at) >= since) &&
    l.lesson_students.length > 0 &&
    new Date(l.end_at).getTime() < Date.now() &&
    (l.status === "scheduled" || (l.status === "done" && !l.learned))
  );
}

/** A finished class whose parent message hasn't been sent (and wasn't marked "no feedback needed"). */
export function needsFeedback(l: Lesson, today: string, bkkDateKey: (iso: string) => string = dateKeyOf, since?: string | null): boolean {
  const day = bkkDateKey(l.start_at);
  return l.status === "done" && !l.sent_at && !l.note_skipped && !l.feedback_skipped && day <= today && (!since || day >= since);
}

/** Topic progress for these students (lesson topics + what Mr Ken marked). */
export async function getProgress(studentIds: string[]) {
  const { mergeProgress } = await import("@/lib/progress");
  type Saved = import("@/lib/progress").SavedTopic & { student_id: string };
  const out = new Map<string, ReturnType<typeof mergeProgress>>();
  if (!studentIds.length) return { byStudent: out, ready: true };
  const supabase = await createClient();
  const [saved, links] = await Promise.all([
    supabase.from("student_topics").select("student_id, name, status, updated_at").in("student_id", studentIds),
    supabase.from("lesson_students").select("student_id, topics, lessons!inner(start_at, topics, ignored, status)").in("student_id", studentIds),
  ]);
  const rows = (links.data ?? []) as unknown as {
    student_id: string;
    /** This child's own topics in a shared lesson (update 0024); empty = the lesson's topics. */
    topics?: string[] | null;
    lessons: { start_at: string; topics: string[] | null; ignored: boolean; status: string };
  }[];
  for (const id of studentIds) {
    const mine = ((saved.data ?? []) as Saved[]).filter((s) => s.student_id === id);
    const lessons = rows
      .filter((r) => r.student_id === id && !r.lessons.ignored && r.lessons.status !== "cancelled" && r.lessons.status !== "scheduled")
      .map((r) => ({ ...r.lessons, topics: r.topics?.length ? r.topics : r.lessons.topics }));
    out.set(id, mergeProgress(mine, lessons));
  }
  return { byStudent: out, ready: !saved.error };
}

/** Everything the Money page needs: earnings per class, package progress and forecasts. */
export async function getMoneyData() {
  const { computeEarnings } = await import("@/lib/earnings");
  const { addDays, todayKey: today, bkkStartOfDay } = await import("@/lib/time");
  const supabase = await createClient();
  const [{ data: accounts }, { data: students }, { data: packages }, { data: adjustments }] = await Promise.all([
    supabase.from("hour_accounts").select("id, name").order("name"),
    supabase.from("students").select("*").order("first_name"),
    supabase.from("packages").select("*").order("start_date"),
    supabase.from("hour_adjustments").select("hour_account_id, hours"),
  ]);
  const t = today();
  const pk = (packages ?? []) as Package[];
  // From the earliest package (to use packages up in order) or the start of last month, whichever is earlier.
  const lastMonth = `${addDays(`${t.slice(0, 7)}-01`, -1).slice(0, 7)}-01`;
  const from = [pk.map((p) => p.start_date).sort()[0], lastMonth].filter(Boolean).sort()[0]!;

  type Row = { id: string; start_at: string; end_at: string; status: string; length_hours: number | null; lesson_students: { student_id: string; uses_hours: boolean }[] };
  const toLesson = (l: Row) => ({
    id: l.id,
    start_at: l.start_at,
    end_at: l.end_at,
    status: l.status,
    length_hours: l.length_hours,
    charged: (l.lesson_students ?? []).filter((x) => x.uses_hours).map((x) => x.student_id),
  });
  const past: Row[] = [];
  for (let fromRow = 0; ; fromRow += 1000) {
    const { data: page, error: pastErr } = await supabase
      .from("lessons")
      .select("id, start_at, end_at, status, length_hours, lesson_students(student_id, uses_hours)")
      .gte("start_at", bkkStartOfDay(from).toISOString())
      .in("status", [...CHARGED_STATUSES])
      .eq("ignored", false)
      .order("start_at")
      .order("id")
      .range(fromRow, fromRow + 999);
    if (pastErr) throw new Error("Couldn't load the money numbers. Please refresh.");
    past.push(...((page ?? []) as Row[]));
    if (!page || page.length < 1000) break;
  }
  const { data: next } = await supabase
    .from("lessons")
    .select("id, start_at, end_at, status, length_hours, lesson_students(student_id, uses_hours)")
    .gte("start_at", new Date().toISOString())
    .lte("start_at", bkkStartOfDay(addDays(t, 120)).toISOString())
    .eq("status", "scheduled")
    .eq("ignored", false)
    .eq("in_calendar", true)
    .order("start_at");

  const adj = (adjustments ?? []) as { hour_account_id: string; hours: number }[];
  const st = (students ?? []) as (Student & { hourly_rate_thb?: number | null; class_price_thb?: number | null })[];
  const accs = (accounts ?? []).map((a) => ({
    id: a.id as string,
    name: a.name as string,
    adjusted: adj.filter((x) => x.hour_account_id === a.id).reduce((s, x) => s + Number(x.hours), 0),
  }));
  const pastLessons = past.map(toLesson);
  const upcoming = ((next ?? []) as Row[]).map(toLesson);
  const result = computeEarnings({ accounts: accs, students: st, packages: pk, lessons: pastLessons, upcoming, today: t });
  const { buildMoneyDashboard } = await import("@/lib/moneyDash");
  const dashboard = buildMoneyDashboard({ accounts: accs, students: st, packages: pk, past: pastLessons, upcoming, accountMoney: result.accounts, today: t });
  return { ...result, students: st, packages: pk, today: t, dashboard };
}

/** Times tables practice for one student: every fact's box, the latest rounds and trophies. */
export async function getTimesTables(studentId: string) {
  type FactState = import("@/lib/facts").FactState;
  type RoundRow = import("@/lib/trophies").RoundRow;
  const { statsFrom } = await import("@/lib/trophies");
  const supabase = await createClient();
  const facts = await supabase.from("fact_progress").select("fact, box, correct, wrong, avg_ms, due_at, last_seen").eq("student_id", studentId);
  let rounds: (RoundRow & { tables: number[] })[] = [];
  for (const cols of ["score, total, tables, game, best_streak, powers, won, created_at", "score, total, tables, game, created_at"]) {
    // Newest first; Supabase sends at most 1000 rows, which is years of rounds for one child.
    const { data, error } = await supabase.from("practice_sessions").select(cols).eq("student_id", studentId).order("created_at", { ascending: false }).limit(1000);
    if (!error) {
      rounds = (data ?? []) as unknown as (RoundRow & { tables: number[] })[];
      break;
    }
  }
  const progress = (facts.data ?? []) as FactState[];
  return {
    ready: !facts.error,
    progress,
    sessions: rounds.slice(0, 8),
    stats: statsFrom(rounds, progress),
  };
}
