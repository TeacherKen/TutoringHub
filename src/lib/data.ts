import "server-only";
import { createClient } from "@/lib/supabase/server";
import { accountBalance, CHARGED_STATUSES, type Balance, type HoursLesson } from "@/lib/hours";

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
};

export type LessonStudent = {
  student_id: string;
  uses_hours: boolean;
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
};

const LESSON_SELECT =
  "*, lesson_students(student_id, uses_hours, match_source, students(first_name, mode, place, source, parent_name, level))";

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
export async function getAccountSummaries(): Promise<AccountSummary[]> {
  const supabase = await createClient();
  const [{ data: accounts }, { data: students }, { data: packages }, { data: adjustments }] = await Promise.all([
    supabase.from("hour_accounts").select("id, name").order("name"),
    supabase.from("students").select("id, first_name, source, hour_account_id"),
    supabase.from("packages").select("*").order("start_date"),
    supabase.from("hour_adjustments").select("*").order("adjusted_on"),
  ]);
  const pk = (packages ?? []) as Package[];
  const earliest = pk.map((p) => p.start_date).sort()[0];

  let lessons: HoursLesson[] = [];
  if (earliest) {
    const fromIso = new Date(new Date(`${earliest}T00:00:00Z`).getTime() - 7 * 3_600_000).toISOString();
    // Page through in blocks of 1,000 (the database's maximum per request).
    const data: { id: string; start_at: string; end_at: string; status: string; length_hours: number | null; lesson_students: unknown }[] = [];
    for (let fromRow = 0; ; fromRow += 1000) {
      const { data: page } = await supabase
        .from("lessons")
        .select("id, start_at, end_at, status, length_hours, lesson_students(student_id, uses_hours)")
        .gte("start_at", fromIso)
        .in("status", [...CHARGED_STATUSES])
        .eq("ignored", false)
        .order("start_at")
        .range(fromRow, fromRow + 999);
      data.push(...(page ?? []));
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

export function needsNote(l: Lesson): boolean {
  return (
    l.lesson_students.length > 0 &&
    new Date(l.end_at).getTime() < Date.now() &&
    (l.status === "scheduled" || (l.status === "done" && !l.learned))
  );
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
    supabase.from("lesson_students").select("student_id, lessons!inner(start_at, topics, ignored, status)").in("student_id", studentIds),
  ]);
  const rows = (links.data ?? []) as unknown as { student_id: string; lessons: { start_at: string; topics: string[] | null; ignored: boolean; status: string } }[];
  for (const id of studentIds) {
    const mine = ((saved.data ?? []) as Saved[]).filter((s) => s.student_id === id);
    const lessons = rows
      .filter((r) => r.student_id === id && !r.lessons.ignored && r.lessons.status !== "cancelled" && r.lessons.status !== "scheduled")
      .map((r) => r.lessons);
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
    const { data: page } = await supabase
      .from("lessons")
      .select("id, start_at, end_at, status, length_hours, lesson_students(student_id, uses_hours)")
      .gte("start_at", bkkStartOfDay(from).toISOString())
      .in("status", [...CHARGED_STATUSES])
      .eq("ignored", false)
      .order("start_at")
      .range(fromRow, fromRow + 999);
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
  const result = computeEarnings({
    accounts: (accounts ?? []).map((a) => ({
      id: a.id as string,
      name: a.name as string,
      adjusted: adj.filter((x) => x.hour_account_id === a.id).reduce((s, x) => s + Number(x.hours), 0),
    })),
    students: st,
    packages: pk,
    lessons: past.map(toLesson),
    upcoming: ((next ?? []) as Row[]).map(toLesson),
    today: t,
  });
  return { ...result, students: st, packages: pk, today: t };
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
    const { data, error } = await supabase.from("practice_sessions").select(cols).eq("student_id", studentId).order("created_at").limit(5000);
    if (!error) {
      rounds = (data ?? []) as unknown as (RoundRow & { tables: number[] })[];
      break;
    }
  }
  const progress = (facts.data ?? []) as FactState[];
  return {
    ready: !facts.error,
    progress,
    sessions: rounds.slice(-8).reverse(),
    stats: statsFrom(rounds, progress),
  };
}
