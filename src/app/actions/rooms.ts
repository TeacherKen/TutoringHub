"use server";
import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { assertTutor } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const newToken = () => randomBytes(24).toString("base64url"); // 32 characters, unguessable

/** Get (or make) a student's room link token. */
export async function ensureRoomToken(studentId: string): Promise<{ token?: string; error?: string }> {
  await assertTutor();
  const supabase = await createClient();
  const { data } = await supabase.from("students").select("room_token").eq("id", studentId).single();
  if (data?.room_token) return { token: data.room_token as string };
  const token = newToken();
  const { error } = await supabase.from("students").update({ room_token: token }).eq("id", studentId);
  if (error) return { error: "Couldn't make the link." };
  revalidatePath("/", "layout");
  return { token };
}

/** Make a new link — the old one stops working. */
export async function resetRoomToken(studentId: string): Promise<{ token?: string; error?: string }> {
  await assertTutor();
  const token = newToken();
  const supabase = await createClient();
  const { error } = await supabase.from("students").update({ room_token: token, games_open: false }).eq("id", studentId);
  if (error) return { error: "Couldn't make a new link." };
  revalidatePath("/", "layout");
  return { token };
}

/** Open or close break-time games for these students (siblings in one lesson share a break). */
export async function setGamesOpen(studentIds: string[], open: boolean): Promise<{ ok: boolean }> {
  await assertTutor();
  const ids = studentIds.filter((x) => /^[0-9a-f-]{36}$/.test(x)).slice(0, 10);
  if (!ids.length) return { ok: false };
  const supabase = await createClient();
  const { error } = await supabase
    .from("students")
    .update({ games_open: open, games_opened_at: open ? new Date().toISOString() : null })
    .in("id", ids);
  revalidatePath("/", "layout");
  return { ok: !error };
}

/** "Current slides" that always show in the student's room (e.g. their ongoing Canva deck). */
export async function setStudentSlides(studentId: string, url: string, label: string): Promise<{ ok?: boolean; error?: string }> {
  await assertTutor();
  const clean = url.trim();
  let safe: string | null = null;
  if (clean) {
    try {
      const u = new URL(clean);
      if (u.protocol === "https:" || u.protocol === "http:") safe = u.toString();
    } catch {
      /* not a link */
    }
    if (!safe) return { error: "Please paste a full link starting with https://" };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("students")
    .update({ slides_url: safe, slides_label: safe ? label.trim().slice(0, 80) || null : null })
    .eq("id", studentId);
  if (error) return { error: "Couldn't save." };
  revalidatePath("/", "layout");
  return { ok: true };
}
