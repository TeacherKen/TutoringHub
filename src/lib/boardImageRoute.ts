import "server-only";
import { NextResponse } from "next/server";
import { boardImageUrl, uploadBoardImage, type getBoardRow } from "@/lib/board";

type BoardRow = NonNullable<Awaited<ReturnType<typeof getBoardRow>>>;

/** GET ?k=img-….jpg → the picture (via a short-lived link). */
export async function imageGet(req: Request, b: BoardRow | null) {
  if (!b) return NextResponse.json({ error: "not found" }, { status: 404 });
  const url = await boardImageUrl(b, new URL(req.url).searchParams.get("k") ?? "");
  if (!url) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.redirect(url, { headers: { "Cache-Control": "private, max-age=3600" } });
}

/** POST the picture's bytes → { key }. */
export async function imagePost(req: Request, b: BoardRow | null) {
  if (!b) return NextResponse.json({ error: "not found" }, { status: 404 });
  const type = (req.headers.get("content-type") ?? "").split(";")[0].trim();
  const r = await uploadBoardImage(b, await req.arrayBuffer(), type);
  return NextResponse.json(r, { status: r.key ? 200 : 400, headers: { "Cache-Control": "no-store" } });
}
