import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import { fmtScore, gameName, isMissionGame, lowerIsBetter, UNITS, variantLabel, type GamePlay, type MissionView, type ScoreUnit } from "@/lib/gameScore";
import { BUILT_IN } from "@/lib/games";

// 🎮 Game results (saved from a child's room link) and 🎯 homework missions.
// Nothing here works before database update 0031: every read quietly comes back empty.

const MAX_RESULTS_PER_DAY = 300;
const DONE_SHOWN_DAYS = 14;

type ResultRow = { student_id: string; game: string; variant: string; score: number; unit: ScoreUnit; created_at: string };
type MissionRow = { id: string; student_id: string; game: string; rounds: number; note: string | null; created_at: string; done_at: string | null };

/** Check a reported round. Returns null when it doesn't make sense (it is then dropped). */
export function cleanResult(game: unknown, body: { variant?: unknown; score?: unknown; unit?: unknown }) {
  if (typeof game !== "string" || !(BUILT_IN as readonly string[]).includes(game)) return null;
  const variant = typeof body.variant === "string" && /^[a-z0-9-]{0,60}$/i.test(body.variant) ? body.variant : "";
  const score = Number(body.score);
  if (!Number.isFinite(score) || score < 0 || score > 1_000_000) return null;
  const unit = UNITS.includes(body.unit as ScoreUnit) ? (body.unit as ScoreUnit) : null;
  if (!unit) return null;
  return { game, variant, score, unit };
}

/** Save one finished round, then tick off any mission it completes (and tell Mr Ken). */
export async function saveResult(student: { id: string; first_name: string }, r: { game: string; variant: string; score: number; unit: ScoreUnit }): Promise<boolean> {
  const admin = createAdminClient();
  const { count, error: countErr } = await admin
    .from("game_results")
    .select("id", { count: "exact", head: true })
    .eq("student_id", student.id)
    .gte("created_at", new Date(Date.now() - 86_400_000).toISOString());
  if (countErr) return false;
  if ((count ?? 0) >= MAX_RESULTS_PER_DAY) return false;
  const { error } = await admin.from("game_results").insert({ student_id: student.id, ...r });
  if (error) return false;

  const { data: open } = await admin.from("missions").select("id, game, rounds, created_at").eq("student_id", student.id).eq("game", r.game).is("done_at", null);
  for (const m of (open ?? []) as { id: string; game: string; rounds: number; created_at: string }[]) {
    const { count: played } = await admin
      .from("game_results")
      .select("id", { count: "exact", head: true })
      .eq("student_id", student.id)
      .eq("game", m.game)
      .gte("created_at", m.created_at);
    if ((played ?? 0) < m.rounds) continue;
    // Only the first round that finishes it marks it done (and sends the pop-up).
    const { data: marked } = await admin.from("missions").update({ done_at: new Date().toISOString() }).eq("id", m.id).is("done_at", null).select("id");
    if (!marked?.length) continue;
    const { notifyTutor } = await import("@/lib/push");
    await notifyTutor({
      title: `🎯 ${student.first_name} finished a mission`,
      body: `${gameName(m.game)}: ${m.rounds} round${m.rounds === 1 ? "" : "s"} done.`,
      url: `/students/${student.id}#games`,
      tag: `mission-${m.id}`,
    });
  }
  return true;
}

/** Open missions, and ones finished in the last two weeks, with how many rounds were played for each. */
export async function missionsFor(studentIds: string[]): Promise<Map<string, MissionView[]>> {
  const out = new Map<string, MissionView[]>();
  if (!studentIds.length) return out;
  const admin = createAdminClient();
  const doneSince = new Date(Date.now() - DONE_SHOWN_DAYS * 86_400_000).toISOString();
  const { data, error } = await admin
    .from("missions")
    .select("id, student_id, game, rounds, note, created_at, done_at")
    .in("student_id", studentIds)
    .or(`done_at.is.null,done_at.gte.${doneSince}`)
    .order("created_at", { ascending: false })
    .limit(60);
  if (error || !data?.length) return out;
  const missions = data as MissionRow[];
  const oldest = missions.reduce((a, m) => (m.created_at < a ? m.created_at : a), missions[0].created_at);
  const { data: res } = await admin
    .from("game_results")
    .select("student_id, game, created_at")
    .in("student_id", studentIds)
    .gte("created_at", oldest)
    .limit(5000);
  const rows = (res ?? []) as { student_id: string; game: string; created_at: string }[];
  for (const m of missions) {
    const played = rows.filter((r) => r.student_id === m.student_id && r.game === m.game && r.created_at >= m.created_at).length;
    const view: MissionView = {
      id: m.id,
      game: m.game,
      name: gameName(m.game),
      rounds: m.rounds,
      played: Math.min(played, m.rounds),
      note: m.note,
      done: Boolean(m.done_at),
      doneAt: m.done_at,
      createdAt: m.created_at,
    };
    out.set(m.student_id, [...(out.get(m.student_id) ?? []), view]);
  }
  // To do first (oldest first), then done (newest first).
  for (const [k, list] of out) {
    out.set(k, [...list.filter((m) => !m.done).reverse(), ...list.filter((m) => m.done)]);
  }
  return out;
}


/** What each child has played in the last `days` days: one line per game and level, most recent first. */
export async function playsFor(studentIds: string[], days = 30): Promise<Map<string, GamePlay[]>> {
  const out = new Map<string, GamePlay[]>();
  if (!studentIds.length) return out;
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("game_results")
    .select("student_id, game, variant, score, unit, created_at")
    .in("student_id", studentIds)
    .gte("created_at", new Date(Date.now() - days * 86_400_000).toISOString())
    .order("created_at", { ascending: false })
    .limit(3000);
  if (error || !data) return out;
  const groups = new Map<string, ResultRow[]>();
  for (const r of data as ResultRow[]) {
    const k = `${r.student_id}|${r.game}|${r.variant}`;
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }
  for (const rows of groups.values()) {
    const first = rows[0]; // newest
    const lower = lowerIsBetter(first.unit);
    const best = rows.reduce((a, r) => ((lower ? Number(r.score) < Number(a.score) : Number(r.score) > Number(a.score)) ? r : a), first);
    const line: GamePlay = {
      game: first.game,
      name: gameName(first.game),
      variant: first.variant,
      level: variantLabel(first.game, first.variant),
      plays: rows.length,
      best: fmt(best),
      last: fmt(first),
      lastAt: first.created_at,
    };
    out.set(first.student_id, [...(out.get(first.student_id) ?? []), line]);
  }
  for (const [k, list] of out) out.set(k, list.sort((a, b) => b.lastAt.localeCompare(a.lastAt)));
  return out;
}

const fmt = (r: ResultRow) => fmtScore(Number(r.score), r.unit);

export { isMissionGame };
