import { NextResponse } from "next/server";
import { cleanAnswers, cleanTables } from "@/lib/facts";
import { getPractice, savePractice, studentForToken } from "@/lib/practice";

export const dynamic = "force-dynamic";
const noStore = { "Cache-Control": "no-store" };

/** The student's times tables progress (opened with their room link). */
export async function GET(_req: Request, ctx: RouteContext<"/api/room/[token]/practice">) {
  const s = await studentForToken((await ctx.params).token);
  if (!s) return NextResponse.json({ error: "not found" }, { status: 404 });
  const data = await getPractice(s);
  return data ? NextResponse.json(data, { headers: noStore }) : NextResponse.json({ error: "not ready" }, { status: 503 });
}

/** Save a finished round. */
export async function POST(req: Request, ctx: RouteContext<"/api/room/[token]/practice">) {
  const s = await studentForToken((await ctx.params).token);
  if (!s) return NextResponse.json({ error: "not found" }, { status: 404 });
  const text = await req.text();
  if (text.length > 20_000) return NextResponse.json({ ok: false }, { status: 413 });
  let body: { answers?: unknown; tables?: unknown; score?: unknown; total?: unknown; bestStreak?: unknown; powers?: unknown };
  try {
    body = JSON.parse(text);
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const answers = cleanAnswers(body.answers);
  if (!answers.length) return NextResponse.json({ ok: false }, { status: 400 });
  const total = Math.max(0, Math.min(40, Number(body.total) || 0));
  const ok = await savePractice(s.id, answers, cleanTables(body.tables), Number(body.score) || 0, total, {
    bestStreak: Number(body.bestStreak) || 0,
    powers: Number(body.powers) || 0,
  });
  return NextResponse.json({ ok }, { status: ok ? 200 : 503, headers: noStore });
}
