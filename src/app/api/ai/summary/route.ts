import { NextResponse } from "next/server";
import { getMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { summariseLesson } from "@/lib/lessonSummary";

export const dynamic = "force-dynamic";
export const maxDuration = 180;

/** ✨ Summarise a lesson with AI and keep the summary with the lesson. Tutor only. */
export async function POST(req: Request) {
  const me = await getMe();
  if (me?.role !== "tutor") return NextResponse.json({ error: "Only the tutor can do this." }, { status: 403 });
  const { lessonId } = ((await req.json().catch(() => ({}))) ?? {}) as { lessonId?: unknown };
  if (typeof lessonId !== "string" || !/^[0-9a-f-]{36}$/.test(lessonId)) return NextResponse.json({ error: "Lesson not found." }, { status: 400 });
  const r = await summariseLesson(lessonId);
  if (r.summary) {
    const supabase = await createClient();
    // Needs database update 0019/0020; without it the summary still shows, it just isn't kept.
    await supabase.from("lessons").update({ ai_summary: r.summary, ai_summary_at: new Date().toISOString() }).eq("id", lessonId);
    // Brothers and sisters in one lesson: each child's own topics (database update 0024), so the family
    // page's Progress shows each child only what they worked on.
    const byChild = r.summary.topics_by_child ?? [];
    if (byChild.length) {
      const { data: kids } = await supabase.from("lesson_students").select("student_id, topics, students(first_name)").eq("lesson_id", lessonId);
      const rows = (kids ?? []) as unknown as { student_id: string; topics: string[] | null; students: { first_name: string } | null }[];
      if (rows.length > 1) {
        for (const k of rows) {
          const first = (k.students?.first_name ?? "").trim().split(/\s+/)[0]?.toLowerCase();
          const mine = byChild.find((b) => b.child.trim().toLowerCase().split(/\s+/)[0] === first);
          if (mine && !(k.topics ?? []).length) await supabase.from("lesson_students").update({ topics: mine.topics }).eq("lesson_id", lessonId).eq("student_id", k.student_id);
        }
      }
    }
  }
  return NextResponse.json(r, { headers: { "Cache-Control": "no-store" } });
}
