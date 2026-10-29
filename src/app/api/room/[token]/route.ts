import { NextResponse } from "next/server";
import { getRoom } from "@/lib/room";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: RouteContext<"/api/room/[token]">) {
  const { token } = await ctx.params;
  const room = await getRoom(token);
  if (!room) return NextResponse.json({ error: "not found" }, { status: 404, headers: { "Cache-Control": "no-store" } });
  return NextResponse.json(room, { headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
}
