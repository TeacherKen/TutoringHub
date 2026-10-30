import { NextResponse } from "next/server";
import { boardForToken } from "@/lib/board";
import { imageGet, imagePost } from "@/lib/boardImageRoute";
import { isValidToken } from "@/lib/room";

export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: RouteContext<"/api/room/[token]/board/image">) {
  const { token } = await ctx.params;
  if (!isValidToken(token)) return NextResponse.json({ error: "not found" }, { status: 404 });
  return imageGet(req, await boardForToken(token));
}

export async function POST(req: Request, ctx: RouteContext<"/api/room/[token]/board/image">) {
  const { token } = await ctx.params;
  if (!isValidToken(token)) return NextResponse.json({ error: "not found" }, { status: 404 });
  return imagePost(req, await boardForToken(token));
}
