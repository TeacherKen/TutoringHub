import { NextResponse } from "next/server";
import { getMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Tutor only: the latest picture of a student's game screen. */
export async function GET(_req: Request, ctx: RouteContext<"/api/watch/[studentId]">) {
  const me = await getMe();
  if (me?.role !== "tutor") return NextResponse.json({ error: "not allowed" }, { status: 403 });
  const { studentId } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/.test(studentId)) return NextResponse.json({ error: "bad id" }, { status: 400 });
  const supabase = await createClient();
  const { data } = await supabase.from("room_screens").select("game, html, updated_at").eq("student_id", studentId).maybeSingle();
  return NextResponse.json(data ?? null, { headers: { "Cache-Control": "no-store" } });
}
