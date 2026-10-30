import { NextResponse } from "next/server";
import { boardForToken } from "@/lib/board";
import { boardGet, boardPost } from "@/lib/boardRoute";
import { isValidToken } from "@/lib/room";

export const dynamic = "force-dynamic";

/** The student's smart slides (opened with their private room link). */
export async function GET(req: Request, ctx: RouteContext<"/api/room/[token]/board">) {
  const { token } = await ctx.params;
  if (!isValidToken(token)) return NextResponse.json({ ok: false }, { status: 404 });
  return boardGet(req, await boardForToken(token), "student");
}

export async function POST(req: Request, ctx: RouteContext<"/api/room/[token]/board">) {
  const { token } = await ctx.params;
  if (!isValidToken(token)) return NextResponse.json({ ok: false }, { status: 404 });
  return boardPost(req, await boardForToken(token), "student");
}
