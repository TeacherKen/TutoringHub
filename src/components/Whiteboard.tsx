"use client";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { addMaterialFile } from "@/app/actions/lessons";
import { MATERIALS_BUCKET } from "@/lib/constants";
import { SaveQueue, type QueuedOp, type SendResult } from "@/lib/saveQueue";
import { randomId } from "@/lib/randomId";
import {
  cleanMark,
  COLORS,
  COLOR_NAMES,
  HIGHLIGHT,
  HL_COLORS,
  SIZES,
  TOOL_NAMES,
  hitsMark,
  snapLine,
  grabsMark,
  handlesOf,
  markBounds,
  groupBounds,
  insideBox,
  markBatches,
  moveHandle,
  translateGroup,
  pageKind,
  type BoardInfo,
  type BoardPoll,
  type Live,
  type Mark,
  type MarkData,
  type StrokeData,
  type Tool,
  scaleGroup,
} from "@/lib/boardShared";

// Smart slides: page pictures with a drawing layer on top. The student and Mr Ken
// both use this. Changes go straight to the other screen over a live connection
// (Supabase Realtime), and are also saved through the app's server, which each
// screen checks every few seconds to catch anything the live connection missed.

const POLL_MS = 1000; // when the live connection isn't working
const POLL_LIVE_MS = 3000; // when it is
const LIVE_MS = 400;
const LIVE_RT_MS = 70;
const HEARTBEAT_MS = 8000;
const HL_WIDTH = 0.022;
const TEXT_SIZE = 0.03;
const ERASE_R = 0.015;

type Props = {
  api: string;
  me: "student" | "tutor";
  otherName: string;
  /** Shown when there are no smart slides (student side). */
  empty?: React.ReactNode;
  /** Tutor only: the lesson that "Save work" adds the pictures to. */
  saveLessonId?: string | null;
};

/** ✋ Move: resizing one thing, moving the selected things, or dragging a box to select. */
type Drag =
  | { mode: "handle"; id: string; handle: number; x: number; y: number; preview: MarkData | null }
  | { mode: "move"; ids: string[]; x: number; y: number; previews: Map<string, MarkData> | null }
  /** The corner dot of the selection: make everything selected bigger or smaller together. */
  | { mode: "scale"; ids: string[]; x1: number; y1: number; x2: number; y2: number; previews: Map<string, MarkData> | null }
  | { mode: "box"; x: number; y: number; x2: number; y2: number; base: string[]; tap: string | null };

/**
 * Where the "grow / shrink" dot goes (screen pixels): the bottom-right corner of what's selected.
 * Shown for several things, or for one thing without its own resize dots (handwriting, typing).
 */
function scaleCorner(list: MarkData[], W: number, H: number): [number, number] | null {
  if (!list.length || (list.length === 1 && handlesOf(list[0]).length)) return null;
  const g = groupBounds(list, H / W);
  const pad = list.length > 1 ? 8 : 4;
  return [g.x2 * W + pad, g.y2 * H + pad];
}

const GRID_CELLS = 32; // squares across a squared-paper page
const GRID_LINE = "#d6def0";

function drawGrid(ctx: CanvasRenderingContext2D, W: number, H: number) {
  const cell = W / GRID_CELLS;
  ctx.save();
  ctx.strokeStyle = GRID_LINE;
  ctx.lineWidth = Math.max(1, W / 1600);
  ctx.beginPath();
  for (let x = cell; x < W; x += cell) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
  }
  for (let y = cell; y < H; y += cell) {
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
  }
  ctx.stroke();
  ctx.restore();
}

type ImageGetter = (key: string) => CanvasImageSource | null;

function drawMark(ctx: CanvasRenderingContext2D, m: MarkData, W: number, H: number, alpha = 1, images?: ImageGetter) {
  ctx.save();
  if (m.t === "img") {
    const img = images?.(m.k) ?? null;
    ctx.globalAlpha = alpha;
    if (img) ctx.drawImage(img, m.x * W, m.y * H, m.w * W, m.h * H);
    else {
      // Still loading: a light placeholder the same size.
      ctx.fillStyle = "rgba(148,163,184,0.15)";
      ctx.strokeStyle = "rgba(148,163,184,0.6)";
      ctx.fillRect(m.x * W, m.y * H, m.w * W, m.h * H);
      ctx.strokeRect(m.x * W, m.y * H, m.w * W, m.h * H);
    }
    ctx.restore();
    return;
  }
  if (m.t === "text") {
    ctx.globalAlpha = alpha;
    ctx.fillStyle = m.c;
    ctx.font = `600 ${m.s * W}px ui-rounded, system-ui, sans-serif`;
    ctx.textBaseline = "alphabetic";
    ctx.fillText(m.text, m.x * W, m.y * H);
    ctx.restore();
    return;
  }
  ctx.globalAlpha = (m.t === "hl" ? 0.35 : 1) * alpha;
  ctx.strokeStyle = m.c;
  ctx.fillStyle = m.c;
  ctx.lineWidth = Math.max(1, m.w * W);
  if (m.t === "line" || m.t === "rect") {
    const [x1, y1, x2, y2] = m.p;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    if (m.t === "line") {
      ctx.moveTo(x1 * W, y1 * H);
      ctx.lineTo(x2 * W, y2 * H);
    } else {
      ctx.rect(Math.min(x1, x2) * W, Math.min(y1, y2) * H, Math.abs(x2 - x1) * W, Math.abs(y2 - y1) * H);
    }
    ctx.stroke();
    ctx.restore();
    return;
  }
  ctx.lineCap = m.t === "hl" ? "butt" : "round";
  ctx.lineJoin = "round";
  const p = m.p;
  if (p.length <= 4) {
    ctx.beginPath();
    ctx.arc(p[0] * W, p[1] * H, ctx.lineWidth / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }
  ctx.beginPath();
  ctx.moveTo(p[0] * W, p[1] * H);
  for (let i = 2; i < p.length - 2; i += 2) {
    const mx = ((p[i] + p[i + 2]) / 2) * W;
    const my = ((p[i + 1] + p[i + 3]) / 2) * H;
    ctx.quadraticCurveTo(p[i] * W, p[i + 1] * H, mx, my);
  }
  ctx.lineTo(p[p.length - 2] * W, p[p.length - 1] * H);
  ctx.stroke();
  ctx.restore();
}

/** A short, gentle "time's up" sound. */
function beep() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    for (const [i, f] of [880, 660, 880].entries()) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.25);
      g.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + i * 0.25 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.25 + 0.22);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + i * 0.25);
      o.stop(ctx.currentTime + i * 0.25 + 0.24);
    }
    setTimeout(() => void ctx.close(), 1200);
  } catch {
    /* no sound — the screen still shows "Time's up!" */
  }
}

async function post(api: string, body: unknown) {
  try {
    await fetch(api, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  } catch {
    /* offline for a moment */
  }
}

/** One page as a picture: the slide (or blank / squared paper) with all the writing on it. */
export async function pagePicture(board: BoardInfo, id: number, all: Iterable<Mark>, imageUrl?: (key: string) => string): Promise<Blob> {
  const W = 1600;
  const H = Math.round(W * board.aspect);
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);
  if (pageKind(id) === "slide" && board.urls?.[id]) {
    const img = await createImageBitmap(await (await fetch(board.urls[id])).blob());
    ctx.drawImage(img, 0, 0, W, H);
  } else if (pageKind(id) === "grid") {
    drawGrid(ctx, W, H);
  }
  const list = [...all].filter((m) => m.page === id);
  const pics = new Map<string, ImageBitmap>();
  if (imageUrl) {
    for (const m of list) {
      if (m.data.t !== "img" || pics.has(m.data.k)) continue;
      try {
        pics.set(m.data.k, await createImageBitmap(await (await fetch(imageUrl(m.data.k))).blob()));
      } catch {
        /* skip a picture that won't load */
      }
    }
  }
  for (const m of list) drawMark(ctx, m.data, W, H, 1, (k) => pics.get(k) ?? null);
  return new Promise<Blob>((ok, bad) => c.toBlob((b) => (b ? ok(b) : bad(new Error("image"))), "image/jpeg", 0.88));
}

/** Which slides the arrow keys turn on Mr Ken's page: the ones his mouse is over or last touched. */
let activeBoard: string | null = null;

