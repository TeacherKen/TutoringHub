"use server";
import { revalidatePath } from "next/cache";
import { assertTutor } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/boardShared";
import { MATERIALS_BUCKET } from "@/lib/constants";
import { pagePath } from "@/lib/board";

/** Called after the browser has turned a PDF into page pictures and uploaded them. */
export async function createBoard(studentId: string, boardId: string, title: string, pages: number, aspect: number): Promise<{ ok?: boolean; error?: string }> {
  await assertTutor();
  if (!isUuid(studentId) || !isUuid(boardId)) return { error: "Bad id." };
  if (!Number.isInteger(pages) || pages < 1 || pages > 60) return { error: "Slides must have 1 to 60 pages." };
  if (!Number.isFinite(aspect) || aspect <= 0.2 || aspect >= 5) return { error: "Unusual page size." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("boards")
    .insert({ id: boardId, student_id: studentId, title: title.trim().slice(0, 120) || "Slides", pages, aspect: Math.round(aspect * 10000) / 10000 });
  if (error) return { error: "Couldn't save. Has database update 0009 been run?" };
  await supabase.from("students").update({ board_id: boardId }).eq("id", studentId);
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Choose which smart slides show in the student's room (or none). */
export async function setCurrentBoard(studentId: string, boardId: string | null): Promise<{ ok: boolean }> {
  await assertTutor();
  if (!isUuid(studentId) || (boardId !== null && !isUuid(boardId))) return { ok: false };
  const supabase = await createClient();
  const { error } = await supabase.from("students").update({ board_id: boardId }).eq("id", studentId);
  revalidatePath("/", "layout");
  return { ok: !error };
}

/** Delete smart slides, their page pictures and everything written on them. */
export async function deleteBoard(boardId: string): Promise<{ ok: boolean }> {
  await assertTutor();
  if (!isUuid(boardId)) return { ok: false };
  const supabase = await createClient();
  const { data: b } = await supabase.from("boards").select("student_id, pages").eq("id", boardId).maybeSingle();
  if (!b) return { ok: false };
  await supabase.storage
    .from(MATERIALS_BUCKET)
    .remove(Array.from({ length: b.pages as number }, (_, i) => pagePath(b.student_id as string, boardId, i)));
  const { error } = await supabase.from("boards").delete().eq("id", boardId);
  revalidatePath("/", "layout");
  return { ok: !error };
}

export type BoardSummary = { id: string; title: string; pages: number; created_at: string };

/** This student's smart slides, newest first. */
export async function listBoards(studentId: string): Promise<{ boards: BoardSummary[]; ready: boolean }> {
  await assertTutor();
  if (!isUuid(studentId)) return { boards: [], ready: true };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("boards")
    .select("id, title, pages, created_at")
    .eq("student_id", studentId)
    .order("created_at", { ascending: false })
    .limit(30);
  return { boards: (data ?? []) as BoardSummary[], ready: !error };
}
