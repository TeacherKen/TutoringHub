import { NextResponse } from "next/server";
import { getMe } from "@/lib/auth";
import { getBoardRow } from "@/lib/board";
import { boardGet, boardPost } from "@/lib/boardRoute";

export const dynamic = "force-dynamic";

/** Mr Ken's side of a student's smart slides (tutor sign-in only). */
export async function GET(req: Request, ctx: RouteContext<"/api/board/[boardId]">) {
  const me = await getMe();
  if (me?.role !== "tutor") return NextResponse.json({ error: "not allowed" }, { status: 403 });
  const { boardId } = await ctx.params;
  return boardGet(req, await getBoardRow(boardId), "tutor");
}

export async function POST(req: Request, ctx: RouteContext<"/api/board/[boardId]">) {
  const me = await getMe();
  if (me?.role !== "tutor") return NextResponse.json({ error: "not allowed" }, { status: 403 });
  const { boardId } = await ctx.params;
  return boardPost(req, await getBoardRow(boardId), "tutor");
}
