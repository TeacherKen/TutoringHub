import { NextResponse } from "next/server";
import { getMe } from "@/lib/auth";
import { getBoardRow } from "@/lib/board";
import { imageGet, imagePost } from "@/lib/boardImageRoute";

export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: RouteContext<"/api/board/[boardId]/image">) {
  if ((await getMe())?.role !== "tutor") return NextResponse.json({ error: "not allowed" }, { status: 403 });
  return imageGet(req, await getBoardRow((await ctx.params).boardId));
}

export async function POST(req: Request, ctx: RouteContext<"/api/board/[boardId]/image">) {
  if ((await getMe())?.role !== "tutor") return NextResponse.json({ error: "not allowed" }, { status: 403 });
  return imagePost(req, await getBoardRow((await ctx.params).boardId));
}
