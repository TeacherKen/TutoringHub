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
  "#4ade80": "green",
  "#f472b6": "pink",
  "#60a5fa": "blue",
  "#fb923c": "orange",
};
export const HIGHLIGHT = "#facc15";
/** Highlighter colours (see-through when drawn). */
export const HL_COLORS = ["#facc15", "#4ade80", "#f472b6", "#60a5fa", "#fb923c"] as const;
export const SIZES = { thin: 0.003, thick: 0.007 } as const;

export type Tool = "select" | "pen" | "hl" | "line" | "rect" | "text" | "eraser" | "pointer";
export const TOOL_NAMES: Record<string, string> = { pen: "✏️ Pen", hl: "🖍️ Highlighter", text: "🔤 Typing", eraser: "🧽 Eraser", pointer: "👆 Point", line: "📏 Line", rect: "▭ Box", select: "✋ Move" };

/** pen / highlighter: a path of points; line / rect: two corners [x1, y1, x2, y2]. */
export type StrokeData = { t: "pen" | "hl" | "line" | "rect"; c: string; w: number; p: number[] };
export type TextData = { t: "text"; c: string; s: number; x: number; y: number; text: string };
/** A pasted picture: file key (stored with the slides) and its place on the page. */
export type ImageData = { t: "img"; k: string; x: number; y: number; w: number; h: number };
export type MarkData = StrokeData | TextData | ImageData;
export const IMG_KEY_RE = /^img-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png)$/;
export type Mark = { id: string; page: number; author: "student" | "tutor"; data: MarkData; deleted?: boolean; rev?: number };

export type Live = {
  page: number;
  tool: string | null;
  color: string | null;
  stroke: StrokeData | null;
  go_to?: number | null;
  go_at?: string | null;
  updated_at?: string;
  /** Tutor only: countdown end time and length. */
  timer_end?: string | null;
  timer_secs?: number | null;
};

export type BoardInfo = { id: string; title: string; pages: number; aspect: number; layout: number[]; urls?: string[] };

// Pages have fixed numbers so writing stays on the right page when pages are added:
// 0, 1, 2… are the PDF's own pages, 1000+ are blank pages and 2000+ are squared paper.
export const BLANK_BASE = 1000;
export const GRID_BASE = 2000;
export const MAX_EXTRA_PAGES = 40;
export type PageKind = "slide" | "blank" | "grid";
export const pageKind = (id: number): PageKind => (id >= GRID_BASE ? "grid" : id >= BLANK_BASE ? "blank" : "slide");

/** The order of pages: the PDF's pages, unless pages have been added. */
export function boardLayout(pages: number, layout?: number[] | null): number[] {
  return layout && layout.length ? layout : Array.from({ length: pages }, (_, i) => i);
}

/** Add a blank or squared page straight after `after` (or at the end). */
export function insertPage(layout: number[], after: number, kind: "blank" | "grid"): number[] | null {
  const extras = layout.filter((id) => pageKind(id) !== "slide");
  if (extras.length >= MAX_EXTRA_PAGES) return null;
  const base = kind === "grid" ? GRID_BASE : BLANK_BASE;
  const used = layout.filter((id) => pageKind(id) === kind);
  const id = used.length ? Math.max(...used) + 1 : base;
  if (id >= base + 999) return null;
  const at = layout.indexOf(after);
  const next = [...layout];
  next.splice(at < 0 ? next.length : at + 1, 0, id);
  return next;
}

