"use client";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { MODE_NAMES } from "@/lib/facts";
import { cleanView, secs, watchChannel, type PracticeLive, type WatchView } from "@/lib/watch";

type Screen = { game: string; html: string; updated_at: string } | null;
const NAMES: Record<string, string> = {
  "magic-square": "Magic Square Academy",
  "wolf-vs-sheep": "Wolf vs Sheep",
  tt: "Times Tables Sprint",
  qm: "Quick Maths",
  sd: "Mini Sudoku",
};
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
    const ping = () => {
      if (!alive) return;
      const v = viewRef.current;
      const need = !v || (v.tab === "games" && !!v.game && !v.html); // ask for the full picture
      void ch.send({ type: "broadcast", event: "watch", payload: { on: true, need } });
    };
    ch.on("broadcast", { event: "view" }, ({ payload }) => {
      const v = cleanView(payload);
      if (!v) return;
      const prev = viewRef.current;
      // Unchanged pictures aren't sent again: keep the one we have.
      const next = v.html === undefined && prev && prev.tab === v.tab && prev.game === v.game ? { ...v, html: prev.html } : v;
      viewRef.current = next;
      seenRef.current = Date.now();
      setView(next);
      setSeenAt(seenRef.current);
    }).subscribe((status) => {
      if (status === "SUBSCRIBED") ping();
    });
    const id = setInterval(ping, 4000);
    // Closing the page: the student's "Mr Ken is watching" goes away straight away.
    const stop = () => void ch.send({ type: "broadcast", event: "watch", payload: { on: false } });
    window.addEventListener("pagehide", stop);
    return () => {
      alive = false;
      clearInterval(id);
      window.removeEventListener("pagehide", stop);
      stop();
      void sb.removeChannel(ch);
    };
  }, [token]);

  // The slower way, for game pictures when the live connection isn't getting through.
  useEffect(() => {
    let alive = true;
    const load = async () => {
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
      {live?.tab === "practice" && live.practice ? (
        <PracticeWatch p={live.practice} />
      ) : live?.tab === "games" && live.html ? (
        <ScreenPicture html={live.html} title={`${name}'s game screen`} />
      ) : !live && screen ? (
        <ScreenPicture html={screen.html} title={`${name}'s game screen`} />
      ) : null}
    </div>
  );
}

/** A still copy of the student's screen, at their screen size and scroll position, scaled to fit. */
function ScreenPicture({ html, title }: { html: string; title: string }) {
  const [boxWidth, setBoxWidth] = useState(800);
  const box = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  useEffect(() => {
    if (!box.current) return;
    const ro = new ResizeObserver(([e]) => setBoxWidth(e.contentRect.width));
    ro.observe(box.current);
    return () => ro.disconnect();
  }, []);
  const vw = attr(html, "data-vw", 1024);
  const vh = attr(html, "data-vh", 700);
  const scale = Math.min(1, boxWidth / vw);

  // Scroll the picture to where the student is looking.
  function placeScroll() {
    const win = frame.current?.contentWindow;
    const doc = frame.current?.contentDocument;
    if (!win || !doc) return;
    win.scrollTo(attr(html, "data-scroll-x", 0), attr(html, "data-scroll-y", 0));
    doc.querySelectorAll("[data-th-scroll]").forEach((el) => {
      const [x, y] = (el.getAttribute("data-th-scroll") ?? "0:0").split(":").map(Number);
      el.scrollLeft = x;
      el.scrollTop = y;
    });
  }

  return (
    <div ref={box} className="w-full">
      <div className="overflow-hidden rounded-xl border border-line bg-white" style={{ height: vh * scale }}>
        <iframe
          ref={frame}
          title={title}
          srcDoc={html}
          // Scripts are removed from the picture and blocked here; same-origin only lets us scroll it.
          sandbox="allow-same-origin"
          onLoad={placeScroll}
          className="pointer-events-none origin-top-left border-0"
          style={{ width: vw, height: vh, transform: `scale(${scale})` }}
        />
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
