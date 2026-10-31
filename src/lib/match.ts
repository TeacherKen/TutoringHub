import "server-only";
import { randomBytes } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/server";
import { answerFor, cleanMode, cleanTables, FAST_MS, isKind, kindsFor, parseFact, type FactState, type GameMode, type QuestionKind } from "@/lib/facts";
import { saveFacts, saveRound } from "@/lib/practice";

// Head-to-head matches: two to four children race to score `target` goals, each on their own
// device, each with their own times tables. The server checks every answer and decides who won.
// Anyone with the match link can watch or join, like a room link.

const TOKEN_RE = /^[A-Za-z0-9_-]{24,64}$/;
const DEVICE_RE = /^[A-Za-z0-9_-]{8,64}$/;
const COUNTDOWN_MS = 4000;
const KEEP_DAYS = 2;

export const isMatchToken = (t: string) => TOKEN_RE.test(t);
export const isDeviceId = (d: unknown): d is string => typeof d === "string" && DEVICE_RE.test(d);

export type MatchPlayer = { id: string; name: string; seat: number; tables: number[]; mode: GameMode; joined: boolean; goals: number; misses: number };
export type MatchState = {
  token: string;
  status: "waiting" | "playing" | "done";
  target: number;
  startsAt: string | null;
  winner: string | null;
  nextToken: string | null;
  now: string;
  players: MatchPlayer[];
  me: { id: string; progress: FactState[] } | null; // the player on this device
};

type MatchRow = { id: string; token: string; status: MatchState["status"]; target: number; starts_at: string | null; winner: string | null; next_token: string | null };
type PlayerRow = {
  student_id: string;
  seat: number;
  tables: number[];
  mode?: string | null; // arrives with database update 0018
  device: string | null;
  goals: number;
  misses: number;
  powers: number;
  streak: number;
  best_streak: number;
};

async function matchRow(token: string): Promise<MatchRow | null> {
  if (!isMatchToken(token)) return null;
  const { data } = await createAdminClient().from("matches").select("id, token, status, target, starts_at, winner, next_token").eq("token", token).maybeSingle<MatchRow>();
  return data ?? null;
}

async function playerRows(matchId: string): Promise<PlayerRow[]> {
  const admin = createAdminClient();
  for (const cols of ["student_id, seat, tables, mode, device, goals, misses, powers, streak, best_streak", "student_id, seat, tables, device, goals, misses, powers, streak, best_streak"]) {
    const { data, error } = await admin.from("match_players").select(cols).eq("match_id", matchId).order("seat");
    if (!error) return (data ?? []) as unknown as PlayerRow[];
  }
  return [];
}

/** Add players to a match (without game modes if database update 0018 hasn't been run). */
async function addPlayers(rows: { match_id: string; student_id: string; seat: number; tables: number[]; mode: GameMode; device?: string | null }[]) {
  const admin = createAdminClient();
  const { error } = await admin.from("match_players").insert(rows);
  if (!error) return null;
  if (rows.some((r) => r.mode !== "times")) return error;
  const { error: again } = await admin
    .from("match_players")
    .insert(rows.map((r) => ({ match_id: r.match_id, student_id: r.student_id, seat: r.seat, tables: r.tables, device: r.device ?? null })));
  return again;
}

/** `withProgress`: also send this device's player's fact progress (only needed once). */
export async function getMatch(token: string, device?: string | null, withProgress = false): Promise<MatchState | null> {
  const m = await matchRow(token);
  if (!m) return null;
  const admin = createAdminClient();
  const rows = await playerRows(m.id);
  const { data: kids } = await admin.from("students").select("id, first_name").in("id", rows.map((r) => r.student_id));
  const nameOf = new Map(((kids ?? []) as { id: string; first_name: string }[]).map((k) => [k.id, k.first_name]));
  const mine = device && isDeviceId(device) ? rows.find((r) => r.device === device) : undefined;
  let me: MatchState["me"] = null;
  if (mine && !withProgress) me = { id: mine.student_id, progress: [] };
  else if (mine) {
    const { data: facts } = await admin.from("fact_progress").select("fact, box, correct, wrong, avg_ms, due_at, last_seen").eq("student_id", mine.student_id);
    me = { id: mine.student_id, progress: (facts ?? []) as FactState[] };
  }
  return {
    token: m.token,
    status: m.status,
    target: m.target,
    startsAt: m.starts_at,
    winner: m.winner,
    nextToken: m.next_token,
    now: new Date().toISOString(),
    players: rows.map((r) => ({
      id: r.student_id,
      name: nameOf.get(r.student_id) ?? "Player",
      seat: r.seat,
      tables: r.tables,
      mode: cleanMode(r.mode),
      joined: !!r.device,
      goals: r.goals,
      misses: r.misses,
    })),
    me,
  };
}

