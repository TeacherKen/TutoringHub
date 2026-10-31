import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import { cleanMode, cleanTables, updateFact, type Answer, type FactState, type GameMode } from "@/lib/facts";
import { isValidToken } from "@/lib/room";
import { statsFrom, type RoundRow, type TrophyStats } from "@/lib/trophies";

export type PracticeData = {
  name: string;
  tables: number[];
  progress: FactState[];
  sessions: { score: number; total: number; tables: number[]; created_at: string }[];
  best: number | null; // highest practice score ever, for "New high score!"
  stats: TrophyStats; // for stars and trophies
  mode: GameMode; // the game Mr Ken chose for this child
};

type Student = { id: string; first_name: string; tt_tables?: number[] | null; tt_mode?: string | null };
const FACT_COLS = "fact, box, correct, wrong, avg_ms, due_at, last_seen";

export async function studentForToken(token: string): Promise<Student | null> {
  if (!isValidToken(token)) return null;
  const admin = createAdminClient();
  for (const cols of ["id, first_name, active, tt_tables, tt_mode", "id, first_name, active, tt_tables", "id, first_name, active"]) {
    const { data, error } = await admin.from("students").select(cols).eq("room_token", token).maybeSingle<Student & { active: boolean }>();
    if (!error) return data?.active ? data : null;
  }
  return null;
}

/**
 * Every round these children have played, newest first (works before and after database
 * update 0017). Supabase sends at most 1000 rows per request, so this asks page by page.
 */
export async function loadRounds(studentIds: string[]): Promise<(RoundRow & { student_id: string })[]> {
  if (!studentIds.length) return [];
  const admin = createAdminClient();
  for (const cols of ["student_id, score, total, game, best_streak, powers, won, created_at", "student_id, score, total, game, created_at"]) {
    const out: (RoundRow & { student_id: string })[] = [];
    let failed = false;
    for (let from = 0; from < 10_000; from += 1000) {
      const { data, error } = await admin
        .from("practice_sessions")
        .select(cols)
        .in("student_id", studentIds)
        .order("created_at", { ascending: false })
        .range(from, from + 999);
      if (error) {
        failed = true;
        break;
      }
      out.push(...((data ?? []) as unknown as (RoundRow & { student_id: string })[]));
      if ((data ?? []).length < 1000) break;
    }
    if (!failed) return out;
  }
  return [];
}

export async function getPractice(s: Student): Promise<PracticeData | null> {
  const admin = createAdminClient();
  const [{ data: progress, error }, rounds] = await Promise.all([admin.from("fact_progress").select(FACT_COLS).eq("student_id", s.id), loadRounds([s.id])]);
  if (error) return null; // database update 0016 not run yet
  const facts = (progress ?? []) as FactState[];
  const practice = rounds.filter((r) => r.game !== "match");
  return {
    name: s.first_name,
    tables: cleanTables(s.tt_tables ?? []).length ? cleanTables(s.tt_tables) : [2, 3, 4],
    progress: facts,
    sessions: rounds
      .slice(0, 10)
      .map((r) => ({ score: r.score, total: r.total, tables: [], created_at: r.created_at })),
    best: practice.length ? Math.max(...practice.map((r) => Number(r.score))) : null,
    stats: statsFrom(rounds, facts),
    mode: cleanMode(s.tt_mode),
  };
}

/** Update each fact's box after some answers. */
export async function saveFacts(studentId: string, answers: Answer[]): Promise<boolean> {
  if (!answers.length) return true;
  const admin = createAdminClient();
  const facts = [...new Set(answers.map((a) => a.fact))];
  const { data: rows, error } = await admin.from("fact_progress").select(FACT_COLS).eq("student_id", studentId).in("fact", facts);
  if (error) return false;
  const state = new Map(((rows ?? []) as FactState[]).map((r) => [r.fact, r]));
  const now = new Date();
  for (const a of answers) state.set(a.fact, updateFact(state.get(a.fact), a, now));
  const { error: upErr } = await admin.from("fact_progress").upsert(
    facts.map((f) => ({ student_id: studentId, ...state.get(f)! })),
    { onConflict: "student_id,fact" },
  );
  return !upErr;
}

export type RoundExtras = { bestStreak?: number; powers?: number; game?: string; won?: boolean };

/** Add a finished round to the history. Returns false if it couldn't be saved. */
export async function saveRound(studentId: string, tables: number[], score: number, total: number, extra: RoundExtras = {}): Promise<boolean> {
  const t = Math.round(Number(total) || 0);
  if (t <= 0) return true; // nothing to save
  const admin = createAdminClient();
  const base = { student_id: studentId, game: extra.game ?? "tt", tables, score: Math.max(0, Math.min(Math.round(Number(score) || 0), t)), total: t };
  const full = {
    ...base,
    best_streak: Math.max(0, Math.min(99, Math.round(extra.bestStreak ?? 0))),
    powers: Math.max(0, Math.min(99, Math.round(extra.powers ?? 0))),
    ...(extra.won === undefined ? {} : { won: extra.won }),
  };
  const { error } = await admin.from("practice_sessions").insert(full);
  if (!error) return true;
  const { error: again } = await admin.from("practice_sessions").insert(base); // before database update 0017
  return !again;
}

/** Save a finished practice round: every answer updates that fact's box; the round goes in the history. */
export async function savePractice(studentId: string, answers: Answer[], tables: number[], score: number, total: number, extra: RoundExtras & { mode?: unknown } = {}): Promise<boolean> {
  if (!(await saveFacts(studentId, answers))) return false;
  const mode = cleanMode(extra.mode);
  return saveRound(studentId, tables, score, total, { bestStreak: extra.bestStreak, powers: extra.powers, game: mode === "times" ? "tt" : `tt-${mode}` });
}
