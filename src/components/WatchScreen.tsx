"use client";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { MODE_NAMES } from "@/lib/facts";
import { GAMES } from "@/lib/games";
import { cleanView, secs, unpackHtml, watchChannel, type PracticeLive, type WatchView } from "@/lib/watch";
import { canLiveCopy, copyReceiver, type CopyMsg } from "@/lib/liveCopy";
import type { eventWithTime, Replayer } from "rrweb";
import "rrweb/dist/style.css";

type Screen = { game: string; html: string; updated_at: string } | null;
const NAMES: Record<string, string> = Object.fromEntries(GAMES.map((g) => [g.id, g.name]));
const FRESH_MS = 12_000; // the room answers every 4 seconds while watched

function attr(html: string, name: string, fallback: number): number {
  const m = new RegExp(`${name}="(\\d+)"`).exec(html.slice(0, 2000));
  return m ? Number(m[1]) : fallback;
}

/**
 * 👀 Watch a student live: football answers as they type them, and a picture of their game
 * screen within about a second of a change. Uses the live connection; if that isn't working,
 * game pictures still arrive every 2 seconds (while games are open). Nothing can be clicked.
 */
export function WatchScreen({ studentId, name, token }: { studentId: string; name: string; token?: string | null }) {
  const [view, setView] = useState<WatchView | null>(null);
  const [seenAt, setSeenAt] = useState(0);
  const [now, setNow] = useState(0);
  const [screen, setScreen] = useState<Screen>(null);
  const viewRef = useRef<WatchView | null>(null);
  const seenRef = useRef(0);
  // The live copy (smooth, like a shared Canva design): rebuilt here from the changes the room sends.
  const copyBox = useRef<HTMLDivElement>(null);
  const player = useRef<Replayer | null>(null);
  const [copySize, setCopySize] = useState<{ w: number; h: number } | null>(null);
  const [copyReady, setCopyReady] = useState(false);
  const [copyBoxWidth, setCopyBoxWidth] = useState(800);
  useEffect(() => {
    const el = copyBox.current?.parentElement?.parentElement; // the whole watch panel (always visible)
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setCopyBoxWidth(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // The live connection: say "I'm watching" every 4 seconds, and take what the room sends.
  useEffect(() => {
    if (!token) return;
    let sb: ReturnType<typeof createClient>;
    try {
      sb = createClient();
    } catch {
      return;
    }
    const ch = sb.channel(watchChannel(token), { config: { broadcast: { self: false, ack: false } } });
    let alive = true;
    let joined = false; // only talk once the live connection is open (otherwise each message is a slow web request)
    let newest = 0; // the newest picture number shown
    let copyNeed = canLiveCopy(); // ask for a full live copy (at the start, or after missing something)
    const ping = () => {
      if (!alive || !joined || document.hidden) return; // Mr Ken isn't looking: the child's screen stops sending after a few seconds
      const v = viewRef.current;
      const need = !v || (v.tab === "games" && !!v.game && !v.html && !v.copy); // ask for the full picture
      void ch.send({ type: "broadcast", event: "watch", payload: { on: true, need, copyNeed } });
    };
    const play = async (events: eventWithTime[], fresh: boolean) => {
      if (!alive) return;
      copyNeed = false;
      if (fresh || !player.current) {
        const { Replayer: R } = await import("rrweb");
        if (!alive || !copyBox.current) return;
        player.current?.destroy();
        copyBox.current.innerHTML = "";
        const p = new R([], { root: copyBox.current, liveMode: true, mouseTail: false, showWarning: false, triggerFocus: false, UNSAFE_replayCanvas: false });
        p.on("resize", (d) => {
          const { width, height } = d as { width: number; height: number };
          setCopySize({ w: width, h: height });
        });
        // Play the changes a moment after they happen (smooth, even if the internet hiccups).
        p.startLive(events[0].timestamp - 250);
        player.current = p;
        setCopyReady(true);
      }
      for (const e of events) player.current?.addEvent(e);
    };
    const receive = copyReceiver(
      (events, fresh) => void play(events, fresh),
      () => {
        copyNeed = true;
        ping();
      },
    );
    ch.on("broadcast", { event: "copy" }, ({ payload }) => receive(payload as CopyMsg));
    const take = (v: WatchView) => {
      const prev = viewRef.current;
      // Unchanged pictures aren't sent again: keep the one we have.
      const next = v.html === undefined && prev && prev.tab === v.tab && prev.game === v.game ? { ...v, html: prev.html } : v;
      viewRef.current = next;
      seenRef.current = Date.now();
      setView(next);
      setSeenAt(seenRef.current);
    };
    ch.on("broadcast", { event: "view" }, ({ payload }) => {
      const v = cleanView(payload);
      if (!v) return;
      if (v.n != null) {
        if (v.n < newest) return; // a late picture: a newer one is already here
        newest = v.n;
      }
      if (!v.z) return take(v);
      const n = v.n;
      void unpackHtml(v.z).then((html) => {
        if (!alive || (n != null && n < newest)) return;
        take({ ...v, z: undefined, html: html ?? undefined });
      });
    }).subscribe((status) => {
      joined = status === "SUBSCRIBED";
      if (joined) ping();
    });
    const id = setInterval(ping, 4000);
    const onVisible = () => document.visibilityState === "visible" && ping();
    document.addEventListener("visibilitychange", onVisible);
    // Closing the page: the student's "Mr Ken is watching" goes away straight away.
    const stop = () => void ch.send({ type: "broadcast", event: "watch", payload: { on: false } });
    window.addEventListener("pagehide", stop);
    return () => {
      alive = false;
      player.current?.destroy();
      player.current = null;
      clearInterval(id);
      window.removeEventListener("pagehide", stop);
      document.removeEventListener("visibilitychange", onVisible);
      stop();
      void sb.removeChannel(ch);
    };
  }, [token]);

  // The slower way, for game pictures when the live connection isn't getting through.
  useEffect(() => {
    let alive = true;
    const load = async () => {
      if (document.hidden) return;
      if (alive) setNow(Date.now());
      if (Date.now() - seenRef.current < FRESH_MS) return; // live is working
      try {
        const res = await fetch(`/api/watch/${studentId}`, { cache: "no-store" });
        if (res.ok && alive) {
          const next = (await res.json()) as Screen;
          setScreen((prev) => (prev && next && prev.html === next.html ? { ...prev, updated_at: next.updated_at } : next));
        }
      } catch {
        /* try again */
      }
    };
    void load();
    const id = setInterval(load, 2000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [studentId]);

  const live = view && now - seenAt < FRESH_MS ? view : null;
  const showCopy = !!live && live.tab !== "lesson" && !!live.copy && copyReady && !!copySize;
  const scale = copySize ? Math.min(1, copyBoxWidth / copySize.w) : 1;
  const oldAgo = screen && now ? Math.max(0, Math.round((now - new Date(screen.updated_at).getTime()) / 1000)) : null;

  return (
    <div className="space-y-2">
      <p className="flex flex-wrap items-center gap-2 text-sm text-muted">
        {live ? (
          <>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-ok-soft px-2 py-0.5 text-xs font-semibold text-ok">
              <span className="h-2 w-2 animate-pulse rounded-full bg-current" aria-hidden /> Live
            </span>
            <span>
              {name}{" "}
              {live.tab === "lesson" ? (
                "is on the Lesson page (their writing shows on the smart slides)"
              ) : live.tab === "practice" ? (
                <>
                  is playing <strong className="text-ink">Football Times Tables</strong>
                </>
              ) : live.game ? (
                <>
                  is playing <strong className="text-ink">{NAMES[live.game] ?? live.game}</strong>
                </>
              ) : (
                "is choosing a game"
              )}
            </span>
          </>
        ) : screen ? (
          <>
            {name} is playing <strong className="text-ink">{NAMES[screen.game] ?? screen.game}</strong>
            {oldAgo != null ? ` · updated ${oldAgo < 5 ? "just now" : `${oldAgo}s ago`}` : ""}
            {oldAgo != null && oldAgo > 20 ? " (they may have left the game)" : ""}
          </>
        ) : (
          `Waiting for ${name}… They need their room link open.`
        )}
      </p>
      {/* the live copy (always here, shown when it's running) */}
      <div className={showCopy ? "overflow-hidden rounded-2xl border border-line bg-white shadow-inner" : "hidden"} style={copySize ? { height: Math.round(copySize.h * scale) } : undefined} aria-label={`${name}'s screen, live`}>
        <div ref={copyBox} className="pointer-events-none origin-top-left [&_.replayer-wrapper]:!relative" style={{ transform: `scale(${scale})`, width: copySize?.w }} />
      </div>
      {showCopy ? null : live?.tab === "practice" && live.practice ? (
        <PracticeWatch p={live.practice} />
      ) : live?.tab === "games" && live.html ? (
        <ScreenPicture html={live.html} title={`${name}'s game screen`} />
      ) : !live && screen ? (
        <ScreenPicture html={screen.html} title={`${name}'s game screen`} />
      ) : null}
    </div>
  );
}

/** Scroll a picture to where the student is looking. */
function placeScroll(frame: HTMLIFrameElement | null, html: string) {
  const win = frame?.contentWindow;
  const doc = frame?.contentDocument;
  if (!win || !doc) return;
  win.scrollTo(attr(html, "data-scroll-x", 0), attr(html, "data-scroll-y", 0));
  doc.querySelectorAll("[data-th-scroll]").forEach((el) => {
    const [x, y] = (el.getAttribute("data-th-scroll") ?? "0:0").split(":").map(Number);
    el.scrollLeft = x;
    el.scrollTop = y;
  });
}

/**
 * A still copy of the student's screen, at their screen size and scroll position, scaled to fit.
 * No blinking: each new picture loads in a hidden copy behind the one you see, and the two swap
 * only once it's completely ready (styles, pictures and scroll position).
 */
export function ScreenPicture({ html, title }: { html: string; title: string }) {
  const [boxWidth, setBoxWidth] = useState(800);
  const [front, setFront] = useState<{ idx: 0 | 1; html: string }>({ idx: 0, html });
  // The picture loading behind the one you see. It is never swapped mid-load (pictures can arrive
  // several times a second): when it's ready it comes to the front, then the newest one loads.
  const [next, setNext] = useState("");
  if (!next && html !== front.html) setNext(html);
  const box = useRef<HTMLDivElement>(null);
  const frames = [useRef<HTMLIFrameElement>(null), useRef<HTMLIFrameElement>(null)] as const;
  useEffect(() => {
    if (!box.current) return;
    const ro = new ResizeObserver(([e]) => setBoxWidth(e.contentRect.width));
    ro.observe(box.current);
    return () => ro.disconnect();
  }, []);

  const back = (1 - front.idx) as 0 | 1;
  // What each copy shows: the one in front keeps its picture; the hidden one loads the newest.
  const docFor = (i: 0 | 1) => (i === front.idx ? front.html : next);
  // A game picture may show only part of the child's screen width (data-crop-x/-w); older pictures show it all.
  const size = (h: string) => {
    const vw = attr(h, "data-vw", 1024);
    return { vw, vh: attr(h, "data-vh", 700), cx: attr(h, "data-crop-x", 0), cw: attr(h, "data-crop-w", vw) };
  };
  const shown = size(front.html);
  const scale = Math.min(1, boxWidth / shown.cw);

  function loaded(i: 0 | 1) {
    const el = frames[i].current;
    if (i === front.idx) return placeScroll(el, front.html);
    const doc = docFor(i);
    if (!doc) return; // the blank one
    placeScroll(el, doc);
    setFront({ idx: i, html: doc });
    setNext("");
  }

  return (
    <div ref={box} className="w-full">
      <div className="relative overflow-hidden rounded-xl border border-line bg-white" style={{ height: shown.vh * scale }}>
        {([0, 1] as const).map((i) => {
          const doc = docFor(i);
          const { vw, vh, cx, cw } = size(doc || front.html);
          const s = Math.min(1, boxWidth / cw);
          return (
            <iframe
              key={i}
              ref={frames[i]}
              title={i === front.idx ? title : `${title} (next)`}
              aria-hidden={i !== front.idx}
              tabIndex={-1}
              srcDoc={lockPicture(doc)}
              // Scripts are removed from the picture and blocked here; same-origin only lets us scroll it.
              sandbox="allow-same-origin"
              onLoad={() => loaded(i)}
              className={`pointer-events-none absolute left-0 top-0 origin-top-left border-0 ${i === back ? "invisible" : ""}`}
              style={{ width: vw, height: vh, transform: `translateX(${-cx * s}px) scale(${s})` }}
            />
          );
        })}
      </div>
    </div>
  );
}

/** Football Times Tables as it happens: the question, what they're typing, and every answer so far. */
function PracticeWatch({ p }: { p: PracticeLive }) {
  const tables = p.tables.map((t) => `${t}×`).join(" ");
  const answers = [...p.log].reverse();
  return (
    <div className="space-y-3 rounded-xl border border-line bg-surface p-3">
      <p className="text-sm text-muted">
        {MODE_NAMES[p.mode]} · {tables || "no tables chosen"}
        {p.stage === "setup" ? " · choosing before kick-off" : null}
      </p>

      {p.stage === "play" && p.q ? (
        <div className="flex flex-wrap items-stretch gap-3">
          <div className="min-w-48 rounded-xl bg-[#0b1d42] px-5 py-3 text-center text-white">
            <p className="text-xs uppercase tracking-wide text-white/60">
              Kick {Math.min(p.kick, p.kicks)} of {p.kicks}
              {p.second ? " · second chance" : ""}
            </p>
            <p className="font-sport text-4xl font-bold tabular-nums" aria-live="polite">
              {p.q.parts.map((part, n) =>
                part === null ? (
                  <span
                    key={n}
                    className={`mx-1 inline-block min-w-[1.6em] rounded-md px-1 ${p.typed ? (Number(p.typed) === p.q!.answer ? "bg-[#b8ef2a] text-[#0b1d42]" : "bg-white text-[#0b1d42]") : "bg-white/15"}`}
                  >
                    {p.typed || "?"}
                  </span>
                ) : (
                  <span key={n} className="mx-1">
                    {part}
                  </span>
                ),
              )}
            </p>
            <p className="text-xs text-white/60">Answer: {p.q.answer}</p>
          </div>
          <div className="flex flex-wrap content-start gap-2 text-sm">
            <span className="rounded-full bg-surface-2 px-3 py-1">⚽ {p.goals} {p.goals === 1 ? "goal" : "goals"}</span>
            <span className="rounded-full bg-surface-2 px-3 py-1">🧤 {p.misses} saved</span>
            {p.streak >= 2 ? <span className="rounded-full bg-surface-2 px-3 py-1">🔥 {p.streak} in a row</span> : null}
          </div>
        </div>
      ) : null}

      {p.stage === "done" && p.score != null ? (
        <p className="font-medium">
          Full time: {p.score} out of {p.total}
        </p>
      ) : null}

      {answers.length ? (
        <ol className="space-y-1 text-sm">
          {answers.map((a, n) => (
            <li key={answers.length - n} className="flex flex-wrap items-baseline gap-x-2">
              <span className={a.correct ? "text-ok" : "text-danger"} aria-label={a.correct ? "right" : "wrong"}>
                {a.correct ? "✓" : "✗"}
              </span>
              <span className="font-medium tabular-nums">{a.text}</span>
              {!a.correct ? <span className="text-danger">typed {a.given || "nothing"}</span> : null}
              <span className="text-muted">
                {secs(a.ms)}
                {a.second ? " · second chance" : ""}
              </span>
            </li>
          ))}
        </ol>
      ) : p.stage !== "setup" ? (
        <p className="text-sm text-muted">No answers yet.</p>
      ) : null}
    </div>
  );
}

/** The screen picture comes from a child's device, so it may only load pictures, styles and fonts from this
 *  app (and Google Fonts): nothing that could reach another server and see when Mr Ken is watching. The rule
 *  goes first, before anything the device sent, so it can't be pushed out of the page's head. */
const PICTURE_RULES =
  "default-src 'none'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com";
export function lockPicture(html: string): string {
  if (!html) return html;
  return `<!doctype html><meta http-equiv="Content-Security-Policy" content="${PICTURE_RULES}">${html.replace(/^\s*<!doctype[^>]*>/i, "")}`;
}