/** Mr Ken sets up a match (call only after checking he's signed in). */
export async function createMatch(players: { studentId: string; tables: number[]; mode?: unknown }[], target: number): Promise<{ token?: string; error?: string }> {
  const list = players
    .map((p) => ({ studentId: p.studentId, tables: cleanTables(p.tables), mode: cleanMode(p.mode) }))
    .filter((p, i, all) => p.tables.length && all.findIndex((q) => q.studentId === p.studentId) === i);
  if (list.length < 2 || list.length > 4) return { error: "Choose 2 to 4 players." };
  const goals = Math.max(3, Math.min(30, Math.round(target) || 10));
  const admin = createAdminClient();
  await admin.from("matches").delete().lt("created_at", new Date(Date.now() - KEEP_DAYS * 86_400_000).toISOString());
  const token = randomBytes(24).toString("base64url");
  const { data: m, error } = await admin.from("matches").insert({ token, target: goals }).select("id").single();
  if (error || !m) return { error: "Couldn't start a match. Has database update 0017 been run?" };
  const pErr = await addPlayers(list.map((p, seat) => ({ match_id: m.id, student_id: p.studentId, seat, tables: p.tables, mode: p.mode })));
  if (pErr) {
    await admin.from("matches").delete().eq("id", m.id);
    return { error: list.some((p) => p.mode !== "times") ? "Couldn't add the players. Has database update 0018 been run?" : "Couldn't add the players." };
  }
  return { token };
}

/** "This is me": a child picks their name on a device. Taking over from another device is allowed. */
export async function joinMatch(token: string, studentId: string, device: string): Promise<{ ok: boolean; error?: string }> {
  const m = await matchRow(token);
  if (!m || m.status === "done" || !isDeviceId(device)) return { ok: false, error: "This match has finished." };
  const admin = createAdminClient();
  // One player per device: let go of any other seat this device had.
  await admin.from("match_players").update({ device: null }).eq("match_id", m.id).eq("device", device).neq("student_id", studentId);
  const { data, error } = await admin.from("match_players").update({ device, updated_at: new Date().toISOString() }).eq("match_id", m.id).eq("student_id", studentId).select("student_id");
  if (error || !data?.length) return { ok: false, error: "That player isn't in this match." };
  if (m.status === "waiting") {
    const rows = await playerRows(m.id);
    if (rows.every((r) => r.device)) {
      await admin
        .from("matches")
        .update({ status: "playing", starts_at: new Date(Date.now() + COUNTDOWN_MS).toISOString() })
        .eq("id", m.id)
        .eq("status", "waiting");
    }
  }
  return { ok: true };
}

type Tally = Pick<PlayerRow, "tables" | "mode" | "goals" | "misses" | "powers" | "streak" | "best_streak">;

/** Check one answer for a player: only facts from their own tables, and only their game's kinds of question. */
export function scoreAnswer(p: Tally, fact: string, kind: QuestionKind | unknown, answer: number, ms: number) {
  const f = parseFact(fact);
  const k: QuestionKind = isKind(kind) ? kind : "times";
  if (!f || !p.tables.includes(f[0]) || !kindsFor(cleanMode(p.mode)).includes(k) || !Number.isInteger(answer)) return null;
  const correct = answerFor({ fact, kind: k }) === answer;
  const time = Math.max(0, Math.min(120_000, Math.round(ms) || 0));
  const streak = correct ? p.streak + 1 : 0;
  return {
    correct,
    time,
    next: {
      goals: p.goals + (correct ? 1 : 0),
      misses: p.misses + (correct ? 0 : 1),
      powers: p.powers + (correct && time < FAST_MS ? 1 : 0),
      streak,
      best_streak: Math.max(p.best_streak, streak),
    },
  };
}

