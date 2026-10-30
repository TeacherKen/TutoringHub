import "server-only";
import { NextResponse } from "next/server";
import { changeBoard, pollBoard, type getBoardRow } from "@/lib/board";

type BoardRow = NonNullable<Awaited<ReturnType<typeof getBoardRow>>>;
const MAX_BODY = 120_000;
const noStore = { "Cache-Control": "no-store" };

export async function boardGet(req: Request, board: BoardRow | null, me: "student" | "tutor") {
  if (!board) return NextResponse.json({ board: null, marks: [], rev: 0, other: null }, { headers: noStore });
  const u = new URL(req.url);
  const after = Math.max(0, Number(u.searchParams.get("after")) || 0);
  const withUrls = u.searchParams.get("urls") === "1";
  return NextResponse.json(await pollBoard(board, me, after, withUrls), { headers: noStore });
}

export async function boardPost(req: Request, board: BoardRow | null, me: "student" | "tutor") {
  if (!board) return NextResponse.json({ ok: false }, { status: 404 });
  const text = await req.text();
  if (text.length > MAX_BODY) return NextResponse.json({ ok: false }, { status: 413 });
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const r = await changeBoard(board, me, body);
  return NextResponse.json(r, { status: r.ok ? 200 : 400, headers: noStore });
}
