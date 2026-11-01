// 🐺🐑 Wolf vs Sheep online: Mr Ken and a student play on their own screens. Moves travel over
// the live connection on a channel named after the student's private room link.

export const wvsChannel = (token: string) => `tutoringhub-wvs-${token}`;

export type Side = "wolf" | "sheep";
export type Peer = "tutor" | "student";
export type WvsMove = { pieceId: string; to: string };
export type WvsMsg = {
  type: "invite" | "here" | "sync" | "move" | "restart" | "need-sync" | "end" | "left" | "loaded" | "state";
  from?: Peer;
  /** true when it came from this screen's own game, not from the other screen */
  local?: boolean;
  studentSide?: Side;
  moves?: WvsMove[];
  n?: number;
  move?: WvsMove;
};

const TYPES = new Set(["invite", "here", "sync", "move", "restart", "need-sync", "end", "left", "loaded", "state"]);
const PIECE = /^(wolf|sheep(1[0-2]|[1-9]))$/;
const NODE = /^n(2[0-4]|1\d|\d)$/;

export const otherSide = (s: Side): Side => (s === "wolf" ? "sheep" : "wolf");
export const SIDE_NAME: Record<Side, string> = { wolf: "Wolf 🐺", sheep: "Sheep 🐑" };

export function cleanMove(raw: unknown): WvsMove | null {
  if (!raw || typeof raw !== "object") return null;
  const m = raw as Record<string, unknown>;
  return typeof m.pieceId === "string" && PIECE.test(m.pieceId) && typeof m.to === "string" && NODE.test(m.to) ? { pieceId: m.pieceId, to: m.to } : null;
}

/** Checks a message (from the other screen or the game) before using it. */
export function cleanWvs(raw: unknown): WvsMsg | null {
  if (!raw || typeof raw !== "object") return null;
  const d = raw as Record<string, unknown>;
  if (typeof d.type !== "string" || !TYPES.has(d.type)) return null;
  const msg: WvsMsg = { type: d.type as WvsMsg["type"] };
  if (d.from === "tutor" || d.from === "student") msg.from = d.from;
  if (d.studentSide === "wolf" || d.studentSide === "sheep") msg.studentSide = d.studentSide;
  if (Array.isArray(d.moves)) {
    const moves = d.moves.slice(0, 400).map(cleanMove);
    if (moves.some((m) => !m)) return null;
    msg.moves = moves as WvsMove[];
  }
  if (Number.isInteger(d.n) && (d.n as number) >= 1 && (d.n as number) <= 400) msg.n = d.n as number;
  const move = cleanMove(d.move);
  if (move) msg.move = move;
  if (msg.type === "move" && (!msg.move || !msg.n)) return null;
  return msg;
}