/** Remove an added page (the PDF's own pages always stay). */
export function removePage(layout: number[], id: number): number[] | null {
  if (pageKind(id) === "slide" || !layout.includes(id)) return null;
  return layout.filter((x) => x !== id);
}
export type BoardPoll = { board: BoardInfo | null; marks: Mark[]; rev: number; other: Live | null; now?: string };

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
  if (d.t === "img") {
    if (typeof d.k !== "string" || !IMG_KEY_RE.test(d.k)) return null;
    if (!num(d.x, 0, 1) || !num(d.y, 0, 1) || !num(d.w, 0.01, 1) || !num(d.h, 0.01, 1)) return null;
    return { t: "img", k: d.k, x: r4(d.x as number), y: r4(d.y as number), w: r4(d.w as number), h: r4(d.h as number) };
  }
  const c = typeof d.c === "string" && COLOR_RE.test(d.c) ? d.c : null;
  if (!c) return null;
  if (d.t === "pen" || d.t === "hl" || d.t === "line" || d.t === "rect") {
    if (!num(d.w, 0.0005, 0.05) || !Array.isArray(d.p) || d.p.length < 2 || d.p.length > MAX_POINTS || d.p.length % 2) return null;
    if ((d.t === "line" || d.t === "rect") && d.p.length !== 4) return null;
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

export function cleanLive(raw: unknown, layout: number[]): Live | null {
  if (!raw || typeof raw !== "object") return null;
  const d = raw as Record<string, unknown>;
  if (!Number.isInteger(d.page) || !layout.includes(d.page as number)) return null;
  const stroke = d.stroke ? cleanMark(d.stroke) : null;
  return {
    page: d.page as number,
    tool: typeof d.tool === "string" && d.tool in TOOL_NAMES ? d.tool : null,
    color: typeof d.color === "string" && COLOR_RE.test(d.color) ? d.color : null,
    stroke: stroke && stroke.t !== "text" && stroke.t !== "img" ? stroke : null,
    go_to: Number.isInteger(d.go_to) && layout.includes(d.go_to as number) ? (d.go_to as number) : null,
  };
}

/** Is the point (x, y) within `r` of this mark? Used by the eraser. */
export function hitsMark(m: MarkData, x: number, y: number, r: number, aspect: number): boolean {
  if (m.t === "img") return x >= m.x - r && x <= m.x + m.w + r && y >= m.y - r / aspect && y <= m.y + m.h + r / aspect;
  if (m.t === "text") {
    const w = m.s * 0.55 * m.text.length;
    return x >= m.x - r && x <= m.x + w + r && y >= m.y - (m.s / aspect) - r && y <= m.y + r;
  }
  const rr = r + m.w;
  if (m.t === "line" || m.t === "rect") {
    const [x1, y1, x2, y2] = m.p;
    const segs =
      m.t === "line"
        ? [[x1, y1, x2, y2]]
        : [
            [x1, y1, x2, y1],
            [x2, y1, x2, y2],
            [x2, y2, x1, y2],
            [x1, y2, x1, y1],
          ];
    return segs.some(([ax, ay, bx, by]) => segDist(x, y * aspect, ax, ay * aspect, bx, by * aspect) <= rr);
  }
  for (let i = 0; i < m.p.length; i += 2) {
    const dx = m.p[i] - x;
    const dy = (m.p[i + 1] - y) * aspect;
    if (dx * dx + dy * dy <= rr * rr) return true;
  }
  return false;
}

// ---- Moving and resizing (the ✋ Move tool) -------------------------------------------
export type Box = { x1: number; y1: number; x2: number; y2: number };
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const r4b = (n: number) => Math.round(n * 10000) / 10000;

/** The rectangle around a mark (fractions of the page). */
export function markBounds(m: MarkData, aspect: number): Box {
  if (m.t === "img") return { x1: m.x, y1: m.y, x2: m.x + m.w, y2: m.y + m.h };
  if (m.t === "text") {
    const w = m.s * 0.55 * m.text.length;
    return { x1: m.x, y1: m.y - m.s / aspect, x2: Math.min(1, m.x + w), y2: m.y + (m.s * 0.25) / aspect };
  }
  let x1 = 1, y1 = 1, x2 = 0, y2 = 0;
  for (let i = 0; i < m.p.length; i += 2) {
    x1 = Math.min(x1, m.p[i]);
    x2 = Math.max(x2, m.p[i]);
    y1 = Math.min(y1, m.p[i + 1]);
    y2 = Math.max(y2, m.p[i + 1]);
  }
  const pad = m.w / 2;
  return { x1: x1 - pad, y1: y1 - pad / aspect, x2: x2 + pad, y2: y2 + pad / aspect };
}

/** Is (x, y) on this mark, or inside a box / word? Used to pick something to move. */
export function grabsMark(m: MarkData, x: number, y: number, r: number, aspect: number): boolean {
  if (m.t === "rect" || m.t === "text") {
    const b = markBounds(m, aspect);
    if (x >= b.x1 - r && x <= b.x2 + r && y >= b.y1 - r / aspect && y <= b.y2 + r / aspect) return true;
  }
  return hitsMark(m, x, y, r, aspect);
}

/** The same mark moved by (dx, dy), kept on the page. */
export function translateMark(m: MarkData, dx: number, dy: number, aspect: number): MarkData {
  const b = markBounds(m, aspect);
  const ddx = Math.min(Math.max(dx, -b.x1), 1 - b.x2);
  const ddy = Math.min(Math.max(dy, -b.y1), 1 - b.y2);
  if (m.t === "text" || m.t === "img") return { ...m, x: r4b(m.x + ddx), y: r4b(m.y + ddy) };
  return { ...m, p: m.p.map((v, i) => r4b(v + (i % 2 ? ddy : ddx))) };
}

/** Grab points for resizing: the two ends of a line, the four corners of a box. */
export function handlesOf(m: MarkData): [number, number][] {
  if (m.t === "img") return [[m.x, m.y], [m.x + m.w, m.y], [m.x + m.w, m.y + m.h], [m.x, m.y + m.h]];
  if (m.t === "line") return [[m.p[0], m.p[1]], [m.p[2], m.p[3]]];
  if (m.t === "rect") {
    const [x1, y1, x2, y2] = m.p;
    return [[x1, y1], [x2, y1], [x2, y2], [x1, y2]];
  }
  return [];
}

/** Drag handle number `h` to (x, y). */
export function moveHandle(m: MarkData, h: number, x: number, y: number, aspect: number): MarkData {
  if (m.t === "img") {
    // Pictures keep their shape: the opposite corner stays put.
    const left = h === 0 || h === 3;
    const top = h === 0 || h === 1;
    const fx = left ? m.x + m.w : m.x;
    const fy = top ? m.y + m.h : m.y;
    const ratio = m.h / m.w;
    let w = Math.max(0.03, Math.abs(clamp01(x) - fx));
    w = Math.min(w, left ? fx : 1 - fx, (top ? fy : 1 - fy) / ratio);
    const hh = w * ratio;
    return { ...m, x: r4b(left ? fx - w : fx), y: r4b(top ? fy - hh : fy), w: r4b(w), h: r4b(hh) };
  }
  if (m.t !== "line" && m.t !== "rect") return m;
  const p = [...m.p];
  const cx = r4b(clamp01(x));
  const cy = r4b(clamp01(y));
  if (m.t === "line") {
    const [fx, fy] = h === 0 ? [p[2], p[3]] : [p[0], p[1]];
    const [sx, sy] = snapLine(fx, fy, cx, cy, aspect);
    if (h === 0) [p[0], p[1]] = [sx, sy];
    else [p[2], p[3]] = [sx, sy];
  } else {
    const xi = h === 0 || h === 3 ? 0 : 2;
    const yi = h === 0 || h === 1 ? 1 : 3;
    p[xi] = cx;
    p[yi] = cy;
  }
  return { ...m, p };
}

/** Distance from point (px, py) to the segment a–b (all in page-width units). */
function segDist(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const len = dx * dx + dy * dy;
  const t = len ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len)) : 0;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** Straight lines snap to flat or upright when they're nearly so (neat bar models and number lines). */
export function snapLine(x1: number, y1: number, x2: number, y2: number, aspect: number): [number, number] {
  const dx = x2 - x1;
  const dy = (y2 - y1) * aspect;
  const angle = Math.abs((Math.atan2(dy, dx) * 180) / Math.PI);
  if (angle < 7 || angle > 173) return [x2, y1];
  if (Math.abs(angle - 90) < 7) return [x1, y2];
  return [x2, y2];
}

// Smart slides delete themselves 4 weeks after upload, so old PDFs don't pile up.
// (Pictures saved with "Save work to lesson" are kept — they belong to the lesson.)
export const BOARD_KEEP_DAYS = 28;
export const boardExpiry = (createdAt: string): Date => new Date(new Date(createdAt).getTime() + BOARD_KEEP_DAYS * 86_400_000);
export const boardExpired = (createdAt: string, now = Date.now()): boolean => boardExpiry(createdAt).getTime() <= now;