export function Whiteboard({ api, me, otherName, empty, saveLessonId }: Props) {
  const isTutor = me === "tutor";
  const router = useRouter();
  const [pageMenu, setPageMenu] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [pointer, setPointer] = useState<{ x: number; y: number; page: number } | null>(null);
  const [unsaved, setUnsaved] = useState({ pending: 0, failing: false });
  const [pencilOnly, setPencilOnly] = useState(false);
  const queue = useRef<SaveQueue | null>(null);
  const pencilRef = useRef(false);
  const activePointer = useRef<number | null>(null);
  const touches = useRef(new Set<number>());
  const pointerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPoint = useRef(0);
  const [board, setBoard] = useState<BoardInfo | null>(null);
  const [missing, setMissing] = useState(false);
  const [page, setPage] = useState(0);
  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState<string>(isTutor ? "#dc2626" : "#2563eb");
  const [hlColor, setHlColor] = useState<string>(HIGHLIGHT);
  const [brought, setBrought] = useState<number | null>(null);
  const [timer, setTimer] = useState<{ endsAt: number; total: number } | null>(null);
  const [timerMenu, setTimerMenu] = useState(false);
  const [clock, setClock] = useState(0);
  const timerSetAt = useRef(0);
  const beepedFor = useRef(0);
  // Undo history: each step lists the marks it added and the marks it took away.
  const history = useRef<{ add: Mark[]; del: Mark[] }[]>([]);
  const future = useRef<{ add: Mark[]; del: Mark[] }[]>([]);
  const eraseStep = useRef<Mark[] | null>(null);
  const lastErase = useRef<{ x: number; y: number } | null>(null);
  const pictures = useRef(new Map<string, HTMLImageElement>());
  const fileInput = useRef<HTMLInputElement>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const selectedRef = useRef<string[]>([]);
  const drag = useRef<Drag | null>(null);
  const keys = useRef<{ undo: () => void; redo: () => void; del: () => void; all: () => void; none: () => void; turn: (by: number) => void }>({
    undo: () => {},
    redo: () => {},
    del: () => {},
    all: () => {},
    none: () => {},
    turn: () => {},
  });
  // 📑 All pages as small pictures, to jump straight to one (like Canva's page list).
  const [pagesOpen, setPagesOpen] = useState(false);
  const [size, setSize] = useState<keyof typeof SIZES>("thin");
  const [other, setOther] = useState<Live | null>(null);
  const [follow, setFollow] = useState(true);
  const [textAt, setTextAt] = useState<{ x: number; y: number } | null>(null);
  const [textValue, setTextValue] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);
  const [full, setFull] = useState(false);
  const [stage, setStage] = useState({ w: 0, h: 0 });
  const stageRef = useRef<HTMLDivElement>(null);
  const [, setVersion] = useState(0);
  const [now, setNow] = useState(0);

  const marks = useRef(new Map<string, Mark>());
  const removed = useRef(new Set<string>());
  const rev = useRef(0);
  const boardIdRef = useRef<string | null>(null);
  const lastGoAt = useRef<string | null | undefined>(undefined);
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef<number[] | null>(null);
  const erasing = useRef(false);
  const sizeRef = useRef({ W: 0, H: 0, dpr: 1 });
  const lastLive = useRef(0);
  const lastHttpLive = useRef(0);
  const channel = useRef<RealtimeChannel | null>(null);
  const rtOk = useRef(false);
  const lastRt = useRef(0);
  const stateRef = useRef({ page, tool, color, follow, hlColor });
  useLayoutEffect(() => {
    stateRef.current = { page, tool, color, follow, hlColor };
  }, [page, tool, color, follow, hlColor]);

  const bump = () => setVersion((v) => v + 1);

  // ---- Drawing on the canvas -------------------------------------------------
  const render = useCallback(() => {
    const c = canvas.current;
    const { W, H, dpr } = sizeRef.current;
    if (!c || !W) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const pg = stateRef.current.page;
    const d = drag.current;
    // While dragging, things being moved or resized are drawn where they're going.
    const shown = (m: Mark): MarkData =>
      d?.mode === "handle" && d.id === m.id && d.preview ? d.preview : d?.mode === "move" || d?.mode === "scale" ? (d.previews?.get(m.id) ?? m.data) : m.data;
    for (const m of marks.current.values()) {
      if (m.page !== pg) continue;
      drawMark(ctx, shown(m), W, H, 1, picture);
    }
    if (other?.stroke && other.page === pg) drawMark(ctx, other.stroke, W, H, 0.6);
    if (drawing.current) drawMark(ctx, currentStroke(drawing.current), W, H);
    if (stateRef.current.tool === "select") {
      const aspect = H / W;
      const sel = selectedRef.current.map((id) => marks.current.get(id)).filter((m): m is Mark => !!m && m.page === pg);
      ctx.save();
      ctx.strokeStyle = "#0f766e";
      ctx.lineWidth = 1.5;
      if (sel.length === 1) {
        // One thing: a dashed box around it, and dots to drag for resizing.
        const data = shown(sel[0]);
        const b = markBounds(data, aspect);
        ctx.setLineDash([6, 4]);
        ctx.strokeRect(b.x1 * W - 4, b.y1 * H - 4, (b.x2 - b.x1) * W + 8, (b.y2 - b.y1) * H + 8);
        ctx.setLineDash([]);
        for (const [hx, hy] of handlesOf(data)) {
          ctx.beginPath();
          ctx.arc(hx * W, hy * H, 7, 0, Math.PI * 2);
          ctx.fillStyle = "#ffffff";
          ctx.fill();
          ctx.stroke();
        }
      } else if (sel.length > 1) {
        // Several things: a light outline on each, and one box around them all (grab anywhere inside it).
        const datas = sel.map(shown);
        ctx.globalAlpha = 0.45;
        ctx.setLineDash([3, 3]);
        for (const data of datas) {
          const b = markBounds(data, aspect);
          ctx.strokeRect(b.x1 * W - 2, b.y1 * H - 2, (b.x2 - b.x1) * W + 4, (b.y2 - b.y1) * H + 4);
        }
        ctx.globalAlpha = 1;
        const g = groupBounds(datas, aspect);
        ctx.fillStyle = "rgba(15, 118, 110, 0.06)";
        ctx.fillRect(g.x1 * W - 8, g.y1 * H - 8, (g.x2 - g.x1) * W + 16, (g.y2 - g.y1) * H + 16);
        ctx.setLineDash([6, 4]);
        ctx.strokeRect(g.x1 * W - 8, g.y1 * H - 8, (g.x2 - g.x1) * W + 16, (g.y2 - g.y1) * H + 16);
      }
      // The corner dot: drag it to make what's selected bigger or smaller.
      const corner = scaleCorner(sel.map(shown), W, H);
      if (corner) {
        ctx.setLineDash([]);
        ctx.fillStyle = "#0f766e";
        ctx.beginPath();
        ctx.arc(corner[0], corner[1], 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.strokeStyle = "#0f766e";
        ctx.lineWidth = 1.5;
      }
      // The box being dragged to select things.
      if (d?.mode === "box") {
        const x = Math.min(d.x, d.x2) * W;
        const y = Math.min(d.y, d.y2) * H;
        const w = Math.abs(d.x2 - d.x) * W;
        const h = Math.abs(d.y2 - d.y) * H;
        ctx.fillStyle = "rgba(15, 118, 110, 0.10)";
        ctx.fillRect(x, y, w, h);
        ctx.setLineDash([5, 4]);
        ctx.strokeRect(x, y, w, h);
      }
      ctx.restore();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [other]);

  /** Address of a pasted picture (through this app, so only people on this board can see it). */
  function imageSrc(key: string) {
    return `${api}/image?k=${encodeURIComponent(key)}`;
  }

  /** A loaded picture, or null while it loads (then the page redraws). */
  function picture(key: string): HTMLImageElement | null {
    let img = pictures.current.get(key);
    if (!img) {
      img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => render();
      img.src = imageSrc(key);
      pictures.current.set(key, img);
    }
    return img.complete && img.naturalWidth ? img : null;
  }

  function currentStroke(p: number[]): StrokeData {
    const { tool: t, color: c, hlColor: h } = stateRef.current;
    if (t === "hl") return { t: "hl", c: h, w: HL_WIDTH, p };
    if (t === "line" || t === "rect") return { t, c, w: SIZES[size], p: p.slice(0, 4) };
    return { t: "pen", c, w: SIZES[size], p };
  }

  // Keep the canvas the same size as the page picture.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      const W = e.contentRect.width;
      const H = e.contentRect.height;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      sizeRef.current = { W, H, dpr };
      if (canvas.current) {
        canvas.current.width = Math.round(W * dpr);
        canvas.current.height = Math.round(H * dpr);
      }
      render();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [board, render]);

  useEffect(() => {
    render();
  });

  /** Pages were added or removed (by me or the other person). */
  const applyLayout = useCallback((layout: number[]) => {
    setBoard((b) => (b && b.layout.join() !== layout.join() ? { ...b, layout } : b));
    // If the page I'm on was removed, go to the first page.
    setPage((p) => (layout.includes(p) ? p : (layout[0] ?? 0)));
  }, []);

  // ---- Live connection ---------------------------------------------------------------
  const broadcast = useCallback((event: string, payload: Record<string, unknown>) => {
    const ch = channel.current;
    if (!ch || !rtOk.current) return false;
    void ch.send({ type: "broadcast", event, payload: { ...payload, who: me } });
    return true;
  }, [me]);

  /** Something the other person is doing right now (page, tool, line being drawn). */
  const applyOther = useCallback(
    (o: Live, fromLive: boolean) => {
      if (fromLive) lastRt.current = Date.now();
      setOther(o);
      setNow(Date.now());
      const st = stateRef.current;
      if (isTutor && st.follow && o.page !== st.page && !drawing.current) setPage(o.page);
    },
    [isTutor],
  );

  const boardId = board?.id;
  const live = board?.live;
  useEffect(() => {
    if (!boardId || !live) return; // no room link yet: checking every second still works
    let sb: ReturnType<typeof createClient>;
    try {
      sb = createClient();
    } catch {
      return; // no live connection — checking every second still works
    }
    const other = isTutor ? "student" : "tutor";
    /** A line or word from the other screen (checked first). */
    const take = (raw: unknown): boolean => {
      const m = raw as Mark | undefined;
      if (!m || typeof m.id !== "string" || !Number.isInteger(m.page) || removed.current.has(m.id)) return false;
      const data = cleanMark(m.data);
      if (!data) return false;
      marks.current.set(m.id, { id: m.id, page: m.page, author: other, data });
      return true;
    };
    const ch = sb.channel(`tutoringhub-board-${boardId}-${live}`, { config: { broadcast: { self: false, ack: false } } });
    ch.on("broadcast", { event: "live" }, ({ payload }) => {
      if (payload?.who !== other || !payload.live) return;
      const l = payload.live as Live;
      if (!Number.isInteger(l.page)) return;
      const stroke = l.stroke ? cleanMark(l.stroke) : null;
      applyOther({ ...l, stroke: stroke && stroke.t !== "text" && stroke.t !== "img" ? stroke : null, updated_at: new Date().toISOString() }, true);
    })
      .on("broadcast", { event: "mark" }, ({ payload }) => {
        if (payload?.who !== other) return;
        if (take(payload.mark)) bump();
      })
      .on("broadcast", { event: "marks" }, ({ payload }) => {
        // Several at once (moved together with ✋ Move, or brought back with Undo).
        if (payload?.who !== other || !Array.isArray(payload.marks)) return;
        let changed = false;
        for (const m of payload.marks as unknown[]) changed = take(m) || changed;
        if (changed) bump();
      })
      .on("broadcast", { event: "del" }, ({ payload }) => {
        if (payload?.who !== other || !Array.isArray(payload.ids)) return;
        let changed = false;
        for (const id of payload.ids as string[]) {
          const m = marks.current.get(id);
          if (m && (other === "tutor" || m.author === "student")) changed = marks.current.delete(id) || changed;
        }
        if (changed) bump();
      })
      .on("broadcast", { event: "clear" }, ({ payload }) => {
        if (payload?.who !== other || !Number.isInteger(payload.page)) return;
        for (const [id, m] of marks.current) if (m.page === payload.page && (other === "tutor" || m.author === "student")) marks.current.delete(id);
        bump();
      })
      .on("broadcast", { event: "point" }, ({ payload }) => {
        if (payload?.who !== other) return;
        if (pointerTimer.current) clearTimeout(pointerTimer.current);
        const ok = typeof payload.x === "number" && typeof payload.y === "number" && Number.isInteger(payload.page);
        if (payload.hide || !ok) return setPointer(null);
        setPointer({ x: Math.min(1, Math.max(0, payload.x)), y: Math.min(1, Math.max(0, payload.y)), page: payload.page });
        pointerTimer.current = setTimeout(() => setPointer(null), 2500);
      })
      .on("broadcast", { event: "layout" }, ({ payload }) => {
        if (payload?.who !== other || !Array.isArray(payload.layout)) return;
        const layout = (payload.layout as unknown[]).filter((n): n is number => Number.isInteger(n));
        if (layout.length) applyLayout(layout);
      })
      .on("broadcast", { event: "timer" }, ({ payload }) => {
        if (payload?.who !== "tutor" || isTutor) return;
        timerSetAt.current = Date.now();
        const left = Number(payload.secsLeft);
        if (payload.stop || !(left > 0)) setTimer(null);
        else setTimer({ endsAt: Date.now() + left * 1000, total: Number(payload.total) || left });
      })
      .on("broadcast", { event: "go" }, ({ payload }) => {
        if (isTutor || payload?.who !== "tutor" || !Number.isInteger(payload.page)) return;
        setPage(payload.page as number);
        setTextAt(null);
      })
      .subscribe((status) => {
        rtOk.current = status === "SUBSCRIBED";
      });
    channel.current = ch;
    return () => {
      rtOk.current = false;
      channel.current = null;
      void sb.removeChannel(ch);
    };
  }, [boardId, live, isTutor, applyOther, applyLayout]);

  // ---- Telling the other screen what I'm doing ------------------------------
  const sendLive = useCallback(
    (extra: Record<string, unknown> = {}) => {
      if (!boardIdRef.current) return;
      const t0 = Date.now();
      lastLive.current = t0;
      const { page: pg, tool: t, color: c } = stateRef.current;
      const stroke =
        drawing.current && (t === "line" || t === "rect")
          ? currentStroke(drawing.current)
          : drawing.current && (t === "pen" || t === "hl")
            ? currentStroke(drawing.current.slice(-1200))
            : null;
      const live = { page: pg, tool: t, color: t === "hl" ? stateRef.current.hlColor : c, stroke, ...extra };
      const sentLive = broadcast("live", { live });
      if (extra.go_to != null) broadcast("go", { page: extra.go_to as number });
      // Save it too (so a screen that joins later knows) — but not every bit of a line when live works.
      if (!sentLive || !stroke || extra.go_to != null || t0 - lastHttpLive.current > HEARTBEAT_MS) {
        lastHttpLive.current = t0;
        void post(api, { op: "live", live });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [api, size, broadcast],
  );

  useEffect(() => {
    sendLive();
  }, [page, tool, color, hlColor, sendLive]);

  useEffect(() => {
    const id = setInterval(() => {
      if (Date.now() - lastLive.current > HEARTBEAT_MS) sendLive();
    }, HEARTBEAT_MS);
    return () => clearInterval(id);
  }, [sendLive]);

  // ---- Saving (with automatic retry) -----------------------------------------------
  useEffect(() => {
    const send = async (body: QueuedOp): Promise<SendResult> => {
      try {
        const r = await fetch(api, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        if (r.ok) return "ok";
        return r.status >= 500 || r.status === 429 || r.status === 403 || r.status === 408 ? "retry" : "drop";
      } catch {
        return "retry"; // no internet right now
      }
    };
    const q = new SaveQueue(`tutoringhub-unsaved:${api}`, send, (pending, failing) => setUnsaved({ pending, failing }));
    queue.current = q;
    const online = () => void q.flush();
    window.addEventListener("online", online);
    return () => {
      window.removeEventListener("online", online);
      q.stop();
      queue.current = null;
    };
  }, [api]);

  function save(body: QueuedOp) {
    const id = boardIdRef.current;
    if (queue.current && id) queue.current.push(body, id);
    else void post(api, body);
  }

  // ---- Fetching changes ------------------------------------------------------
  useEffect(() => {
    let alive = true;
    let needUrls = true;
    let busy = false;
    const load = async () => {
      if (busy) return;
      busy = true;
      try {
        // Ask from a little earlier: saves don't always finish in number order, so a line numbered
        // just below the newest one can arrive late. Lines already here are skipped below.
        const seen = rev.current;
        const res = await fetch(`${api}?after=${Math.max(0, seen - 50)}${needUrls ? "&urls=1" : ""}`, { cache: "no-store" });
        if (!res.ok || !alive) return;
        const data = (await res.json()) as BoardPoll;
        if (!data.board) {
          setMissing(true);
          setBoard(null);
          boardIdRef.current = null;
          return;
        }
        setMissing(false);
        if (data.board.id !== boardIdRef.current) {
          // New slides: start fresh.
          boardIdRef.current = data.board.id;
          marks.current.clear();
          removed.current.clear();
          history.current = [];
          future.current = [];
          rev.current = 0;
          setPage(0);
          // Writing that wasn't saved before a reload: show it again and keep sending it.
          const q = queue.current;
          if (q) {
            q.keepOnly(data.board.id);
            for (const op of q.restored(data.board.id)) {
              if (op.op === "add") {
                const m = op.mark as { id: string; page: number; data: MarkData };
                marks.current.set(m.id, { id: m.id, page: m.page, author: me, data: m.data });
                history.current.push({ add: [{ id: m.id, page: m.page, author: me, data: m.data }], del: [] });
              } else if (op.op === "addMany") {
                const list = (op.marks as { id: string; page: number; data: MarkData }[]).map((m) => ({ id: m.id, page: m.page, author: me, data: m.data }) as Mark);
                for (const m of list) marks.current.set(m.id, m);
                history.current.push({ add: list, del: [] });
              } else
                for (const id of op.ids) {
                  removed.current.add(id);
                  marks.current.delete(id);
                }
            }
            void q.flush();
          }
          if (!data.board.urls) {
            needUrls = true;
            return void load();
          }
        }
        if (data.board.urls) {
          needUrls = false;
          setBoard(data.board);
        } else {
          applyLayout(data.board.layout);
        }
        let changed = false;
        for (const m of data.marks) {
          if (m.deleted) {
            changed = marks.current.delete(m.id) || changed;
          } else if (!removed.current.has(m.id) && !((m.rev ?? 0) <= seen && marks.current.has(m.id))) {
            marks.current.set(m.id, m);
            changed = true;
          }
        }
        rev.current = Math.max(rev.current, data.rev);
        if (changed) bump();
        setNow(Date.now());
        const liveFresh = rtOk.current && Date.now() - lastRt.current < 5000;
        if (data.other && !liveFresh) applyOther(data.other, false);
        else if (!data.other) setOther(null);
        if (!isTutor && Date.now() - timerSetAt.current > 4000) {
          // Mr Ken's countdown (the live connection usually got here first).
          const end = data.other?.timer_end ? Date.parse(data.other.timer_end) : NaN;
          const serverNow = data.now ? Date.parse(data.now) : Date.now();
          if (Number.isFinite(end) && end - serverNow > -5000) {
            const endsAt = Date.now() + (end - serverNow);
            setTimer((t) => (t && Math.abs(t.endsAt - endsAt) < 1500 ? t : { endsAt, total: Number(data.other?.timer_secs) || 60 }));
          } else setTimer((t) => (t && t.endsAt > Date.now() - 8000 && data.other?.timer_end === undefined ? t : null));
        }
        if (data.other && !isTutor) {
          // Mr Ken pressed "Bring here" (the live connection usually got there first).
          if (lastGoAt.current === undefined) lastGoAt.current = data.other.go_at ?? null;
          else if (data.other.go_at && data.other.go_at !== lastGoAt.current) {
            lastGoAt.current = data.other.go_at;
            if (!rtOk.current && data.other.go_to != null) setPage(data.other.go_to);
          }
        }
      } catch {
        /* try again next time */
      } finally {
        busy = false;
      }
    };
    let timer: ReturnType<typeof setTimeout>;
    const loop = async () => {
      await load();
      if (alive) timer = setTimeout(loop, rtOk.current ? POLL_LIVE_MS : POLL_MS);
    };
    void loop();
    const refreshUrls = setInterval(() => (needUrls = true), 4 * 3600_000);
    return () => {
      alive = false;
      clearTimeout(timer);
      clearInterval(refreshUrls);
    };
  }, [api, isTutor, me, applyOther, applyLayout]);

  // ---- Keyboard: Ctrl/⌘+Z undo, Ctrl/⌘+Shift+Z or Ctrl+Y redo ----------------------
  useLayoutEffect(() => {
    keys.current = {
      undo,
      redo,
      del: deleteSelected,
      all: selectAll,
      none: () => select([]),
      turn: (by) => board && goPage(board.layout.indexOf(page) + by),
    };
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      if ((e.key === "Delete" || e.key === "Backspace") && !e.metaKey && !e.ctrlKey) {
        keys.current.del();
        return;
      }
      if (e.key === "Escape") keys.current.none();
      // ← → (and Page Up / Page Down) turn the page. In the child's room always; on Mr Ken's lesson page
      // (which can show more than one child's slides) only the slides his mouse is over or last touched.
      if ((!isTutor || activeBoard === api) && !e.metaKey && !e.ctrlKey && !e.altKey && ["ArrowRight", "ArrowLeft", "PageDown", "PageUp"].includes(e.key)) {
        e.preventDefault();
        keys.current.turn(e.key === "ArrowRight" || e.key === "PageDown" ? 1 : -1);
        return;
      }
      if (!(e.metaKey || e.ctrlKey)) return;
      const k = e.key.toLowerCase();
      if (k === "a" && stateRef.current.tool === "select") {
        // ⌘A / Ctrl+A with ✋ Move: pick everything on this page.
        e.preventDefault();
        keys.current.all();
      } else if (k === "z" && !e.shiftKey) {
        e.preventDefault();
        keys.current.undo();
      } else if ((k === "z" && e.shiftKey) || k === "y") {
        e.preventDefault();
        keys.current.redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isTutor, api]);

  // ---- Paste a picture (⌘V / Ctrl+V), or copied words as typing ----------------------
  const paste = useRef<(e: ClipboardEvent) => void>(() => {});
  useLayoutEffect(() => {
    paste.current = (e: ClipboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      const items = [...(e.clipboardData?.items ?? [])];
      const pic = items.find((i) => i.kind === "file" && i.type.startsWith("image/"))?.getAsFile();
      if (pic) {
        e.preventDefault();
        void addPicture(pic);
        return;
      }
      const words = e.clipboardData?.getData("text/plain")?.trim();
      if (words && board) {
        e.preventDefault();
        addMark({ t: "text", c: color, s: TEXT_SIZE, x: 0.08, y: 0.15, text: words.replace(/\s+/g, " ").slice(0, 200) });
      }
    };
  });
  useEffect(() => {
    const on = (e: ClipboardEvent) => paste.current(e);
    window.addEventListener("paste", on);
    return () => window.removeEventListener("paste", on);
  }, []);

  // ---- Countdown clock -------------------------------------------------------------------
  const timerOn = timer != null;
  useEffect(() => {
    if (!timerOn) return;
    const id = setInterval(() => {
      const t = Date.now();
      setClock(t);
      setTimer((cur) => {
        if (!cur) return cur;
        if (t >= cur.endsAt && Math.abs(beepedFor.current - cur.endsAt) > 3000) {
          beepedFor.current = cur.endsAt; // once per countdown
          beep();
        }
        return t > cur.endsAt + 6000 ? null : cur; // "Time's up!" shows for 6 seconds
      });
    }, 250);
    return () => clearInterval(id);
  }, [timerOn]);

  // ---- Full screen ---------------------------------------------------------------
  // The page grows to fill the screen; the browser's own full screen hides the tabs too.
  function enterFull() {
    setFull(true);
    try {
      void document.documentElement.requestFullscreen?.({ navigationUI: "hide" }).catch(() => {});
    } catch {
      /* not supported (e.g. iPhone) — the big view still works */
    }
  }
  function exitFull() {
    setFull(false);
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
  }
  useEffect(() => {
    if (!full) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !document.fullscreenElement && setFull(false);
    const onFs = () => !document.fullscreenElement && setFull(false);
    window.addEventListener("keydown", onKey);
    document.addEventListener("fullscreenchange", onFs);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("fullscreenchange", onFs);
      document.body.style.overflow = prev;
    };
  }, [full]);
  useEffect(() => {
    const el = stageRef.current;
    if (!el || !full) return;
    const ro = new ResizeObserver(([e]) => setStage({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, [full, board]);

  // ---- Pointer input -----------------------------------------------------------
  function at(e: React.PointerEvent | PointerEvent) {
    const r = canvas.current!.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
  }

  /** Rub out the top thing under the eraser (the one drawn last) — one at a time. */
  function eraseAt(x: number, y: number) {
    if (!board) return;
    lastErase.current = { x, y };
    const list = [...marks.current.values()].filter((m) => m.page === page && (isTutor || m.author === "student")).reverse();
    const top = list.find((m) => hitsMark(m.data, x, y, ERASE_R, board.aspect));
    if (!top) return;
    const hit = [top.id];
    for (const id of hit) {
      const m = marks.current.get(id);
      if (m) eraseStep.current?.push(m);
      marks.current.delete(id);
      removed.current.add(id);
    }
    bump();
    broadcast("del", { ids: hit });
    save({ op: "del", ids: hit });
  }

  // ---- ✋ Move: pick, drag a box, move together, resize -----------------------------------
  function select(ids: string[]) {
    selectedRef.current = ids;
    setSelected(ids);
  }

  /** Things on this page that I'm allowed to move (students can't move Mr Ken's writing). */
  function movable(): Mark[] {
    return [...marks.current.values()].filter((m) => m.page === page && (isTutor || m.author === "student"));
  }

  /** The selected things that are still on this page. */
  function selectedHere(): Mark[] {
    return selectedRef.current.map((id) => marks.current.get(id)).filter((m): m is Mark => !!m && m.page === page);
  }

  function selectAll() {
    if (stateRef.current.tool !== "select") return;
    select(movable().map((m) => m.id));
    render();
  }

  /** The topmost mark under (x, y) that I'm allowed to move. */
  function pickAt(x: number, y: number): Mark | null {
    if (!board) return null;
    return movable().reverse().find((m) => grabsMark(m.data, x, y, 0.018, board.aspect)) ?? null;
  }

  /** Is (x, y) inside the box drawn around several selected things? */
  function inGroupBox(list: Mark[], x: number, y: number): boolean {
    if (!board || list.length < 2) return false;
    const g = groupBounds(list.map((m) => m.data), board.aspect);
    const W = sizeRef.current.W || 1;
    const H = sizeRef.current.H || 1;
    return x >= g.x1 - 8 / W && x <= g.x2 + 8 / W && y >= g.y1 - 8 / H && y <= g.y2 + 8 / H;
  }

  /** Show new marks on the other screen and save them (in batches the server accepts). */
  function sendMarks(list: Mark[]) {
    if (list.length === 1) {
      const [m] = list;
      broadcast("mark", { mark: m });
      save({ op: "add", mark: { id: m.id, page: m.page, data: m.data } });
      return;
    }
    for (const batch of markBatches(list)) {
      broadcast("marks", { marks: batch });
      save({ op: "addMany", marks: batch.map((m) => ({ id: m.id, page: m.page, data: m.data })) });
    }
  }

  /** Rub out these marks on the other screen and on the server. */
  function sendDel(ids: string[]) {
    if (!ids.length) return;
    broadcast("del", { ids });
    for (let i = 0; i < ids.length; i += 200) save({ op: "del", ids: ids.slice(i, i + 200) });
  }

  /**
   * Swap marks for changed copies (new ids, so both screens and the server stay simple).
   * The new copies are saved before the old ones are rubbed out, so nothing is ever lost. One Undo step.
   */
  function replaceMarks(pairs: [Mark, MarkData][]): Mark[] {
    const fresh = pairs.map(([old, data]) => ({ id: randomId(), page: old.page, author: me, data }) as Mark);
    const olds = pairs.map(([old]) => old);
    for (const old of olds) {
      marks.current.delete(old.id);
      removed.current.add(old.id);
    }
    for (const m of fresh) marks.current.set(m.id, m);
    sendMarks(fresh);
    sendDel(olds.map((m) => m.id));
    history.current.push({ add: fresh, del: olds });
    future.current = [];
    bump();
    return fresh;
  }

  function deleteSelected() {
    const list = selectedHere();
    if (!list.length) return;
    for (const m of list) {
      marks.current.delete(m.id);
      removed.current.add(m.id);
    }
    sendDel(list.map((m) => m.id));
    history.current.push({ add: [], del: list });
    future.current = [];
    select([]);
    bump();
  }

  /** ✋ Move, finger or mouse down: resize, move what's selected, pick one thing, or start a box. */
  function moveToolDown(x: number, y: number, shift: boolean) {
    const sel = selectedHere();
    // The corner dot of the selection: grow or shrink everything selected together.
    const W0 = sizeRef.current.W || 1;
    const H0 = sizeRef.current.H || 1;
    const corner = !shift && board ? scaleCorner(sel.map((m) => m.data), W0, H0) : null;
    if (corner && board && Math.hypot(corner[0] - x * W0, corner[1] - y * H0) < 18) {
      const g = groupBounds(sel.map((m) => m.data), board.aspect);
      drag.current = { mode: "scale", ids: sel.map((m) => m.id), x1: g.x1, y1: g.y1, x2: g.x2, y2: g.y2, previews: null };
      return;
    }
    // A resize dot of the one selected line, box or picture?
    if (sel.length === 1 && !shift) {
      const W = sizeRef.current.W || 1;
      const H = sizeRef.current.H || 1;
      const h = handlesOf(sel[0].data).findIndex(([hx, hy]) => Math.hypot((hx - x) * W, (hy - y) * H) < 16);
      if (h >= 0) {
        drag.current = { mode: "handle", id: sel[0].id, handle: h, x, y, preview: null };
        return;
      }
    }
    const hit = pickAt(x, y);
    if (shift) {
      // Shift: a tap adds or takes away one thing; a drag draws a box that adds more.
      drag.current = { mode: "box", x, y, x2: x, y2: y, base: sel.map((m) => m.id), tap: hit?.id ?? null };
    } else if ((hit && sel.some((m) => m.id === hit.id)) || inGroupBox(sel, x, y)) {
      drag.current = { mode: "move", ids: sel.map((m) => m.id), x, y, previews: null };
    } else if (hit) {
      select([hit.id]);
      drag.current = { mode: "move", ids: [hit.id], x, y, previews: null };
    } else {
      // An empty spot: drag a box around the things to pick.
      select([]);
      drag.current = { mode: "box", x, y, x2: x, y2: y, base: [], tap: null };
    }
    render();
  }

  function moveToolMove(x: number, y: number) {
    const d = drag.current;
    if (!d || !board) return;
    if (d.mode === "box") {
      d.x2 = x;
      d.y2 = y;
    } else if (d.mode === "handle") {
      const m = marks.current.get(d.id);
      if (!m) return;
      d.preview = moveHandle(m.data, d.handle, x, y, board.aspect);
    } else if (d.mode === "scale") {
      const list = d.ids.map((id) => marks.current.get(id)).filter((m): m is Mark => !!m);
      if (!list.length) return;
      // How far the corner was pulled, compared with the group's size (the bigger of across / down).
      const k = Math.max((x - d.x1) / Math.max(1e-4, d.x2 - d.x1), (y - d.y1) / Math.max(1e-4, d.y2 - d.y1));
      const scaled = scaleGroup(list.map((m) => m.data), k, board.aspect);
      d.previews = new Map(list.map((m, i) => [m.id, scaled[i]]));
    } else {
      const list = d.ids.map((id) => marks.current.get(id)).filter((m): m is Mark => !!m);
      if (!list.length) return;
      const moved = translateGroup(list.map((m) => m.data), x - d.x, y - d.y, board.aspect);
      d.previews = new Map(list.map((m, i) => [m.id, moved[i]]));
    }
    render();
  }

  function moveToolUp() {
    const d = drag.current;
    drag.current = null;
    if (!d || !board) return render();
    const changed = (m: Mark | undefined, data: MarkData | null | undefined): m is Mark => !!m && !!data && JSON.stringify(data) !== JSON.stringify(m.data);
    if (d.mode === "handle") {
      const m = marks.current.get(d.id);
      if (changed(m, d.preview)) select(replaceMarks([[m, d.preview!]]).map((n) => n.id));
    } else if (d.mode === "move" || d.mode === "scale") {
      const pairs: [Mark, MarkData][] = [];
      for (const [id, data] of d.previews ?? []) {
        const m = marks.current.get(id);
        if (changed(m, data)) pairs.push([m, data]);
      }
      if (pairs.length) {
        const fresh = replaceMarks(pairs);
        const newId = new Map(pairs.map(([old], i) => [old.id, fresh[i].id]));
        select(selectedRef.current.map((id) => newId.get(id) ?? id)); // still selected, to move again
      }
    } else {
      const tiny = Math.abs(d.x2 - d.x) < 0.006 && Math.abs(d.y2 - d.y) < 0.006;
      if (tiny) {
        if (d.tap) select(d.base.includes(d.tap) ? d.base.filter((id) => id !== d.tap) : [...d.base, d.tap]);
      } else {
        const box = { x1: d.x, y1: d.y, x2: d.x2, y2: d.y2 };
        const inside = movable()
          .filter((m) => insideBox(m.data, box, board.aspect))
          .map((m) => m.id);
        select([...new Set([...d.base, ...inside])]);
      }
    }
    render();
  }

  /** Show my pointer on the other screen (only over the live connection). */
  function point(x: number, y: number, force = false) {
    const t = Date.now();
    if (!force && t - lastPoint.current < 50) return;
    lastPoint.current = t;
    broadcast("point", { x: Math.round(x * 1000) / 1000, y: Math.round(y * 1000) / 1000, page });
  }

  function capture(e: React.PointerEvent<HTMLCanvasElement>) {
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* some browsers refuse; drawing still works */
    }
  }

  function onDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!board || e.button > 0) return;
    // Pencil mode: once an Apple Pencil / stylus is used, a hand resting on the screen doesn't draw.
    if (e.pointerType === "pen" && !pencilRef.current) {
      pencilRef.current = true;
      setPencilOnly(true);
    }
    if (e.pointerType === "touch") {
      if (pencilRef.current) return;
      touches.current.add(e.pointerId);
      if (touches.current.size > 1) {
        // Two fingers at once (e.g. a pinch): don't draw a stray line or move anything.
        drawing.current = null;
        drag.current = null;
        erasing.current = false;
        activePointer.current = null;
        render();
        return;
      }
    }
    if (activePointer.current !== null && activePointer.current !== e.pointerId) return;
    activePointer.current = e.pointerId;
    const { x, y } = at(e);
    if (tool === "pointer") {
      capture(e);
      point(x, y, true);
      return;
    }
    if (tool === "text") {
      setTextAt({ x, y });
      setTextValue("");
      return;
    }
    capture(e);
    if (tool === "select") {
      moveToolDown(x, y, e.shiftKey);
      return;
    }
    if (tool === "eraser") {
      erasing.current = true;
      eraseStep.current = [];
      eraseAt(x, y);
      return;
    }
    drawing.current = tool === "line" || tool === "rect" ? [x, y, x, y] : [x, y];
    render();
  }

  function onMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (activePointer.current !== null && activePointer.current !== e.pointerId) return;
    if (tool === "pointer") {
      // A mouse points just by moving; a finger or pen points while touching.
      if (e.pointerType === "mouse" || e.buttons) {
        const { x, y } = at(e);
        point(x, y);
      }
      return;
    }
    if (erasing.current) {
      // Dragging erases what it passes over, but staying on one spot doesn't dig through the layers.
      const { x, y } = at(e);
      const last = lastErase.current;
      if (!last || Math.hypot(x - last.x, (y - last.y) * (board?.aspect ?? 1)) > 0.01) eraseAt(x, y);
      return;
    }
    if (tool === "select") {
      const { x, y } = at(e);
      if (!drag.current) {
        // Mouse hovering: a move arrow over things, a crosshair over empty space (drag a box there).
        if (e.pointerType === "mouse" && canvas.current) {
          const W1 = sizeRef.current.W || 1;
          const H1 = sizeRef.current.H || 1;
          const corner = scaleCorner(selectedHere().map((m) => m.data), W1, H1);
          const onCorner = !!corner && Math.hypot(corner[0] - x * W1, corner[1] - y * H1) < 18;
          const over = !!pickAt(x, y) || inGroupBox(selectedHere(), x, y);
          canvas.current.style.cursor = onCorner ? "nwse-resize" : over ? "move" : "crosshair";
        }
        return;
      }
      moveToolMove(x, y);
      return;
    }
    const pts = drawing.current;
    if (!pts) return;
    if (tool === "line" || tool === "rect") {
      // Shapes: the first corner stays, the second follows the finger.
      const { x, y } = at(e);
      const [ex, ey] = tool === "line" && board ? snapLine(pts[0], pts[1], x, y, board.aspect) : [x, y];
      drawing.current = [pts[0], pts[1], ex, ey];
      render();
      if (Date.now() - lastLive.current > (rtOk.current ? LIVE_RT_MS : LIVE_MS)) sendLive();
      return;
    }
    const events = typeof e.nativeEvent.getCoalescedEvents === "function" ? e.nativeEvent.getCoalescedEvents() : [e.nativeEvent];
    for (const ev of events.length ? events : [e.nativeEvent]) {
      const { x, y } = at(ev);
      const lx = pts[pts.length - 2];
      const ly = pts[pts.length - 1];
      if (Math.abs(x - lx) + Math.abs(y - ly) > 0.0015 && pts.length < 3998) pts.push(x, y);
    }
    render();
    if (Date.now() - lastLive.current > (rtOk.current ? LIVE_RT_MS : LIVE_MS)) sendLive();
  }

  function onUp(e: React.PointerEvent<HTMLCanvasElement>) {
    touches.current.delete(e.pointerId);
    if (activePointer.current !== null && activePointer.current !== e.pointerId) return;
    activePointer.current = null;
    if (erasing.current && eraseStep.current?.length) {
      history.current.push({ add: [], del: eraseStep.current });
      future.current = [];
    }
    eraseStep.current = null;
    erasing.current = false;
    if (tool === "select") {
      moveToolUp();
      return;
    }
    const pts = drawing.current;
    drawing.current = null;
    if (!pts) return;
    if (tool === "line" || tool === "rect") {
      const tiny = Math.abs(pts[2] - pts[0]) < 0.006 && Math.abs(pts[3] - pts[1]) < 0.006;
      if (!tiny) addMark(currentStroke(pts));
      else render();
      sendLive();
      return;
    }
    if (pts.length === 2) pts.push(pts[0] + 0.0005, pts[1]);
    addMark(currentStroke(pts));
    sendLive();
  }

  function addMark(data: MarkData) {
    future.current = []; // something new: nothing to redo
    const id = randomId();
    const m: Mark = { id, page, author: me, data };
    marks.current.set(id, m);
    history.current.push({ add: [m], del: [] });
    bump();
    broadcast("mark", { mark: m });
    save({ op: "add", mark: { id, page, data } });
  }

  /** Paste, drop or pick a picture: shrink it, store it with the slides, put it in the middle of the page. */
  async function addPicture(file: Blob) {
    if (!board || !file.type.startsWith("image/")) return;
    setNotice("Adding picture…");
    try {
      const bmp = await createImageBitmap(file);
      const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
      const w = Math.max(1, Math.round(bmp.width * scale));
      const h = Math.max(1, Math.round(bmp.height * scale));
      let body: Blob = file;
      const keepPng = file.type === "image/png" && scale === 1 && file.size < 1_500_000;
      if (!keepPng) {
        const c = document.createElement("canvas");
        c.width = w;
        c.height = h;
        const ctx = c.getContext("2d")!;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(bmp, 0, 0, w, h);
        body = await new Promise<Blob>((ok, bad) => c.toBlob((b) => (b ? ok(b) : bad(new Error("image"))), "image/jpeg", 0.88));
      }
      const res = await fetch(`${api}/image`, { method: "POST", headers: { "Content-Type": keepPng ? "image/png" : "image/jpeg" }, body });
      const r = (await res.json()) as { key?: string; error?: string };
      if (!r.key) throw new Error(r.error ?? "upload");
      // Size it to fit: up to 45% of the page width and 70% of its height, keeping its shape.
      let fw = 0.45;
      let fh = (fw * (h / w)) / board.aspect;
      if (fh > 0.7) {
        fh = 0.7;
        fw = (fh * board.aspect * w) / h;
      }
      addMark({ t: "img", k: r.key, x: (1 - fw) / 2, y: (1 - fh) / 2, w: fw, h: fh });
      setTool("select");
      setNotice(null);
    } catch (e) {
      setNotice(e instanceof Error && e.message !== "upload" && e.message !== "image" ? e.message : "Couldn't add the picture. Please try again.");
      setTimeout(() => setNotice(null), 5000);
    }
  }

  function addText() {
    const text = textValue.trim();
    if (textAt && text) addMark({ t: "text", c: color, s: TEXT_SIZE, x: textAt.x, y: Math.max(TEXT_SIZE, textAt.y), text: text.slice(0, 200) });
    setTextAt(null);
    setTextValue("");
  }

  /** Reverse one step: take away what it added, put back (as copies) what it took away. Returns the opposite step. */
  function reverse(step: { add: Mark[]; del: Mark[] }): { add: Mark[]; del: Mark[] } | null {
    const gone = step.add.filter((m) => marks.current.has(m.id));
    const back = step.del.map((m) => ({ id: randomId(), page: m.page, author: me, data: m.data }) as Mark);
    if (!gone.length && !back.length) return null;
    for (const m of gone) {
      marks.current.delete(m.id);
      removed.current.add(m.id);
    }
    for (const m of back) marks.current.set(m.id, m);
    // What comes back is saved first, then what goes is rubbed out (in batches).
    if (back.length) sendMarks(back);
    sendDel(gone.map((m) => m.id));
    select([]);
    bump();
    return { add: back, del: gone };
  }

  function undo() {
    while (history.current.length) {
      const opposite = reverse(history.current.pop()!);
      if (opposite) {
        future.current.push(opposite);
        return;
      }
    }
  }

  function redo() {
    while (future.current.length) {
      const opposite = reverse(future.current.pop()!);
      if (opposite) {
        history.current.push(opposite);
        return;
      }
    }
  }

  /** Tutor: start a countdown (seconds) on both screens, or stop it (0). */
  function startTimer(secs: number) {
    setTimerMenu(false);
    timerSetAt.current = Date.now();
    setTimer(secs ? { endsAt: Date.now() + secs * 1000, total: secs } : null);
    broadcast("timer", secs ? { secsLeft: secs, total: secs } : { stop: true });
    void fetch(api, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ op: "timer", secs }) })
      .then((r) => (r.ok ? null : r.json()))
      .then((r: { error?: string } | null) => r?.error && setSaving(r.error))
      .catch(() => {});
  }

  function clearPage() {
    const ids: string[] = [];
    const gone: Mark[] = [];
    for (const [id, m] of marks.current) {
      if (m.page === page && (isTutor || m.author === "student")) {
        marks.current.delete(id);
        removed.current.add(id);
        ids.push(id);
        gone.push(m);
      }
    }
    if (gone.length) {
      history.current.push({ add: [], del: gone }); // Undo brings it all back
      future.current = [];
    }
    select([]);
    bump();
    setConfirmClear(false);
    broadcast("clear", { page });
    // Rub out exactly these lines (not anything drawn later), in batches the server accepts.
    for (let i = 0; i < ids.length; i += 200) save({ op: "del", ids: ids.slice(i, i + 200) });
  }

  /** Go to the page at this position (pages can be added, so position ≠ page number). */
  function goPage(pos: number) {
    if (!board) return;
    const next = board.layout[Math.max(0, Math.min(board.layout.length - 1, pos))];
    if (isTutor && other && next !== other.page) setFollow(false);
    setPage(next);
    setPageMenu(false);
    setConfirmRemove(false);
    select([]);
    setTextAt(null);
  }

  async function addPage(kind: "blank" | "grid") {
    setPageMenu(false);
    try {
      const res = await fetch(api, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ op: "addPage", page, kind }) });
      const r = (await res.json()) as { layout?: number[]; error?: string };
      if (!r.layout) return setSaving(r.error ?? "Couldn't add a page.");
      const added = r.layout.find((id) => !board?.layout.includes(id));
      setBoard((b) => (b ? { ...b, layout: r.layout! } : b));
      broadcast("layout", { layout: r.layout });
      if (added != null) {
        setPage(added);
        if (isTutor) setFollow(false);
      }
    } catch {
      setSaving("Couldn't add a page.");
    }
  }

  async function removeThisPage() {
    setConfirmRemove(false);
    if (!board) return;
    const pos = board.layout.indexOf(page);
    try {
      const res = await fetch(api, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ op: "removePage", page }) });
      const r = (await res.json()) as { layout?: number[] };
      if (!r.layout) return;
      setBoard((b) => (b ? { ...b, layout: r.layout! } : b));
      broadcast("layout", { layout: r.layout });
      setPage(r.layout[Math.max(0, pos - 1)] ?? 0);
    } catch {
      /* try again */
    }
  }

  /** Tutor: turn every page with writing into a picture and add it to the lesson. */
  async function saveWork() {
    if (!board || !saveLessonId) return;
    const withWriting = board.layout.filter((id) => [...marks.current.values()].some((m) => m.page === id));
    if (!withWriting.length) return setSaving("There's no writing to save yet.");
    let done = 0;
    try {
      const sb = createClient();
      for (const id of withWriting) {
        const pos = board.layout.indexOf(id) + 1;
        setSaving(`Saving page ${pos}…`);
        const blob = await pagePicture(board, id, marks.current.values(), imageSrc);
        const path = `${saveLessonId}/${randomId()}.jpg`;
        const { error } = await sb.storage.from(MATERIALS_BUCKET).upload(path, blob, { contentType: "image/jpeg" });
        if (error) throw error;
        const r = await addMaterialFile(saveLessonId, path, "photo", `${otherName}'s work · ${board.title} · page ${pos}`.slice(0, 120));
        if (r.error) throw new Error(r.error);
        done++;
      }
      setSaving(`Saved ${done} ${done === 1 ? "page" : "pages"} to the lesson ✓ (under Worksheets and materials)`);
      router.refresh();
    } catch {
      setSaving(done ? `Saved ${done} pages, then something went wrong. Try again.` : "Couldn't save. Please try again.");
    }
  }

  // ---- Screen ----------------------------------------------------------------------
  if (!board) return missing ? <>{empty ?? null}</> : <div className="card py-16 text-center text-muted">Loading slides…</div>;

  const pos = Math.max(0, board.layout.indexOf(page));
  const kind = pageKind(page);
  const url = kind === "slide" ? board.urls?.[page] : undefined;
  const nextId = board.layout[pos + 1];
  const nextUrl = nextId != null && pageKind(nextId) === "slide" ? board.urls?.[nextId] : undefined;
  const otherPos = other ? board.layout.indexOf(other.page) + 1 : 0;
  const ago = other?.updated_at && now ? Math.round((now - new Date(other.updated_at).getTime()) / 1000) : null;
  const here = ago != null && ago < 25;
  const secsLeft = timer && clock ? Math.max(0, Math.ceil((timer.endsAt - clock) / 1000)) : timer ? timer.total : 0;
  const mmss = `${Math.floor(secsLeft / 60)}:${String(secsLeft % 60).padStart(2, "0")}`;
  const myMarksOnPage = [...marks.current.values()].some((m) => m.page === page && (isTutor || m.author === "student"));
  const selCount = selected.filter((id) => marks.current.get(id)?.page === page).length;
  const btn = (active: boolean) =>
    `flex ${full ? "h-11 min-w-11" : "h-12 min-w-12"} items-center justify-center rounded-xl border px-3 text-base font-medium ${active ? "border-accent bg-accent-soft text-accent" : "border-line bg-surface"}`;
  // In full screen the page is as big as fits; otherwise it fits the window height.
  const pageWidth = full
    ? stage.w && stage.h
      ? `${Math.floor(Math.min(stage.w, stage.h / board.aspect))}px`
      : "100%"
    : `min(100%, calc(${isTutor ? 70 : 78}dvh / ${board.aspect}))`;

  return (
    <div
      className={full ? "fixed inset-0 z-50 flex flex-col gap-2 bg-bg p-2 sm:p-3" : "space-y-3"}
      onPointerEnter={() => (activeBoard = api)}
      onPointerDown={() => (activeBoard = api)}
    >
      {isTutor ? (
        <div className={`flex flex-wrap items-center justify-between gap-2 rounded-xl bg-surface-2 text-sm ${full ? "px-3 py-1.5" : "p-3"}`}>
          <span>
            {here && other ? (
              <>
                <strong>{otherName}</strong> is on page {otherPos || "?"} · {TOOL_NAMES[other.tool ?? ""] ?? "—"}
                {other.color && other.tool !== "eraser" ? (
                  <>
                    {" "}
                    · <span className="inline-block h-3 w-3 rounded-full align-middle" style={{ background: other.color }} /> {COLOR_NAMES[other.color] ?? ""}
                  </>
                ) : null}
                {other.stroke ? " · writing…" : ""}
              </>
            ) : (
              <span className="text-muted">{otherName} isn&apos;t on the slides right now.</span>
            )}
          </span>
          <span className="flex flex-wrap gap-2">
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={follow} onChange={(e) => setFollow(e.target.checked)} /> Follow {otherName}
            </label>
            <button
              type="button"
              className={`${brought === page ? "btn-primary" : "btn-secondary"} min-h-9 px-3 text-sm`}
              onClick={() => {
                sendLive({ go_to: page });
                setBrought(page);
                setTimeout(() => setBrought((b) => (b === page ? null : b)), 2500);
              }}
              title={`Move ${otherName}'s screen to this page`}
            >
              {brought === page ? `✓ Sent — ${otherName} is going to page ${pos + 1}` : `Bring ${otherName} to page ${pos + 1}`}
            </button>
            {saveLessonId ? (
              <button type="button" className="btn-primary min-h-9 px-3 text-sm" onClick={saveWork} disabled={saving?.startsWith("Saving")}>
                📸 Save work to lesson
              </button>
            ) : null}
          </span>
        </div>
      ) : null}

      <div ref={stageRef} className={full ? "flex min-h-0 flex-1 items-center justify-center" : ""}>
      <div className="mx-auto" style={{ width: pageWidth }}>
        <div
          ref={box}
          className="relative w-full select-none overflow-hidden rounded-2xl border border-line bg-white"
          style={{ aspectRatio: `1 / ${board.aspect}` }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            const f = [...e.dataTransfer.files].find((x) => x.type.startsWith("image/"));
            if (f) {
              e.preventDefault();
              void addPicture(f);
            }
          }}
        >
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt={`Page ${pos + 1}`} className="pointer-events-none absolute inset-0 h-full w-full" draggable={false} />
          ) : null}
          {kind === "grid" ? (
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                backgroundImage: `linear-gradient(${GRID_LINE} 1px, transparent 1px), linear-gradient(90deg, ${GRID_LINE} 1px, transparent 1px)`,
                backgroundSize: `${100 / GRID_CELLS}% ${100 / GRID_CELLS / board.aspect}%`,
              }}
            />
          ) : null}
          {nextUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={nextUrl} alt="" className="hidden" aria-hidden />
          ) : null}
          <canvas
            ref={canvas}
            className="absolute inset-0 h-full w-full"
            style={{ touchAction: "none", cursor: tool === "text" ? "text" : tool === "eraser" ? "cell" : tool === "pointer" ? "pointer" : tool === "select" ? "move" : "crosshair" }}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
            onPointerLeave={() => tool === "pointer" && broadcast("point", { hide: true })}
          />
          {pointer && pointer.page === page ? (
            <div
              className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${pointer.x * 100}%`, top: `${pointer.y * 100}%` }}
              aria-hidden
            >
              <span className={`absolute -inset-2 animate-ping rounded-full opacity-60 ${isTutor ? "bg-blue-500" : "bg-red-500"}`} />
              <span className={`relative block h-5 w-5 rounded-full border-2 border-white shadow-lg ${isTutor ? "bg-blue-600" : "bg-red-600"}`} />
              <span className={`absolute left-6 top-0 whitespace-nowrap rounded-md px-1.5 py-0.5 text-xs font-medium text-white ${isTutor ? "bg-blue-600" : "bg-red-600"}`}>
                {otherName}
              </span>
            </div>
          ) : null}
          {timer ? (
            <div
              role="timer"
              aria-live="polite"
              className={`pointer-events-none absolute right-3 top-3 z-20 rounded-2xl px-4 py-2 text-2xl font-bold tabular-nums shadow-lg sm:text-4xl ${
                secsLeft === 0 ? "animate-pulse bg-red-600 text-white" : secsLeft <= 10 ? "bg-red-600 text-white" : "bg-white/95 text-gray-900 ring-2 ring-gray-200"
              }`}
            >
              {secsLeft === 0 ? "⏰ Time's up!" : `⏱ ${mmss}`}
            </div>
          ) : null}
          {textAt ? (
            <form
              className="absolute z-10 flex gap-1 rounded-xl border border-accent bg-surface p-1 shadow-lg"
              style={{ left: `min(${textAt.x * 100}%, calc(100% - 17rem))`, top: `min(${textAt.y * 100}%, calc(100% - 3.5rem))` }}
              onSubmit={(e) => {
                e.preventDefault();
                addText();
              }}
            >
              <input
                autoFocus
                value={textValue}
                onChange={(e) => setTextValue(e.target.value)}
                onKeyDown={(e) => e.key === "Escape" && setTextAt(null)}
                maxLength={200}
                placeholder="Type here"
                className="input h-11 w-40"
                style={{ color }}
              />
              <button className="btn-primary h-11 px-3">Add</button>
              <button type="button" className="btn-quiet h-11 px-2" onClick={() => setTextAt(null)} aria-label="Cancel">
                ✕
              </button>
            </form>
          ) : null}
        </div>
      </div>
      </div>

      {pagesOpen ? (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/45 p-3 sm:items-center" onClick={() => setPagesOpen(false)}>
        <div className="w-full max-w-5xl rounded-2xl border border-line bg-surface p-3 shadow-2xl" role="dialog" aria-modal="true" aria-label="All pages" onClick={(e) => e.stopPropagation()}>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-medium">Tap a page to go there</p>
            <button type="button" className="btn-quiet min-h-10 px-3 text-sm" onClick={() => setPagesOpen(false)}>
              Close
            </button>
          </div>
          <div className="grid max-h-[70vh] grid-cols-3 gap-2 overflow-y-auto pr-1 sm:grid-cols-4 lg:grid-cols-6">
            {board.layout.map((id, i) => {
              const k = pageKind(id);
              const src = k === "slide" ? board.urls?.[id] : undefined;
              const on = id === page;
              const theirs = isTutor && other?.page === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    goPage(i);
                    setPagesOpen(false);
                  }}
                  aria-current={on ? "page" : undefined}
                  ref={on ? (el) => el?.scrollIntoView({ block: "center" }) : undefined}
                  className={`relative overflow-hidden rounded-xl border-2 bg-white text-left ${on ? "border-[var(--accent,#2f8f83)]" : "border-transparent hover:border-line"}`}
                  style={{ aspectRatio: String(1 / (Number(board.aspect) || 0.5625)) }}
                >
                  {src ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={src} alt="" loading="lazy" className="h-full w-full object-contain" />
                  ) : (
                    <span className="grid h-full w-full place-items-center text-2xl text-slate-400">{k === "grid" ? "▦" : "⬜"}</span>
                  )}
                  <span className="absolute bottom-1 left-1 rounded-md bg-black/65 px-1.5 text-xs font-semibold text-white tabular-nums">{i + 1}</span>
                  {theirs ? <span className="absolute right-1 top-1 rounded-md bg-amber-400 px-1.5 text-[11px] font-bold text-black">{otherName}</span> : null}
                </button>
              );
            })}
          </div>
        </div>
        </div>
      ) : null}

      {/* Tools — big buttons for small hands */}
      <div className={`flex flex-wrap items-center justify-center ${full ? "gap-1.5" : "gap-2"}`}>
        <div className="flex items-center gap-1 rounded-2xl border border-line bg-surface p-1">
          <button type="button" className={btn(false)} onClick={() => goPage(pos - 1)} disabled={pos === 0} aria-label="Previous page">
            ◀
          </button>
          <button
            type="button"
            className={`${btn(pagesOpen)} min-w-20 gap-1 text-sm font-medium tabular-nums`}
            onClick={() => setPagesOpen(!pagesOpen)}
            aria-expanded={pagesOpen}
            title="See all pages and jump to one"
          >
            {pos + 1} / {board.layout.length} <span aria-hidden>▦</span>
          </button>
          <button type="button" className={btn(false)} onClick={() => goPage(pos + 1)} disabled={pos >= board.layout.length - 1} aria-label="Next page">
            ▶
          </button>
          <div className="relative">
            <button type="button" className={btn(pageMenu)} onClick={() => setPageMenu(!pageMenu)} title="Add a page" aria-expanded={pageMenu}>
              ➕
            </button>
            {pageMenu ? (
              <div className="absolute bottom-full left-1/2 z-20 mb-2 flex -translate-x-1/2 flex-col gap-1 rounded-xl border border-line bg-surface p-1 shadow-lg">
                <button type="button" className="min-h-11 whitespace-nowrap rounded-lg px-4 text-left hover:bg-surface-2" onClick={() => addPage("blank")}>
                  ⬜ Blank page
                </button>
                <button type="button" className="min-h-11 whitespace-nowrap rounded-lg px-4 text-left hover:bg-surface-2" onClick={() => addPage("grid")}>
                  ▦ Squared page
                </button>
                <button
                  type="button"
                  className="min-h-11 whitespace-nowrap rounded-lg px-4 text-left hover:bg-surface-2"
                  onClick={() => {
                    setPageMenu(false);
                    fileInput.current?.click();
                  }}
                >
                  🖼 Picture on this page
                </button>
              </div>
            ) : null}
          </div>
          {isTutor && kind !== "slide" ? (
            confirmRemove ? (
              <button type="button" className="btn-danger h-11 px-3 text-sm" onClick={removeThisPage}>
                Remove page?
              </button>
            ) : (
              <button type="button" className={btn(false)} onClick={() => setConfirmRemove(true)} title="Remove this added page">
                ✕
              </button>
            )
          ) : null}
        </div>

        <div className="flex items-center gap-1 rounded-2xl border border-line bg-surface p-1">
          {(["select", "pen", "hl", "line", "rect", "text", "eraser", "pointer"] as const).map((t) => (
            <button key={t} type="button" className={btn(tool === t)} onClick={() => {
                if (tool === "pointer" && t !== "pointer") broadcast("point", { hide: true });
                if (t !== "select") select([]);
                setTool(t);
              }} aria-pressed={tool === t} title={TOOL_NAMES[t]}>
              <span aria-hidden>{TOOL_NAMES[t].split(" ")[0]}</span>
              <span className="sr-only">{TOOL_NAMES[t]}</span>
            </button>
          ))}
        </div>

        {tool === "hl" ? (
          <div className="flex items-center gap-1.5 rounded-2xl border border-line bg-surface p-1.5">
            {HL_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setHlColor(c)}
                aria-label={`${COLOR_NAMES[c]} highlighter`}
                aria-pressed={hlColor === c}
                className="h-10 w-10 rounded-full border-4"
                style={{ background: c, borderColor: hlColor === c ? "var(--color-accent, #0f766e)" : "transparent", outline: hlColor === c ? "2px solid white" : "none", outlineOffset: -6 }}
              />
            ))}
          </div>
        ) : null}

        {tool === "pen" || tool === "text" || tool === "line" || tool === "rect" ? (
          <div className="flex items-center gap-1.5 rounded-2xl border border-line bg-surface p-1.5">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                aria-label={COLOR_NAMES[c]}
                aria-pressed={color === c}
                className="h-10 w-10 rounded-full border-4"
                style={{ background: c, borderColor: color === c ? "var(--color-accent, #0f766e)" : "transparent", outline: color === c ? "2px solid white" : "none", outlineOffset: -6 }}
              />
            ))}
            {tool === "pen" || tool === "line" || tool === "rect" ? (
              <button type="button" className={btn(false)} onClick={() => setSize(size === "thin" ? "thick" : "thin")} title="Line size">
                {size === "thin" ? "Thin" : "Thick"}
              </button>
            ) : null}
          </div>
        ) : null}

        <div className="flex items-center gap-1 rounded-2xl border border-line bg-surface p-1">
          {selCount && tool === "select" ? (
            <button type="button" className="btn-danger h-11 px-3 text-sm" onClick={deleteSelected} title="Delete what's selected (Delete key)">
              🗑 Delete{selCount > 1 ? ` ${selCount}` : ""}
            </button>
          ) : null}
          <button type="button" className={btn(false)} onClick={undo} title="Undo (Ctrl/⌘ + Z)">
            ↶ Undo
          </button>
          <button type="button" className={btn(false)} onClick={redo} title="Redo (Ctrl/⌘ + Shift + Z)" aria-label="Redo">
            ↷
          </button>
          {confirmClear ? (
            <>
              <button type="button" className="btn-danger h-12" onClick={clearPage}>
                Rub out {isTutor ? "everything" : "my writing"}?
              </button>
              <button type="button" className={btn(false)} onClick={() => setConfirmClear(false)}>
                No
              </button>
            </>
          ) : myMarksOnPage ? (
            <button type="button" className={btn(false)} onClick={() => setConfirmClear(true)} title="Clear this page">
              🗑️
            </button>
          ) : null}
        </div>

        {isTutor ? (
          <div className="relative">
            {timer ? (
              <button type="button" className="btn-danger h-11 px-3" onClick={() => startTimer(0)}>
                ⏹ Stop timer
              </button>
            ) : (
              <button type="button" className={btn(timerMenu)} onClick={() => setTimerMenu(!timerMenu)} aria-expanded={timerMenu} title={`Countdown on ${otherName}'s screen`}>
                ⏱ Timer
              </button>
            )}
            {timerMenu ? (
              <div className="absolute bottom-full left-1/2 z-30 mb-2 grid w-48 -translate-x-1/2 grid-cols-2 gap-1 rounded-xl border border-line bg-surface p-1 shadow-lg">
                {[30, 60, 120, 180, 300, 600].map((s) => (
                  <button key={s} type="button" className="min-h-11 rounded-lg px-3 hover:bg-surface-2" onClick={() => startTimer(s)}>
                    {s < 60 ? `${s} sec` : `${s / 60} min`}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        {full ? (
          <button type="button" className="btn-primary h-11 px-4" onClick={exitFull}>
            ✕ Smaller
          </button>
        ) : (
          <button type="button" className="btn-primary h-12 px-4" onClick={enterFull}>
            ⛶ Full screen
          </button>
        )}
      </div>
      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void addPicture(f);
          e.target.value = "";
        }}
      />
      {notice ? <p className="text-center text-sm text-accent">{notice}</p> : null}
      {unsaved.failing && unsaved.pending ? (
        <p role="status" className="mx-auto w-fit rounded-xl bg-warn-soft px-3 py-1.5 text-center text-sm text-warn">
          ⚠ Not saved yet ({unsaved.pending}) — no internet? It will save by itself when the connection is back.
        </p>
      ) : null}
      {pencilOnly ? (
        <p className="text-center text-xs text-muted">
          ✏️ Pencil mode: fingers won&apos;t draw.{" "}
          <button type="button" className="underline" onClick={() => {
              pencilRef.current = false;
              setPencilOnly(false);
            }}>
            Let fingers draw again
          </button>
        </p>
      ) : null}
      {saving && isTutor ? <p className="text-center text-sm text-accent">{saving}</p> : null}
      {!isTutor && !full ? <p className="text-center text-xs text-muted">Mr Ken can see your writing.</p> : null}
    </div>
  );
}
