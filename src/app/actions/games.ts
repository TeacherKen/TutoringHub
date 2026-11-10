"use server";
import { revalidatePath } from "next/cache";
import { assertTutor } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isMissionGame } from "@/lib/gameScore";

const ID_RE = /^[0-9a-f-]{36}$/;

/** 🎯 Give a child a homework mission: play this game for this many rounds. */
export async function addMission(studentId: string, game: string, rounds: number, note: string): Promise<{ ok?: boolean; error?: string }> {
  await assertTutor();
  if (!ID_RE.test(studentId)) return { error: "Unknown student." };
  if (!isMissionGame(game)) return { error: "Pick a game." };
  const n = Math.round(Number(rounds));
  if (!(n >= 1 && n <= 20)) return { error: "Rounds must be 1 to 20." };
  const supabase = await createClient();
  const clean = String(note ?? "").trim().slice(0, 200) || null;
  const { error } = await supabase.from("missions").insert({ student_id: studentId, game, rounds: n, note: clean });
  if (error) return { error: "Couldn't save. Has database update 0031 been run?" };
  revalidatePath(`/students/${studentId}`);
  return { ok: true };
}

/** Take a mission away (it disappears from the child's room and the family page). Game results are kept. */
export async function removeMission(studentId: string, missionId: string): Promise<{ ok?: boolean; error?: string }> {
  await assertTutor();
  if (!ID_RE.test(studentId) || !ID_RE.test(missionId)) return { error: "Unknown mission." };
  const supabase = await createClient();
  const { error } = await supabase.from("missions").delete().eq("id", missionId).eq("student_id", studentId);
  if (error) return { error: "Couldn't remove. Try again." };
  revalidatePath(`/students/${studentId}`);
  return { ok: true };
}
