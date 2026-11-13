// 👀 Watch live: while Mr Ken watches, the student's room tells his screen what they're doing.
// Messages go over the live connection (Supabase Realtime) on a channel named after the
// student's private room link, so only someone who has that link can join it.

import { cleanMode, MODES, type GameMode } from "@/lib/facts";

export const watchChannel = (token: string) => `tutoringhub-watch-${token}`;

/** Pictures bigger than this go the slower way (saved through the app every 2 seconds). */
export const MAX_LIVE_HTML = 180_000;
/** Biggest picture we squeeze and send live (squeezed, it's about 4 times smaller). */
export const MAX_RAW_HTML = 600_000;

/** Squeezes a picture (gzip, as text) so it travels about 4 times faster. null: this browser can't. */
export async function packHtml(html: string): Promise<string | null> {
  try {
    if (typeof CompressionStream === "undefined") return null;
    const stream = new Blob([html]).stream().pipeThrough(new CompressionStream("gzip"));
    const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
    let bin = "";
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  } catch {
    return null;
  }
}

/** Opens a squeezed picture again. */
export async function unpackHtml(z: string): Promise<string | null> {
  try {
    if (typeof DecompressionStream === "undefined") return null;
    const bin = atob(z);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
    const html = await new Response(stream).text();
    return html.length <= MAX_RAW_HTML ? html : null;
  } catch {
    return null;
  }
}

/** One answer in a football round. */
export type KickLog = { text: string; given: string; correct: boolean; ms: number; second: boolean };

/** Football Times Tables, right now. */
export type PracticeLive = {
  stage: "setup" | "play" | "done";
  mode: GameMode;
  tables: number[];
  /** The question with its blank (null), and the right answer. */
  q: { parts: (string | null)[]; answer: number } | null;
  typed: string;
  second: boolean;
  kick: number;
  kicks: number;
  goals: number;
  misses: number;
  streak: number;
  log: KickLog[];
  score: number | null;
  total: number | null;
};

export type WatchView = {
  tab: "lesson" | "practice" | "games";
  game: string | null;
  practice: PracticeLive | null;
  /** A picture of the game screen (left out when it hasn't changed). */
  html?: string;
  /** The same picture, squeezed (see packHtml). */
  z?: string;
  /** Counts pictures, so a late one never replaces a newer one. */
  n?: number;
  /** The room is sending a live copy of its screen (see liveCopy.ts) instead of pictures. */
  copy?: boolean;
};

const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
const int = (v: unknown, lo: number, hi: number) => (typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v))) : lo);

function cleanPractice(raw: unknown): PracticeLive | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Record<string, unknown>;
  const stage = p.stage === "play" || p.stage === "done" ? p.stage : "setup";
  const q = p.q && typeof p.q === "object" ? (p.q as Record<string, unknown>) : null;
  const parts = q && Array.isArray(q.parts) ? q.parts.slice(0, 5).map((x) => (x === null ? null : str(x, 6))) : null;
  return {
    stage,
    mode: (MODES as readonly unknown[]).includes(p.mode) ? cleanMode(p.mode) : "times",
    tables: Array.isArray(p.tables) ? p.tables.filter((t): t is number => Number.isInteger(t) && t >= 1 && t <= 12).slice(0, 12) : [],
    q: parts ? { parts, answer: int(q!.answer, 0, 999) } : null,
    typed: str(p.typed, 4).replace(/\D/g, ""),
    second: p.second === true,
    kick: int(p.kick, 0, 99),
    kicks: int(p.kicks, 0, 99),
    goals: int(p.goals, 0, 99),
    misses: int(p.misses, 0, 99),
    streak: int(p.streak, 0, 99),
    log: Array.isArray(p.log)
      ? p.log.slice(-20).map((raw) => {
          const l = (raw ?? {}) as Record<string, unknown>;
          return { text: str(l.text, 24), given: str(l.given, 4), correct: l.correct === true, ms: int(l.ms, 0, 600_000), second: l.second === true };
        })
      : [],
    score: p.score == null ? null : int(p.score, 0, 99),
    total: p.total == null ? null : int(p.total, 0, 99),
  };
}

/** Checks a message from a student's room before Mr Ken's screen shows it. */
export function cleanView(raw: unknown): WatchView | null {
  if (!raw || typeof raw !== "object") return null;
  const v = raw as Record<string, unknown>;
  const tab = v.tab === "practice" || v.tab === "games" ? v.tab : v.tab === "lesson" ? "lesson" : null;
  if (!tab) return null;
  const view: WatchView = {
    tab,
    game: typeof v.game === "string" && /^[a-z-]{1,20}$/.test(v.game) ? v.game : null,
    practice: tab === "practice" ? cleanPractice(v.practice) : null,
  };
  if (typeof v.html === "string" && v.html.length <= MAX_LIVE_HTML) view.html = v.html;
  if (typeof v.z === "string" && v.z.length <= MAX_LIVE_HTML && /^[A-Za-z0-9+/=]+$/.test(v.z)) view.z = v.z;
  if (typeof v.n === "number" && Number.isFinite(v.n)) view.n = v.n;
  if (v.copy === true) view.copy = true;
  return view;
}

/** "1.8 s" for the watch panel. */
export const secs = (ms: number) => `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)} s`;

