// Smart slides: shapes shared by the student's room, Mr Ken's view and the server.
// All positions are fractions of the page (0 to 1), so every screen size lines up.

export const COLORS = ["#1f2937", "#2563eb", "#dc2626", "#16a34a", "#ea580c", "#9333ea"] as const;
export const COLOR_NAMES: Record<string, string> = {
  "#1f2937": "black",
  "#2563eb": "blue",
  "#dc2626": "red",
  "#16a34a": "green",
  "#ea580c": "orange",
  "#9333ea": "purple",
  "#facc15": "yellow",
};
export const HIGHLIGHT = "#facc15";
export const SIZES = { thin: 0.003, thick: 0.007 } as const;

export type Tool = "pen" | "hl" | "text" | "eraser";
export const TOOL_NAMES: Record<string, string> = { pen: "✏️ Pen", hl: "🖍️ Highlighter", text: "🔤 Typing", eraser: "🧽 Eraser" };

export type StrokeData = { t: "pen" | "hl"; c: string; w: number; p: number[] };
export type TextData = { t: "text"; c: string; s: number; x: number; y: number; text: string };
export type MarkData = StrokeData | TextData;
export type Mark = { id: string; page: number; author: "student" | "tutor"; data: MarkData; deleted?: boolean; rev?: number };

export type Live = {
  page: number;
  tool: string | null;
  color: string | null;
  stroke: StrokeData | null;
  go_to?: number | null;
  go_at?: string | null;
  updated_at?: string;
};

export type BoardInfo = { id: string; title: string; pages: number; aspect: number; urls?: string[] };
export type BoardPoll = { board: BoardInfo | null; marks: Mark[]; rev: number; other: Live | null };

export const MAX_POINTS = 4000; // numbers (x,y pairs × 2) in one line
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const COLOR_RE = /^#[0-9a-f]{6}$/;

export const isUuid = (v: unknown): v is string => typeof v === "string" && UUID_RE.test(v);
const num = (v: unknown, lo: number, hi: number) => typeof v === "number" && Number.isFinite(v) && v >= lo && v <= hi;
const r4 = (n: number) => Math.round(n * 10000) / 10000;

/** Checks and cleans a line or typed word sent from a browser. Returns null if it isn't valid. */
export function cleanMark(raw: unknown): MarkData | null {
  if (!raw || typeof raw !== "object") return null;
  const d = raw as Record<string, unknown>;
  const c = typeof d.c === "string" && COLOR_RE.test(d.c) ? d.c : null;
  if (!c) return null;
  if (d.t === "pen" || d.t === "hl") {
    if (!num(d.w, 0.0005, 0.05) || !Array.isArray(d.p) || d.p.length < 2 || d.p.length > MAX_POINTS || d.p.length % 2) return null;
    if (!d.p.every((n) => num(n, -0.05, 1.05))) return null;
    return { t: d.t, c, w: r4(d.w as number), p: (d.p as number[]).map(r4) };
  }
  if (d.t === "text") {
    const text = typeof d.text === "string" ? d.text.replace(/[\u0000-\u001f]/g, " ").trim().slice(0, 200) : "";
    if (!text || !num(d.x, 0, 1) || !num(d.y, 0, 1) || !num(d.s, 0.01, 0.1)) return null;
    return { t: "text", c, s: r4(d.s as number), x: r4(d.x as number), y: r4(d.y as number), text };
  }
  return null;
}

export function cleanLive(raw: unknown, pages: number): Live | null {
  if (!raw || typeof raw !== "object") return null;
  const d = raw as Record<string, unknown>;
  if (!Number.isInteger(d.page) || (d.page as number) < 0 || (d.page as number) >= pages) return null;
  const stroke = d.stroke ? cleanMark(d.stroke) : null;
  return {
    page: d.page as number,
    tool: typeof d.tool === "string" && d.tool in TOOL_NAMES ? d.tool : null,
    color: typeof d.color === "string" && COLOR_RE.test(d.color) ? d.color : null,
    stroke: stroke && stroke.t !== "text" ? stroke : null,
    go_to: Number.isInteger(d.go_to) && (d.go_to as number) >= 0 && (d.go_to as number) < pages ? (d.go_to as number) : null,
  };
}

/** Is the point (x, y) within `r` of this mark? Used by the eraser. */
export function hitsMark(m: MarkData, x: number, y: number, r: number, aspect: number): boolean {
  if (m.t === "text") {
    const w = m.s * 0.55 * m.text.length;
    return x >= m.x - r && x <= m.x + w + r && y >= m.y - (m.s / aspect) - r && y <= m.y + r;
  }
  const rr = r + m.w;
  for (let i = 0; i < m.p.length; i += 2) {
    const dx = m.p[i] - x;
    const dy = (m.p[i + 1] - y) * aspect;
    if (dx * dx + dy * dy <= rr * rr) return true;
  }
  return false;
}
