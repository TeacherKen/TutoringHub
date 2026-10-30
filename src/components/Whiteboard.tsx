"use client";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import {
  cleanMark,
  COLORS,
  COLOR_NAMES,
  HIGHLIGHT,
  SIZES,
  TOOL_NAMES,
  hitsMark,
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
};

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

async function post(api: string, body: unknown) {
  try {
    await fetch(api, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  } catch {
    /* offline for a moment */
  }
}

export function Whiteboard({ api, me, otherName, empty }: Props) {
  const isTutor = me === "tutor";
  const [board, setBoard] = useState<BoardInfo | null>(null);
  const [missing, setMissing] = useState(false);
  const [page, setPage] = useState(0);
  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState<string>(isTutor ? "#dc2626" : "#2563eb");
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
  const mine = useRef<string[]>([]);
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
  const stateRef = useRef({ page, tool, color, follow });
  useLayoutEffect(() => {
    stateRef.current = { page, tool, color, follow };
  }, [page, tool, color, follow]);

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
    for (const m of marks.current.values()) if (m.page === pg) drawMark(ctx, m.data, W, H);
    if (other?.stroke && other.page === pg) drawMark(ctx, other.stroke, W, H, 0.6);
    if (drawing.current) drawMark(ctx, currentStroke(drawing.current), W, H);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [other]);

  function currentStroke(p: number[]): StrokeData {
    const { tool: t, color: c } = stateRef.current;
    return t === "hl" ? { t: "hl", c: HIGHLIGHT, w: HL_WIDTH, p } : { t: "pen", c, w: SIZES[size], p };
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
  }, [boardId, isTutor, applyOther]);

  // ---- Telling the other screen what I'm doing ------------------------------
  const sendLive = useCallback(
    (extra: Record<string, unknown> = {}) => {
      if (!boardIdRef.current) return;
      const t0 = Date.now();
      lastLive.current = t0;
      const { page: pg, tool: t, color: c } = stateRef.current;
      const stroke = drawing.current && (t === "pen" || t === "hl") ? currentStroke(drawing.current.slice(-1200)) : null;
      const live = { page: pg, tool: t, color: t === "hl" ? HIGHLIGHT : c, stroke, ...extra };
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
  }, [page, tool, color, sendLive]);

  useEffect(() => {
    const id = setInterval(() => {
      if (Date.now() - lastLive.current > HEARTBEAT_MS) sendLive();
    }, HEARTBEAT_MS);
    return () => clearInterval(id);
  }, [sendLive]);

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
          mine.current = [];
          rev.current = 0;
          setPage(0);
          if (!data.board.urls) {
            needUrls = true;
            return void load();
          }
        }
        if (data.board.urls) {
          needUrls = false;
          setBoard(data.board);
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
  }, [api, isTutor, applyOther]);

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
      marks.current.delete(id);
      removed.current.add(id);
    }
    bump();
    broadcast("del", { ids: hit });
    void post(api, { op: "del", ids: hit });
  }

  function onDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!board || e.button > 0) return;
    const { x, y } = at(e);
    if (tool === "text") {
      setTextAt({ x, y });
      setTextValue("");
      return;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    if (tool === "eraser") {
      erasing.current = true;
      eraseAt(x, y);
      return;
    }
    drawing.current = [x, y];
    render();
  }

  function onMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (erasing.current) {
      const { x, y } = at(e);
      eraseAt(x, y);
      return;
    }
    const pts = drawing.current;
    if (!pts) return;
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

  function onUp() {
    erasing.current = false;
    const pts = drawing.current;
    drawing.current = null;
    if (!pts) return;
    if (pts.length === 2) pts.push(pts[0] + 0.0005, pts[1]);
    addMark(currentStroke(pts));
    sendLive();
  }

  function addMark(data: MarkData) {
    const id = crypto.randomUUID();
    const m: Mark = { id, page, author: me, data };
    marks.current.set(id, m);
    mine.current.push(id);
    bump();
    broadcast("mark", { mark: m });
    void post(api, { op: "add", mark: { id, page, data } });
  }

  function addText() {
    const text = textValue.trim();
    if (textAt && text) addMark({ t: "text", c: color, s: TEXT_SIZE, x: textAt.x, y: Math.max(TEXT_SIZE, textAt.y), text: text.slice(0, 200) });
    setTextAt(null);
    setTextValue("");
  }

  function undo() {
    while (mine.current.length) {
      const id = mine.current.pop()!;
      if (marks.current.has(id)) {
        marks.current.delete(id);
        removed.current.add(id);
        bump();
        broadcast("del", { ids: [id] });
        void post(api, { op: "del", ids: [id] });
        return;
      }
    }
  }

  function clearPage() {
    for (const [id, m] of marks.current) {
      if (m.page === page && (isTutor || m.author === "student")) {
        marks.current.delete(id);
        removed.current.add(id);
      }
    }
    bump();
    setConfirmClear(false);
    broadcast("clear", { page });
    void post(api, { op: "clear", page });
  }

  function goPage(n: number) {
    if (!board) return;
    const next = Math.max(0, Math.min(board.pages - 1, n));
    if (isTutor && other && next !== other.page) setFollow(false);
    setPage(next);
    setTextAt(null);
  }

  // ---- Screen ----------------------------------------------------------------------
  if (!board) return missing ? <>{empty ?? null}</> : <div className="card py-16 text-center text-muted">Loading slides…</div>;

  const url = board.urls?.[page];
  const ago = other?.updated_at && now ? Math.round((now - new Date(other.updated_at).getTime()) / 1000) : null;
  const here = ago != null && ago < 25;
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
                <strong>{otherName}</strong> is on page {other.page + 1} · {TOOL_NAMES[other.tool ?? ""] ?? "—"}
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
              className="btn-secondary min-h-9 px-3 text-sm"
              onClick={() => sendLive({ go_to: page })}
              title={`Move ${otherName}'s screen to this page`}
            >
              Bring {otherName} to page {page + 1}
            </button>
          </span>
        </div>
      ) : null}

      <div ref={stageRef} className={full ? "flex min-h-0 flex-1 items-center justify-center" : ""}>
      <div className="mx-auto" style={{ width: pageWidth }}>
        <div ref={box} className="relative w-full select-none overflow-hidden rounded-2xl border border-line bg-white" style={{ aspectRatio: `1 / ${board.aspect}` }}>
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt={`Page ${page + 1}`} className="pointer-events-none absolute inset-0 h-full w-full" draggable={false} />
          ) : null}
          {board.urls?.[page + 1] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={board.urls[page + 1]} alt="" className="hidden" aria-hidden />
          ) : null}
          <canvas
            ref={canvas}
            className="absolute inset-0 h-full w-full"
            style={{ touchAction: "none", cursor: tool === "text" ? "text" : tool === "eraser" ? "cell" : "crosshair" }}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
          />
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
          <button type="button" className={btn(false)} onClick={() => goPage(page - 1)} disabled={page === 0} aria-label="Previous page">
            ◀
          </button>
          <span className="min-w-16 text-center text-sm font-medium tabular-nums">
            {page + 1} / {board.pages}
          </span>
          <button type="button" className={btn(false)} onClick={() => goPage(page + 1)} disabled={page >= board.pages - 1} aria-label="Next page">
            ▶
          </button>
        </div>

        <div className="flex items-center gap-1 rounded-2xl border border-line bg-surface p-1">
          {(["pen", "hl", "text", "eraser"] as const).map((t) => (
            <button key={t} type="button" className={btn(tool === t)} onClick={() => setTool(t)} aria-pressed={tool === t} title={TOOL_NAMES[t]}>
              <span aria-hidden>{TOOL_NAMES[t].split(" ")[0]}</span>
              <span className="sr-only">{TOOL_NAMES[t]}</span>
            </button>
          ))}
        </div>

        {tool === "pen" || tool === "text" ? (
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
            {tool === "pen" ? (
              <button type="button" className={btn(false)} onClick={() => setSize(size === "thin" ? "thick" : "thin")} title="Line size">
                {size === "thin" ? "Thin" : "Thick"}
              </button>
            ) : null}
          </div>
        ) : null}

        <div className="flex items-center gap-1 rounded-2xl border border-line bg-surface p-1">
          <button type="button" className={btn(false)} onClick={undo} title="Undo">
            ↶ Undo
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
      {!isTutor && !full ? <p className="text-center text-xs text-muted">Mr Ken can see your writing.</p> : null}
    </div>
  );
}
