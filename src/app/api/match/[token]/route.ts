import { NextResponse } from "next/server";
import { answerMatch, getMatch, isDeviceId, joinMatch, rematch } from "@/lib/match";

export const dynamic = "force-dynamic";
const noStore = { "Cache-Control": "no-store" };

/** The match: players, goals, who's on this device. */
export async function GET(req: Request, ctx: RouteContext<"/api/match/[token]">) {
  const q = new URL(req.url).searchParams;
  const state = await getMatch((await ctx.params).token, q.get("device"), q.get("progress") === "1");
  return state ? NextResponse.json(state, { headers: noStore }) : NextResponse.json({ error: "not found" }, { status: 404 });
}

/** Join as a player, send an answer, or ask for a rematch. */
export async function POST(req: Request, ctx: RouteContext<"/api/match/[token]">) {
  const { token } = await ctx.params;
  const text = await req.text();
  if (text.length > 2000) return NextResponse.json({ ok: false }, { status: 413 });
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(text) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  if (body.op === "rematch") return NextResponse.json(await rematch(token), { headers: noStore });
  if (!isDeviceId(body.device)) return NextResponse.json({ ok: false }, { status: 400 });
  if (body.op === "join" && typeof body.player === "string") {
    return NextResponse.json(await joinMatch(token, body.player, body.device), { headers: noStore });
  }
  if (body.op === "answer" && typeof body.fact === "string") {
    return NextResponse.json(await answerMatch(token, body.device, body.fact, body.kind, Number(body.answer), Number(body.ms)), { headers: noStore });
  }
  return NextResponse.json({ ok: false }, { status: 400 });
}
