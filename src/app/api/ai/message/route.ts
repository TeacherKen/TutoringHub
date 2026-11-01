import { NextResponse } from "next/server";
import { getMe } from "@/lib/auth";
import { writeWithAI } from "@/lib/ai";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Write the parent message (or monthly report) from the prompt. Names are hidden from the AI. Tutor only. */
export async function POST(req: Request) {
  const me = await getMe();
  if (me?.role !== "tutor") return NextResponse.json({ error: "Only the tutor can do this." }, { status: 403 });
  const { prompt, kind } = ((await req.json().catch(() => ({}))) ?? {}) as { prompt?: unknown; kind?: unknown };
  const p = typeof prompt === "string" ? prompt.slice(0, 12000) : "";
  if (p.trim().length < 20) return NextResponse.json({ error: "Write the lesson note first." }, { status: 400 });
  return NextResponse.json(await writeWithAI(p, kind === "monthly_report" ? "monthly_report" : "parent_message"), { headers: { "Cache-Control": "no-store" } });
}
