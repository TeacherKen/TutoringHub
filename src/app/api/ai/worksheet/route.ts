import { NextResponse } from "next/server";
import { getMe } from "@/lib/auth";
import { createWorksheet } from "@/lib/worksheetAI";

export const dynamic = "force-dynamic";
export const maxDuration = 180;

/** 📝 Make the next worksheet from the lesson summary's Part 2 brief. Tutor only. */
export async function POST(req: Request) {
  const me = await getMe();
  if (me?.role !== "tutor") return NextResponse.json({ error: "Only the tutor can do this." }, { status: 403 });
  const { lessonId, brief } = ((await req.json().catch(() => ({}))) ?? {}) as { lessonId?: unknown; brief?: unknown };
  if (typeof lessonId !== "string" || !/^[0-9a-f-]{36}$/.test(lessonId)) return NextResponse.json({ error: "Lesson not found." }, { status: 400 });
  const text = typeof brief === "string" ? brief.slice(0, 8000) : "";
  if (text.trim().length < 40) return NextResponse.json({ error: "Summarise the lesson first, so the AI knows what to practise." }, { status: 400 });
  return NextResponse.json(await createWorksheet(lessonId, text), { headers: { "Cache-Control": "no-store" } });
}