export type AnswerResult = { ok: boolean; correct?: boolean; goals?: number; done?: boolean; winner?: string | null };

/** Check one answer, add the goal (or the save), and finish the match when someone reaches the target. */
export async function answerMatch(token: string, device: string, fact: string, kind: unknown, answer: number, ms: number): Promise<AnswerResult> {
  const m = await matchRow(token);
  if (!m || !isDeviceId(device)) return { ok: false };
  if (m.status !== "playing") return { ok: false, done: m.status === "done", winner: m.winner };
  if (m.starts_at && Date.parse(m.starts_at) - 1500 > Date.now()) return { ok: false };
  const admin = createAdminClient();
  // Read, add the goal, write back — but only if nobody changed this player's score in between
  // (two answers arriving at once); if they did, read again and try again.
  let saved: { me: PlayerRow; scored: NonNullable<ReturnType<typeof scoreAnswer>> } | null = null;
  for (let attempt = 0; attempt < 4 && !saved; attempt++) {
    const rows = await playerRows(m.id);
    const me = rows.find((r) => r.device === device);
    const scored = me ? scoreAnswer(me, fact, kind, answer, ms) : null;
    if (!me || !scored) return { ok: false };
    const { data: upd, error } = await admin
      .from("match_players")
      .update({ ...scored.next, updated_at: new Date().toISOString() })
      .eq("match_id", m.id)
      .eq("student_id", me.student_id)
      .eq("goals", me.goals)
      .eq("misses", me.misses)
      .select("student_id");
    if (error) return { ok: false };
    if (upd?.length) saved = { me, scored };
  }
  if (!saved) return { ok: false };
  const { me } = saved;
  const { correct, time, next } = saved.scored;
  await saveFacts(me.student_id, [{ fact, correct, ms: time }]);

  if (next.goals >= m.target) {
    // Only the first child to get here wins (the update only works while there's no winner).
    const { data: won } = await admin.from("matches").update({ status: "done", winner: me.student_id }).eq("id", m.id).is("winner", null).select("id");
    if (won?.length) {
      const final = await playerRows(m.id);
      for (const p of final) {
        if (p.goals + p.misses === 0) continue;
        await saveRound(p.student_id, p.tables, p.goals, p.goals + p.misses, { game: "match", won: p.student_id === me.student_id, bestStreak: p.best_streak, powers: p.powers });
      }
      return { ok: true, correct, goals: next.goals, done: true, winner: me.student_id };
    }
    const { data: after } = await admin.from("matches").select("winner").eq("id", m.id).maybeSingle();
    return { ok: true, correct, goals: next.goals, done: true, winner: (after?.winner as string | null) ?? null };
  }
  return { ok: true, correct, goals: next.goals };
}

/** Same players, same tables, new match. Each device keeps its player, so it starts straight away. */
export async function rematch(token: string): Promise<{ token?: string }> {
  const m = await matchRow(token);
  if (!m || m.status !== "done") return {};
  if (m.next_token) return { token: m.next_token };
  const admin = createAdminClient();
  const rows = await playerRows(m.id);
  const fresh = randomBytes(24).toString("base64url");
  const allJoined = rows.every((r) => r.device);
  const { data: n, error } = await admin
    .from("matches")
    .insert({ token: fresh, target: m.target, ...(allJoined ? { status: "playing", starts_at: new Date(Date.now() + COUNTDOWN_MS + 1500).toISOString() } : {}) })
    .select("id")
    .single();
  if (error || !n) return {};
  const addErr = await addPlayers(rows.map((r) => ({ match_id: n.id, student_id: r.student_id, seat: r.seat, tables: r.tables, mode: cleanMode(r.mode), device: r.device })));
  if (addErr) {
    await admin.from("matches").delete().eq("id", n.id);
    return {};
  }
  const { data: linked } = await admin.from("matches").update({ next_token: fresh }).eq("id", m.id).is("next_token", null).select("id");
  if (!linked?.length) {
    // Someone else pressed Rematch at the same moment; use theirs.
    await admin.from("matches").delete().eq("id", n.id);
    const again = await matchRow(token);
    return { token: again?.next_token ?? undefined };
  }
  return { token: fresh };
}
