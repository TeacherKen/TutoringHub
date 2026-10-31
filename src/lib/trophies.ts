// Stars and trophies for Football Times Tables. Everything is worked out from the rounds a
// child has played and how well they know each fact, so nothing extra needs to be stored.

import { factKey, level, TABLES, UP_TO, type FactState } from "./facts";

export type RoundRow = {
  score: number;
  total: number;
  game?: string | null;
  best_streak?: number | null;
  powers?: number | null;
  won?: boolean | null;
  created_at: string;
};

export type TrophyStats = {
  rounds: number;
  stars: number;
  powers: number;
  bestStreak: number;
  perfect: number;
  wins: number;
  dayKeys: string[]; // Bangkok dates practised
  tableKnown: Record<number, number>; // facts known really well, per table
};

export type TrophyIcon = "ball" | "star" | "flame" | "bolt" | "target" | "calendar" | "cup" | "table";
export type Trophy = { id: string; name: string; how: string; icon: TrophyIcon; have: number; need: number; got: boolean; table?: number };

const bkkDay = (iso: string) => new Date(Date.parse(iso) + 7 * 3_600_000).toISOString().slice(0, 10);

/** Stars for one round: practice rounds by score, matches 3 for a win and 1 for playing. */
export function roundStars(r: Pick<RoundRow, "score" | "game" | "won">): number {
  if (r.game === "match") return r.won ? 3 : 1;
  return r.score >= 9 ? 3 : r.score >= 7 ? 2 : r.score >= 5 ? 1 : 0;
}

export function tableKnown(progress: FactState[]): Record<number, number> {
  const by = new Map(progress.map((p) => [p.fact, p]));
  const out: Record<number, number> = {};
  for (const t of TABLES) out[t] = Array.from({ length: UP_TO }, (_, i) => level(by.get(factKey(t, i + 1)))).filter((l) => l === "mastered").length;
  return out;
}

export function statsFrom(rounds: RoundRow[], progress: FactState[]): TrophyStats {
  return {
    rounds: rounds.length,
    stars: rounds.reduce((n, r) => n + roundStars(r), 0),
    powers: rounds.reduce((n, r) => n + (Number(r.powers) || 0), 0),
    bestStreak: rounds.reduce((n, r) => Math.max(n, Number(r.best_streak) || 0), 0),
    perfect: rounds.filter((r) => r.game !== "match" && r.total > 0 && r.score >= r.total && r.total >= 10).length,
    wins: rounds.filter((r) => r.game === "match" && r.won).length,
    dayKeys: [...new Set(rounds.map((r) => bkkDay(r.created_at)))].sort(),
    tableKnown: tableKnown(progress),
  };
}

/** The same stats after one more round (used to show "New trophy!" straight away). */
export function addRound(s: TrophyStats, r: RoundRow, progress: FactState[]): TrophyStats {
  return {
    rounds: s.rounds + 1,
    stars: s.stars + roundStars(r),
    powers: s.powers + (Number(r.powers) || 0),
    bestStreak: Math.max(s.bestStreak, Number(r.best_streak) || 0),
    perfect: s.perfect + (r.game !== "match" && r.total >= 10 && r.score >= r.total ? 1 : 0),
    wins: s.wins + (r.game === "match" && r.won ? 1 : 0),
    dayKeys: [...new Set([...s.dayKeys, bkkDay(r.created_at)])].sort(),
    tableKnown: tableKnown(progress),
  };
}

export function trophies(s: TrophyStats): Trophy[] {
  const t = (id: string, name: string, how: string, icon: TrophyIcon, have: number, need: number, table?: number): Trophy => ({
    id,
    name,
    how,
    icon,
    have: Math.min(have, need),
    need,
    got: have >= need,
    ...(table ? { table } : {}),
  });
  return [
    t("first", "Kick-off", "Play your first match", "ball", s.rounds, 1),
    t("perfect", "Perfect match", "Score 10 out of 10", "target", s.perfect, 1),
    t("fire", "On fire", "Score 5 goals in a row", "flame", s.bestStreak, 5),
    t("power10", "Power striker", "Score 10 power shots", "bolt", s.powers, 10),
    t("power50", "Rocket boots", "Score 50 power shots", "bolt", s.powers, 50),
    t("stars25", "25 stars", "Collect 25 stars", "star", s.stars, 25),
    t("stars50", "50 stars", "Collect 50 stars", "star", s.stars, 50),
    t("stars100", "100 stars", "Collect 100 stars", "star", s.stars, 100),
    t("days5", "Never misses training", "Practise on 5 different days", "calendar", s.dayKeys.length, 5),
    t("win1", "Match winner", "Win a head-to-head match", "cup", s.wins, 1),
    t("win5", "Champion", "Win 5 head-to-head matches", "cup", s.wins, 5),
    ...TABLES.map((n) => t(`table${n}`, `${n}× master`, `Know every ${n}× fact really well`, "table", s.tableKnown[n] ?? 0, UP_TO, n)),
  ];
}

/** Trophies that are won now but weren't before. */
export function newTrophies(before: Trophy[], after: Trophy[]): Trophy[] {
  const had = new Set(before.filter((t) => t.got).map((t) => t.id));
  return after.filter((t) => t.got && !had.has(t.id));
}

/** Which trophies to show: all won ones, plus the ones still to win — table trophies only for
 *  the tables this child works on (so a 6-year-old doesn't see a wall of 9× and 10× locks). */
export function shelf(all: Trophy[], focusTables: number[]): Trophy[] {
  const show = all.filter((t) => t.got || !t.table || focusTables.includes(t.table) || t.have > 0);
  return [...show.filter((t) => t.got), ...show.filter((t) => !t.got)];
}
