// Game results and homework missions: the parts both the server and the browser use.

import { GAMES } from "@/lib/games";

/** How a game measures a round: tenths of a second, seconds (lower is better), points or stars (higher is better). */
export type ScoreUnit = "ds" | "s" | "pts" | "stars";
export const UNITS: readonly ScoreUnit[] = ["ds", "s", "pts", "stars"];
export const lowerIsBetter = (u: ScoreUnit) => u === "ds" || u === "s";

/** One finished round, as a game reports it. `variant` is the game's level key, e.g. "qm-easy". */
export type GameResult = { variant: string; score: number; unit: ScoreUnit };

/** Games that save a result at the end of each round, so they can be set as missions. */
export const MISSION_GAMES = ["qm", "tt", "sd", "fp", "ff", "fc", "ck", "ms", "pb", "sb", "bp", "pl", "mn", "ns"] as const;
export const isMissionGame = (id: string) => (MISSION_GAMES as readonly string[]).includes(id);
export const gameName = (id: string) => GAMES.find((g) => g.id === id)?.name ?? id;

export function fmtScore(score: number, unit: ScoreUnit): string {
  const n = Number(score);
  if (unit === "ds") return `${(n / 10).toFixed(1)}s`;
  if (unit === "s") return n >= 60 ? `${Math.floor(n / 60)}m ${String(Math.round(n % 60)).padStart(2, "0")}s` : `${Math.round(n)}s`;
  if (unit === "stars") return `${"★".repeat(Math.max(0, Math.min(5, Math.round(n))))}` || "0 stars";
  return `${Math.round(n)} point${Math.round(n) === 1 ? "" : "s"}`;
}

const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/** "qm-easy" → "Easy", "sudoku-4" → "4 × 4", "tt-2-3-4" → "×2, 3, 4", "ms-thb-change" → "THB · Change". */
export function variantLabel(game: string, variant: string): string {
  const parts = variant.split("-").slice(1).filter(Boolean);
  if (!parts.length) return "";
  if (game === "tt") return `×${parts.join(", ")}`;
  if (game === "sd" || game === "ns") return `${parts[0]} × ${parts[0]}`;
  if (game === "sb") return cap(parts[parts.length - 1]);
  if (game === "ms" || game === "pb") return [parts[0].toUpperCase(), ...parts.slice(1).map(cap)].join(" · ");
  return parts.map(cap).join(" · ");
}

/** A mission as the child's room and the pages show it. */
export type MissionView = { id: string; game: string; name: string; rounds: number; played: number; note: string | null; done: boolean; doneAt: string | null; createdAt: string };

/** One game and level a child played lately: how often, their best and their last result. */
export type GamePlay = { game: string; name: string; variant: string; level: string; plays: number; best: string; last: string; lastAt: string };
