"use client";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { addMaterialFile } from "@/app/actions/lessons";
import { MATERIALS_BUCKET } from "@/lib/constants";
import { SaveQueue, type QueuedOp, type SendResult } from "@/lib/saveQueue";
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
  moveHandle,
  translateMark,
  pageKind,
  type BoardInfo,
  type BoardPoll,
  type Live,
  type Mark,
  type MarkData,
  type StrokeData,
  type Tool,
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

function drawMark(ctx: CanvasRenderingContext2D, m: MarkData, W: number, H: number, alpha = 1) {
  ctx.save();
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
export async function pagePicture(board: BoardInfo, id: number, all: Iterable<Mark>): Promise<Blob> {
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
  for (const m of all) if (m.page === id) drawMark(ctx, m.data, W, H);
  return new Promise<Blob>((ok, bad) => c.toBlob((b) => (b ? ok(b) : bad(new Error("image"))), "image/jpeg", 0.88));
}

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
  const [selected, setSelected] = useState<string | null>(null);
  const selectedRef = useRef<string | null>(null);
  const drag = useRef<{ id: string; mode: "move" | "handle"; handle: number; x: number; y: number; preview: MarkData | null } | null>(null);
  const keys = useRef<{ undo: () => void; redo: () => void; del: () => void }>({ undo: () => {}, redo: () => {}, del: () => {} });
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
    for (const m of marks.current.values()) {
      if (m.page !== pg) continue;
      drawMark(ctx, d?.preview && d.id === m.id ? d.preview : m.data, W, H);
    }
    if (other?.stroke && other.page === pg) drawMark(ctx, other.stroke, W, H, 0.6);
    if (drawing.current) drawMark(ctx, currentStroke(drawing.current), W, H);
    // The selected mark: a dashed box around it, and dots to drag for resizing.
    const sel = selectedRef.current ? marks.current.get(selectedRef.current) : null;
    if (sel && sel.page === pg && stateRef.current.tool === "select") {
      const data = d?.preview && d.id === sel.id ? d.preview : sel.data;
      const aspect = H / W;
      const b = markBounds(data, aspect);
      ctx.save();
      ctx.strokeStyle = "#0f766e";
      ctx.lineWidth = 1.5;
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
      ctx.restore();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [other]);

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
  useEffect(() => {
    if (!boardId) return;
    let sb: ReturnType<typeof createClient>;
    try {
      sb = createClient();
    } catch {
      return; // no live connection — checking every second still works
    }
    const other = isTutor ? "student" : "tutor";
    const ch = sb.channel(`tutoringhub-board-${boardId}`, { config: { broadcast: { self: false, ack: false } } });
    ch.on("broadcast", { event: "live" }, ({ payload }) => {
      if (payload?.who !== other || !payload.live) return;
      const l = payload.live as Live;
      if (!Number.isInteger(l.page)) return;
      const stroke = l.stroke ? cleanMark(l.stroke) : null;
      applyOther({ ...l, stroke: stroke && stroke.t !== "text" ? stroke : null, updated_at: new Date().toISOString() }, true);
    })
      .on("broadcast", { event: "mark" }, ({ payload }) => {
        const m = payload?.mark as Mark | undefined;
        if (payload?.who !== other || !m || typeof m.id !== "string" || !Number.isInteger(m.page) || removed.current.has(m.id)) return;
        const data = cleanMark(m.data);
        if (!data) return;
        marks.current.set(m.id, { id: m.id, page: m.page, author: other, data });
        bump();
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
  }, [boardId, isTutor, applyOther, applyLayout]);

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
        const res = await fetch(`${api}?after=${rev.current}${needUrls ? "&urls=1" : ""}`, { cache: "no-store" });
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
              } else for (const id of op.ids) removed.current.add(id);
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
          } else if (!removed.current.has(m.id)) {
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
    keys.current = { undo, redo, del: deleteSelected };
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      if ((e.key === "Delete" || e.key === "Backspace") && !e.metaKey && !e.ctrlKey) {
        keys.current.del();
        return;
      }
      if (!(e.metaKey || e.ctrlKey)) return;
      const k = e.key.toLowerCase();
      if (k === "z" && !e.shiftKey) {
        e.preventDefault();
        keys.current.undo();
      } else if ((k === "z" && e.shiftKey) || k === "y") {
        e.preventDefault();
        keys.current.redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
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

  function eraseAt(x: number, y: number) {
    if (!board) return;
    const hit: string[] = [];
    for (const m of marks.current.values()) {
      if (m.page !== page) continue;
      if (!isTutor && m.author !== "student") continue;
      if (hitsMark(m.data, x, y, ERASE_R, board.aspect)) hit.push(m.id);
    }
    if (!hit.length) return;
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

  // ---- ✋ Move: pick, drag, resize ------------------------------------------------------
  function select(id: string | null) {
    selectedRef.current = id;
    setSelected(id);
  }

  /** The topmost mark under (x, y) that I'm allowed to move. */
  function pickAt(x: number, y: number): Mark | null {
    if (!board) return null;
    const list = [...marks.current.values()].filter((m) => m.page === page && (isTutor || m.author === "student")).reverse();
    return list.find((m) => grabsMark(m.data, x, y, 0.018, board.aspect)) ?? null;
  }

  /** Swap a mark for a changed copy (a new id, so both screens and the server stay simple). */
  function replaceMark(old: Mark, data: MarkData): Mark {
    const m: Mark = { id: crypto.randomUUID(), page: old.page, author: me, data };
    marks.current.delete(old.id);
    removed.current.add(old.id);
    marks.current.set(m.id, m);
    broadcast("del", { ids: [old.id] });
    broadcast("mark", { mark: m });
    save({ op: "del", ids: [old.id] });
    save({ op: "add", mark: { id: m.id, page: m.page, data } });
    history.current.push({ add: [m], del: [old] });
    future.current = [];
    bump();
    return m;
  }

  function deleteSelected() {
    const m = selectedRef.current ? marks.current.get(selectedRef.current) : null;
    if (!m) return;
    marks.current.delete(m.id);
    removed.current.add(m.id);
    broadcast("del", { ids: [m.id] });
    save({ op: "del", ids: [m.id] });
    history.current.push({ add: [], del: [m] });
    future.current = [];
    select(null);
    bump();
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
        // Two fingers at once (e.g. a pinch): don't draw a stray line.
        drawing.current = null;
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
      const cur = selectedRef.current ? marks.current.get(selectedRef.current) : null;
      // A resize dot of the selected line or box?
      if (cur) {
        const W = sizeRef.current.W || 1;
        const H = sizeRef.current.H || 1;
        const h = handlesOf(cur.data).findIndex(([hx, hy]) => Math.hypot((hx - x) * W, (hy - y) * H) < 16);
        if (h >= 0) {
          drag.current = { id: cur.id, mode: "handle", handle: h, x, y, preview: null };
          return;
        }
      }
      const hit = pickAt(x, y);
      select(hit?.id ?? null);
      drag.current = hit ? { id: hit.id, mode: "move", handle: -1, x, y, preview: null } : null;
      render();
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
      const { x, y } = at(e);
      eraseAt(x, y);
      return;
    }
    if (tool === "select") {
      const d = drag.current;
      const m = d ? marks.current.get(d.id) : null;
      if (!d || !m || !board) return;
      const { x, y } = at(e);
      d.preview = d.mode === "handle" ? moveHandle(m.data, d.handle, x, y, board.aspect) : translateMark(m.data, x - d.x, y - d.y, board.aspect);
      render();
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
      const d = drag.current;
      drag.current = null;
      const m = d ? marks.current.get(d.id) : null;
      if (d && m && d.preview && JSON.stringify(d.preview) !== JSON.stringify(m.data)) select(replaceMark(m, d.preview).id);
      render();
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
    const id = crypto.randomUUID();
    const m: Mark = { id, page, author: me, data };
    marks.current.set(id, m);
    history.current.push({ add: [m], del: [] });
    bump();
    broadcast("mark", { mark: m });
    save({ op: "add", mark: { id, page, data } });
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
    const back = step.del.map((m) => ({ id: crypto.randomUUID(), page: m.page, author: me, data: m.data }) as Mark);
    if (!gone.length && !back.length) return null;
    if (gone.length) {
      for (const m of gone) {
        marks.current.delete(m.id);
        removed.current.add(m.id);
      }
      const ids = gone.map((m) => m.id);
      broadcast("del", { ids });
      for (let i = 0; i < ids.length; i += 200) save({ op: "del", ids: ids.slice(i, i + 200) });
    }
    for (const m of back) {
      marks.current.set(m.id, m);
      broadcast("mark", { mark: m });
      save({ op: "add", mark: { id: m.id, page: m.page, data: m.data } });
    }
    select(null);
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
    select(null);
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
    select(null);
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
        const blob = await pagePicture(board, id, marks.current.values());
        const path = `${saveLessonId}/${crypto.randomUUID()}.jpg`;
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
  const btn = (active: boolean) =>
    `flex ${full ? "h-11 min-w-11" : "h-12 min-w-12"} items-center justify-center rounded-xl border px-3 text-base font-medium ${active ? "border-accent bg-accent-soft text-accent" : "border-line bg-surface"}`;
  // In full screen the page is as big as fits; otherwise it fits the window height.
  const pageWidth = full
    ? stage.w && stage.h
      ? `${Math.floor(Math.min(stage.w, stage.h / board.aspect))}px`
      : "100%"
    : `min(100%, calc(${isTutor ? 70 : 78}dvh / ${board.aspect}))`;

  return (
    <div className={full ? "fixed inset-0 z-50 flex flex-col gap-2 bg-bg p-2 sm:p-3" : "space-y-3"}>
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
        <div ref={box} className="relative w-full select-none overflow-hidden rounded-2xl border border-line bg-white" style={{ aspectRatio: `1 / ${board.aspect}` }}>
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

      {/* Tools — big buttons for small hands */}
      <div className={`flex flex-wrap items-center justify-center ${full ? "gap-1.5" : "gap-2"}`}>
        <div className="flex items-center gap-1 rounded-2xl border border-line bg-surface p-1">
          <button type="button" className={btn(false)} onClick={() => goPage(pos - 1)} disabled={pos === 0} aria-label="Previous page">
            ◀
          </button>
          <span className="min-w-16 text-center text-sm font-medium tabular-nums">
            {pos + 1} / {board.layout.length}
          </span>
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
                if (t !== "select") select(null);
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
          {selected && tool === "select" ? (
            <button type="button" className="btn-danger h-11 px-3 text-sm" onClick={deleteSelected} title="Delete what's selected (Delete key)">
              🗑 Delete
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
