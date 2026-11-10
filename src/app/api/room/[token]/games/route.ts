import { NextResponse } from "next/server";
import { studentForToken } from "@/lib/practice";
import { cleanResult, missionsFor, saveResult } from "@/lib/gameResults";

export const dynamic = "force-dynamic";
const noStore = { "Cache-Control": "no-store" };

/** A finished round of a break-time game, saved to the child (opened with their room link). */
export async function POST(req: Request, ctx: RouteContext<"/api/room/[token]/games">) {
  const s = await studentForToken((await ctx.params).token);
  if (!s) return NextResponse.json({ error: "not found" }, { status: 404 });
  const text = await req.text();
  if (text.length > 2_000) return NextResponse.json({ ok: false }, { status: 413 });
  let body: { game?: unknown; variant?: unknown; score?: unknown; unit?: unknown };
  try {
    body = JSON.parse(text);
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ ok: false }, { status: 400 });
  const r = cleanResult(body.game, body);
  if (!r) return NextResponse.json({ ok: false }, { status: 400 });
  const ok = await saveResult(s, r);
  const missions = (await missionsFor([s.id])).get(s.id) ?? [];
  return NextResponse.json({ ok, missions }, { status: ok ? 200 : 503, headers: noStore });
}
