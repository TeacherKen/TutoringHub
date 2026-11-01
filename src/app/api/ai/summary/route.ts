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
  }
  return NextResponse.json(r, { headers: { "Cache-Control": "no-store" } });
}
