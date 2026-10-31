"use server";
import { assertTutor } from "@/lib/auth";
import { isUuid } from "@/lib/boardShared";
import { createMatch } from "@/lib/match";

/** Mr Ken starts a head-to-head match from the Play page. */
export async function startMatch(players: { studentId: string; tables: number[] }[], target: number): Promise<{ token?: string; error?: string }> {
  await assertTutor();
  if (!Array.isArray(players) || players.some((p) => !isUuid(p?.studentId) || !Array.isArray(p?.tables))) return { error: "Choose the players again." };
  return createMatch(players, target);
}
