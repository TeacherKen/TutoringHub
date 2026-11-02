import "server-only";
import { createClient } from "@/lib/supabase/server";
import { lessonMode, type Lesson, type Student } from "@/lib/data";
import { addDays, bkkStartOfDay, todayKey } from "@/lib/time";
import { buildReady, type Ready, type ReadyInput } from "@/lib/ready";

/** Ready or not, for lessons still to come. Everything is asked for at the same time. */
export async function loadReady(coming: Lesson[], students: Student[]): Promise<Map<string, Ready>> {
  const now = Date.now();
  const lessons = coming
    .filter((l) => Date.parse(l.start_at) > now && !l.status.startsWith("cancelled") && l.lesson_students.length > 0)
    .map((l) => ({ id: l.id, start_at: l.start_at, mode: lessonMode(l), ready_at: l.ready_at ?? null, studentIds: [...new Set(l.lesson_students.map((ls) => ls.student_id))] }));
  const ids = [...new Set(lessons.flatMap((l) => l.studentIds))];
  if (!ids.length) return new Map();
  const last = lessons.reduce((m, l) => (l.start_at > m ? l.start_at : m), lessons[0].start_at);
  const since = bkkStartOfDay(addDays(todayKey(), -90)).toISOString();
  const mine = students.filter((s) => ids.includes(s.id)) as (Student & { board_id?: string | null; slides_url?: string | null })[];
  const boardIds = mine.map((s) => s.board_id).filter((b): b is string => !!b);
  const supabase = await createClient();
  const [hist, sheets, boards] = await Promise.all([
    supabase
      .from("lesson_students")
      .select("student_id, lessons!inner(id, start_at, end_at, status)")
      .in("student_id", ids)
      .eq("lessons.ignored", false)
      .eq("lessons.in_calendar", true)
      .gte("lessons.start_at", since)
      .lte("lessons.start_at", last),
    supabase.from("worksheets").select("title, student_id, created_at").in("student_id", ids).gte("created_at", since).limit(100),
    boardIds.length ? supabase.from("boards").select("id, title, created_at").in("id", boardIds) : Promise.resolve({ data: [] }),
  ]);
  type H = { student_id: string; lessons: Omit<ReadyInput["history"][number], "student_id"> | null };
  return buildReady({
    lessons,
    students: mine,
    boards: (boards.data ?? []) as ReadyInput["boards"],
    history: ((hist.data ?? []) as unknown as H[]).filter((h) => h.lessons).map((h) => ({ ...h.lessons!, student_id: h.student_id })),
    sheets: (sheets.error ? [] : (sheets.data ?? [])) as ReadyInput["sheets"],
  });
}
