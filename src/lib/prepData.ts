import "server-only";
import { createClient } from "@/lib/supabase/server";
import { lessonMode, type Lesson, type Student } from "@/lib/data";
import { addDays, bkkStartOfDay, todayKey } from "@/lib/time";
import { buildPrep, type PrepInput, type PrepStudent } from "@/lib/prep";

/** "Before class" for today's lessons that haven't finished. Everything is asked for at the same time. */
export async function loadPrep(todays: Lesson[], students: Student[], accounts: PrepInput["accounts"]): Promise<Map<string, PrepStudent[]>> {
  const now = Date.now();
  const lessons = todays
    .filter((l) => Date.parse(l.end_at) > now && l.status !== "cancelled" && l.status !== "cancelled_charged")
    .map((l) => ({ id: l.id, start_at: l.start_at, mode: lessonMode(l), studentIds: [...new Set(l.lesson_students.map((ls) => ls.student_id))] }));
  const ids = [...new Set(lessons.flatMap((l) => l.studentIds))];
  if (!ids.length) return new Map();
  const supabase = await createClient();
  const since = bkkStartOfDay(addDays(todayKey(), -90)).toISOString();
  const boardIds = students.map((s) => (s as Student & { board_id?: string | null }).board_id).filter((b): b is string => !!b);
  const [hist, sheets, rounds, boards] = await Promise.all([
    supabase
      .from("lesson_students")
      .select("student_id, lessons!inner(id, start_at, end_at, status, next_time, homework)")
      .in("student_id", ids)
      .gte("lessons.start_at", since)
      .lt("lessons.start_at", new Date(now + 86_400_000).toISOString()),
    supabase.from("worksheets").select("id, title, student_id, created_at").in("student_id", ids).gte("created_at", since).order("created_at", { ascending: false }).limit(50),
    supabase.from("practice_sessions").select("student_id, score, total, created_at").in("student_id", ids).gte("created_at", since).limit(2000),
    boardIds.length ? supabase.from("boards").select("id, title, created_at").in("id", boardIds) : Promise.resolve({ data: [] }),
  ]);
  type H = { student_id: string; lessons: PrepInput["history"][number] | null };
  return buildPrep({
    lessons,
    students: students.filter((s) => ids.includes(s.id)),
    boards: (boards.data ?? []) as PrepInput["boards"],
    history: ((hist.data ?? []) as unknown as H[]).filter((h) => h.lessons).map((h) => ({ ...h.lessons!, student_id: h.student_id })),
    sheets: (sheets.error ? [] : (sheets.data ?? [])) as PrepInput["sheets"], // before database update 0020: none
    rounds: (rounds.error ? [] : (rounds.data ?? [])) as PrepInput["rounds"],
    accounts,
    now,
  });
}
