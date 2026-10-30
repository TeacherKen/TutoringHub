import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import { MATERIALS_BUCKET } from "@/lib/constants";
import { boardLayout, cleanLive, cleanMark, insertPage, isUuid, removePage, type BoardInfo, type BoardPoll, type Live, type Mark } from "@/lib/boardShared";

// Smart slides on the server. Both the student's room (private link) and Mr Ken's
// view (signed in) come through here, after their own checks, using the admin client.

const MAX_MARKS_PER_BOARD = 6000;
const URL_HOURS = 6;
type Who = "student" | "tutor";

export const boardFolder = (studentId: string, boardId: string) => `boards/${studentId}/${boardId}`;
export const pagePath = (studentId: string, boardId: string, page: number) => `${boardFolder(studentId, boardId)}/${page + 1}.jpg`;

type BoardRow = { id: string; student_id: string; title: string; pages: number; aspect: number | string; layout?: number[] | null };

export async function getBoardRow(boardId: string): Promise<BoardRow | null> {
  if (!isUuid(boardId)) return null;
  const admin = createAdminClient();
  // "layout" arrives with database update 0010; work without it until then.
  for (const cols of ["id, student_id, title, pages, aspect, layout", "id, student_id, title, pages, aspect"]) {
    const { data, error } = await admin.from("boards").select(cols).eq("id", boardId).maybeSingle<BoardRow>();
    if (!error) return data ?? null;
  }
  return null;
}

/** New lines, rubbings-out and the other person's live info since `after`. */
export async function pollBoard(b: BoardRow, me: Who, after: number, withUrls: boolean): Promise<BoardPoll> {
  const admin = createAdminClient();
  const other: Who = me === "student" ? "tutor" : "student";
  const [marksRes, liveRes, urls] = await Promise.all([
    admin
      .from("board_marks")
      .select("id, page, author, data, deleted, rev")
      .eq("board_id", b.id)
      .gt("rev", after)
      .order("rev")
      .limit(2000),
    admin.from("board_live").select("page, tool, color, stroke, go_to, go_at, updated_at").eq("board_id", b.id).eq("who", other).maybeSingle<Live>(),
    withUrls
      ? admin.storage
          .from(MATERIALS_BUCKET)
          .createSignedUrls(
            Array.from({ length: b.pages }, (_, i) => pagePath(b.student_id, b.id, i)),
            URL_HOURS * 3600,
          )
      : Promise.resolve(null),
  ]);
  const marks = (marksRes.data ?? []) as Mark[];
  const board: BoardInfo = { id: b.id, title: b.title, pages: b.pages, aspect: Number(b.aspect), layout: boardLayout(b.pages, b.layout) };
  if (urls?.data) board.urls = urls.data.map((u) => u.signedUrl ?? "");
  return {
    board,
    marks: marks.map((m) => ({ ...m, rev: Number(m.rev) })),
    rev: marks.length ? Number(marks[marks.length - 1].rev) : after,
    other: liveRes.data ?? null,
  };
}

/** Handle one change sent from a screen: add a line, rub out, or "here's what I'm doing". */
export async function changeBoard(b: BoardRow, me: Who, body: unknown): Promise<{ ok: boolean; error?: string; layout?: number[] }> {
  const admin = createAdminClient();
  const req = (body ?? {}) as { op?: unknown; mark?: unknown; ids?: unknown; live?: unknown; page?: unknown; kind?: unknown };
  const layout = boardLayout(b.pages, b.layout);

  if (req.op === "add") {
    const m = (req.mark ?? {}) as { id?: unknown; page?: unknown; data?: unknown };
    const data = cleanMark(m.data);
    if (!isUuid(m.id) || !data || !Number.isInteger(m.page) || !layout.includes(m.page as number)) {
      return { ok: false, error: "bad mark" };
    }
    const { count } = await admin.from("board_marks").select("id", { count: "exact", head: true }).eq("board_id", b.id);
    if ((count ?? 0) >= MAX_MARKS_PER_BOARD) return { ok: false, error: "board full" };
    const { error } = await admin
      .from("board_marks")
      .upsert({ id: m.id, board_id: b.id, page: m.page, author: me, data }, { onConflict: "id", ignoreDuplicates: true });
    return { ok: !error };
  }

  if (req.op === "del") {
    const ids = Array.isArray(req.ids) ? req.ids.filter(isUuid).slice(0, 200) : [];
    if (!ids.length) return { ok: true };
    let q = admin.from("board_marks").update({ deleted: true }).eq("board_id", b.id).eq("deleted", false).in("id", ids);
    if (me === "student") q = q.eq("author", "student"); // students can't rub out Mr Ken's writing
    const { error } = await q;
    return { ok: !error };
  }

  if (req.op === "clear") {
    if (!Number.isInteger(req.page)) return { ok: false };
    let q = admin.from("board_marks").update({ deleted: true }).eq("board_id", b.id).eq("page", req.page).eq("deleted", false);
    if (me === "student") q = q.eq("author", "student");
    const { error } = await q;
    return { ok: !error };
  }

  if (req.op === "live") {
    const live = cleanLive(req.live, layout);
    if (!live) return { ok: false };
    const row: Record<string, unknown> = {
      board_id: b.id,
      who: me,
      page: live.page,
      tool: live.tool,
      color: live.color,
      stroke: live.stroke,
      updated_at: new Date().toISOString(),
    };
    if (me === "tutor" && live.go_to != null) {
      row.go_to = live.go_to;
      row.go_at = new Date().toISOString();
    }
    const { error } = await admin.from("board_live").upsert(row, { onConflict: "board_id,who" });
    return { ok: !error };
  }

  if (req.op === "addPage") {
    if (!Number.isInteger(req.page) || (req.kind !== "blank" && req.kind !== "grid")) return { ok: false };
    const next = insertPage(layout, req.page as number, req.kind);
    if (!next) return { ok: false, error: "Too many added pages." };
    const { error } = await admin.from("boards").update({ layout: next }).eq("id", b.id);
    return error ? { ok: false, error: "Run database update 0010 first." } : { ok: true, layout: next };
  }

  if (req.op === "removePage") {
    if (me !== "tutor" || !Number.isInteger(req.page)) return { ok: false };
    const next = removePage(layout, req.page as number);
    if (!next) return { ok: false };
    const { error } = await admin.from("boards").update({ layout: next }).eq("id", b.id);
    if (!error) await admin.from("board_marks").update({ deleted: true }).eq("board_id", b.id).eq("page", req.page).eq("deleted", false);
    return { ok: !error, layout: next };
  }

  return { ok: false, error: "unknown" };
}

/** The student's current smart slides, found from their room link. */
export async function boardForToken(token: string): Promise<BoardRow | null> {
  const { data } = await createAdminClient().from("students").select("active, board_id").eq("room_token", token).maybeSingle();
  if (!data?.active || !data.board_id) return null;
  return getBoardRow(data.board_id as string);
}
