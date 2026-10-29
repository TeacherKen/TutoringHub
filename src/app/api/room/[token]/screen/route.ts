import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { isValidToken } from "@/lib/room";

export const dynamic = "force-dynamic";

const MAX_CHARS = 400_000;
const GAMES = new Set(["tt", "qm", "sd", "magic-square", "wolf-vs-sheep"]);

/** The student's room sends a picture (HTML copy, no scripts) of the game screen every few seconds. */
export async function POST(req: Request, ctx: RouteContext<"/api/room/[token]/screen">) {
  const { token } = await ctx.params;
  if (!isValidToken(token)) return NextResponse.json({ ok: false }, { status: 404 });

  let body: { game?: unknown; html?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const game = typeof body.game === "string" && GAMES.has(body.game) ? body.game : null;
  const html = typeof body.html === "string" ? body.html : null;
  if (!game || !html || html.length > MAX_CHARS) return NextResponse.json({ ok: false }, { status: 400 });

  const admin = createAdminClient();
  const { data: s } = await admin
    .from("students")
    .select("id, active, games_open, games_opened_at")
    .eq("room_token", token)
    .maybeSingle();
  const openedAt = s?.games_opened_at ? new Date(s.games_opened_at).getTime() : 0;
  if (!s || !s.active || !s.games_open || Date.now() - openedAt > 45 * 60_000) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }
  await admin.from("room_screens").upsert({ student_id: s.id, game, html, updated_at: new Date().toISOString() });
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
