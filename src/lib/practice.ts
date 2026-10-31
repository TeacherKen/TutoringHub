import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import { cleanTables, updateFact, type Answer, type FactState } from "@/lib/facts";
import { isValidToken } from "@/lib/room";

export type PracticeData = { name: string; tables: number[]; progress: FactState[]; sessions: { score: number; total: number; tables: number[]; created_at: string }[] };

type Student = { id: string; first_name: string; tt_tables?: number[] | null };

export async function studentForToken(token: string): Promise<Student | null> {
  if (!isValidToken(token)) return null;
  const admin = createAdminClient();
  for (const cols of ["id, first_name, active, tt_tables", "id, first_name, active"]) {
    const { data, error } = await admin.from("students").select(cols).eq("room_token", token).maybeSingle<Student & { active: boolean }>();
    if (!error) return data?.active ? data : null;
  }
  return null;
}

export async function getPractice(s: Student): Promise<PracticeData | null> {
  const admin = createAdminClient();
  const [{ data: progress, error }, { data: sessions }] = await Promise.all([
    admin.from("fact_progress").select("fact, box, correct, wrong, avg_ms, due_at, last_seen").eq("student_id", s.id),
    admin.from("practice_sessions").select("score, total, tables, created_at").eq("student_id", s.id).order("created_at", { ascending: false }).limit(10),
  ]);
  if (error) return null; // database update 0016 not run yet
  return {
    name: s.first_name,
    tables: cleanTables(s.tt_tables ?? []).length ? cleanTables(s.tt_tables) : [2, 3, 4],
    progress: (progress ?? []) as FactState[],
    sessions: (sessions ?? []) as PracticeData["sessions"],
  };
}

/** Save a finished round: every answer updates that fact's box; the round goes in the history. */
export async function savePractice(studentId: string, answers: Answer[], tables: number[], score: number, total: number): Promise<boolean> {
  const admin = createAdminClient();
  const facts = [...new Set(answers.map((a) => a.fact))];
  const { data: rows, error } = await admin.from("fact_progress").select("fact, box, correct, wrong, avg_ms, due_at, last_seen").eq("student_id", studentId).in("fact", facts);
  if (error) return false;
  const state = new Map(((rows ?? []) as FactState[]).map((r) => [r.fact, r]));
  const now = new Date();
  for (const a of answers) state.set(a.fact, updateFact(state.get(a.fact), a, now));
  const upserts = facts.map((f) => ({ student_id: studentId, ...state.get(f)! }));
  const { error: upErr } = await admin.from("fact_progress").upsert(upserts, { onConflict: "student_id,fact" });
  if (upErr) return false;
  if (total > 0) await admin.from("practice_sessions").insert({ student_id: studentId, game: "tt", tables, score: Math.max(0, Math.min(score, total)), total });
  return true;
}
