import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import { MATERIALS_BUCKET } from "@/lib/constants";
import { createHash, randomUUID } from "node:crypto";
import { BOARD_KEEP_DAYS, IMG_KEY_RE, boardExpired, boardLayout, resumeAt, cleanLive, cleanMark, insertPage, isUuid, removePage, type BoardInfo, type BoardPoll, type Live, type Mark, type MarkData } from "@/lib/boardShared";

// Smart slides on the server. Both the student's room (private link) and Mr Ken's
// view (signed in) come through here, after their own checks, using the admin client.

const MAX_MARKS_PER_BOARD = 6000;
const URL_HOURS = 6;
type Who = "student" | "tutor";

export const boardFolder = (studentId: string, boardId: string) => `boards/${studentId}/${boardId}`;
export const pagePath = (studentId: string, boardId: string, page: number) => `${boardFolder(studentId, boardId)}/${page + 1}.jpg`;

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const MAX_IMAGES = 80;

/** Store a pasted picture with the slides. Returns its key. */
export async function uploadBoardImage(b: { id: string; student_id: string }, bytes: ArrayBuffer, type: string): Promise<{ key?: string; error?: string }> {
  if (type !== "image/jpeg" && type !== "image/png") return { error: "Only JPG or PNG pictures." };
  if (!bytes.byteLength || bytes.byteLength > MAX_IMAGE_BYTES) return { error: "That picture is too big (4 MB max)." };
  const admin = createAdminClient();
  const folder = boardFolder(b.student_id, b.id);
  const { data: existing } = await admin.storage.from(MATERIALS_BUCKET).list(folder, { limit: 200, search: "img-" });
  if ((existing?.length ?? 0) >= MAX_IMAGES) return { error: "Too many pictures on these slides." };
  const key = `img-${randomUUID()}.${type === "image/png" ? "png" : "jpg"}`;
  const { error } = await admin.storage.from(MATERIALS_BUCKET).upload(`${folder}/${key}`, new Blob([bytes], { type }), { contentType: type });
  return error ? { error: "Couldn't save the picture." } : { key };
}

/** A short-lived link to a pasted picture (only for pictures on this board). */
export async function boardImageUrl(b: { id: string; student_id: string }, key: string): Promise<string | null> {
  if (!IMG_KEY_RE.test(key)) return null;
  const { data } = await createAdminClient().storage.from(MATERIALS_BUCKET).createSignedUrl(`${boardFolder(b.student_id, b.id)}/${key}`, 6 * 3600);
  return data?.signedUrl ?? null;
}

/** Every file of a board: page pictures and pasted pictures. */
export async function boardFiles(studentId: string, boardId: string, pages: number): Promise<string[]> {
  const folder = boardFolder(studentId, boardId);
  const { data } = await createAdminClient().storage.from(MATERIALS_BUCKET).list(folder, { limit: 1000 });
  const listed = (data ?? []).map((f) => `${folder}/${f.name}`);
  const pagesList = Array.from({ length: pages }, (_, i) => pagePath(studentId, boardId, i));
  return [...new Set([...pagesList, ...listed])];
}

type BoardRow = { id: string; student_id: string; title: string; pages: number; aspect: number | string; layout?: number[] | null; created_at?: string };

export async function getBoardRow(boardId: string): Promise<BoardRow | null> {
  if (!isUuid(boardId)) return null;
  const admin = createAdminClient();
  // "layout" arrives with database update 0010; work without it until then.
  for (const cols of ["id, student_id, title, pages, aspect, created_at, layout", "id, student_id, title, pages, aspect, created_at"]) {
    const { data, error } = await admin.from("boards").select(cols).eq("id", boardId).maybeSingle<BoardRow>();
    if (!error) return data ?? null;
  }
  return null;
}

/** The live channel's secret: made from the student's room link, so a reset link also closes the channel,
 *  and knowing the board's id alone isn't enough to draw on a child's screen. */
export const liveKey = (roomToken: string, boardId: string) => createHash("sha256").update(`board:${boardId}:${roomToken}`).digest("hex").slice(0, 32);

/** If I was on these slides in the last 2 hours, I'm still in the same lesson: stay on that page. */
function stillHere(layout: number[], mine: { page: number; updated_at: string } | null, now = Date.now()) {
  if (!mine || !layout.includes(mine.page)) return null;
  return now - Date.parse(mine.updated_at) < 2 * 3_600_000 ? { page: mine.page, after: null } : null;
}

/** New lines, rubbings-out and the other person's live info since `after`. */
export async function pollBoard(b: BoardRow, me: Who, after: number, withUrls: boolean): Promise<BoardPoll> {
  const admin = createAdminClient();
  const other: Who = me === "student" ? "tutor" : "student";
  const [marksRes, liveRes, urls, owner, mineRes, myLiveRes] = await Promise.all([
    admin
      .from("board_marks")
      .select("id, page, author, data, deleted, rev, created_at")
      .eq("board_id", b.id)
      .gt("rev", after)
      .order("rev")
      .limit(2000),
    admin.from("board_live").select("*").eq("board_id", b.id).eq("who", other).maybeSingle<Live>(),
    withUrls
      ? admin.storage
          .from(MATERIALS_BUCKET)
          .createSignedUrls(
            Array.from({ length: b.pages }, (_, i) => pagePath(b.student_id, b.id, i)),
            URL_HOURS * 3600,
          )
      : Promise.resolve(null),
    withUrls ? admin.from("students").select("room_token").eq("id", b.student_id).maybeSingle<{ room_token: string | null }>() : Promise.resolve(null),
    // Opening the slides: the page the child last wrote on (slides can last 2–3 lessons).
    withUrls
      ? admin
          .from("board_marks")
          .select("page, created_at")
          .eq("board_id", b.id)
          .eq("author", "student")
          .eq("deleted", false)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle<{ page: number; created_at: string }>()
      : Promise.resolve(null),
    // Re-opening during a lesson (a reload, a dropped connection): go back to the page I was on just now.
    withUrls ? admin.from("board_live").select("page, updated_at").eq("board_id", b.id).eq("who", me).maybeSingle<{ page: number; updated_at: string }>() : Promise.resolve(null),
  ]);
  const marks = (marksRes.data ?? []) as Mark[];
  const board: BoardInfo = { id: b.id, title: b.title, pages: b.pages, aspect: Number(b.aspect), layout: boardLayout(b.pages, b.layout) };
  if (urls?.data) board.urls = urls.data.map((u) => u.signedUrl ?? "");
  if (owner?.data?.room_token) board.live = liveKey(owner.data.room_token, b.id);
  return {
    board,
    marks: marks.map((m) => ({ ...m, rev: Number(m.rev) })),
    rev: marks.length ? Number(marks[marks.length - 1].rev) : after,
    other: liveRes.data ?? null,
    now: new Date().toISOString(),
    ...(withUrls ? { resume: stillHere(board.layout, myLiveRes?.data ?? null) ?? resumeAt(board.layout, mineRes?.data ?? null) } : {}),
  };
}

/** Handle one change sent from a screen: add a line, rub out, or "here's what I'm doing". */
export async function changeBoard(b: BoardRow, me: Who, body: unknown): Promise<{ ok: boolean; error?: string; layout?: number[] }> {
  const admin = createAdminClient();
  const req = (body ?? {}) as { op?: unknown; mark?: unknown; marks?: unknown; ids?: unknown; live?: unknown; page?: unknown; kind?: unknown };
  const layout = boardLayout(b.pages, b.layout);

  if (req.op === "addMany") {
    // Several things at once (e.g. moved together with ✋ Move). Anything not valid is skipped.
    const list = Array.isArray(req.marks) ? req.marks.slice(0, 100) : [];
    const rows: { id: string; board_id: string; page: number; author: Who; data: MarkData }[] = [];
    for (const raw of list) {
      const m = (raw ?? {}) as { id?: unknown; page?: unknown; data?: unknown };
      const data = cleanMark(m.data);
      if (isUuid(m.id) && data && Number.isInteger(m.page) && layout.includes(m.page as number)) {
        rows.push({ id: m.id, board_id: b.id, page: m.page as number, author: me, data });
      }
    }
    if (!rows.length) return { ok: false, error: "bad mark" };
    const { count } = await admin.from("board_marks").select("id", { count: "exact", head: true }).eq("board_id", b.id);
    if ((count ?? 0) + rows.length > MAX_MARKS_PER_BOARD) return { ok: false, error: "board full" };
    const { error } = await admin.from("board_marks").upsert(rows, { onConflict: "id", ignoreDuplicates: true });
    return { ok: !error };
  }

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

  if (req.op === "timer") {
    // Mr Ken starts (seconds) or stops (0) a countdown that shows on both screens.
    const secs = Number((body as { secs?: unknown }).secs);
    if (me !== "tutor" || !Number.isInteger(secs) || secs < 0 || secs > 3600) return { ok: false };
    const { error } = await admin.from("board_live").upsert(
      {
        board_id: b.id,
        who: "tutor",
        timer_end: secs ? new Date(Date.now() + secs * 1000).toISOString() : null,
        timer_secs: secs || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "board_id,who" },
    );
    return error ? { ok: false, error: "Run database update 0014 first." } : { ok: true };
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
  const b = await getBoardRow(data.board_id as string);
  return b && b.created_at && boardExpired(b.created_at) ? null : b; // past 4 weeks: gone from the room
}

let lastCleanup = 0;

/** Delete smart slides older than 4 weeks: their page pictures, writing and the record. */
export async function cleanupOldBoards(force = false): Promise<number> {
  if (!force && Date.now() - lastCleanup < 30 * 60_000) return 0;
  lastCleanup = Date.now();
  const admin = createAdminClient();
  const cutoff = new Date(Date.now() - BOARD_KEEP_DAYS * 86_400_000).toISOString();
  const { data } = await admin.from("boards").select("id, student_id, pages").lt("created_at", cutoff).limit(40);
  let removed = 0;
  for (const b of (data ?? []) as { id: string; student_id: string; pages: number }[]) {
    const paths = await boardFiles(b.student_id, b.id, b.pages);
    const { error: fileErr } = await admin.storage.from(MATERIALS_BUCKET).remove(paths);
    if (fileErr) continue; // try again next time rather than leave files without a record
    const { error } = await admin.from("boards").delete().eq("id", b.id); // writing goes with it
    if (!error) removed++;
  }
  return removed;
}
