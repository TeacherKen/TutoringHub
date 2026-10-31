"use client";
import { useEffect, useRef, useState } from "react";
import type { RoomData } from "@/lib/room";
import { TimesTables } from "./games/TimesTables";
import { QuickMaths } from "./games/QuickMaths";
import { MiniSudoku } from "./games/MiniSudoku";
import { snapshotDocument, snapshotElement } from "@/lib/snapshot";
import { Whiteboard } from "./Whiteboard";
import { FootballTables } from "./games/FootballTables";

// Games with a `src` are Mr Ken's own games, copied into /public/games.
const GAMES = [
  { id: "magic-square", name: "Magic Square Academy", blurb: "Mr Ken's magic square adventure", src: "/games/magic-square/index.html" },
  { id: "wolf-vs-sheep", name: "Wolf vs Sheep", blurb: "Mr Ken's strategy game", src: "/games/wolf-vs-sheep/index.html" },
  { id: "tt", name: "Times Tables Sprint", blurb: "How many in 60 seconds?" },
  { id: "qm", name: "Quick Maths", blurb: "10 questions, beat your time" },
  { id: "sd", name: "Mini Sudoku", blurb: "Fill the grid with 1 to 4 (or 6)" },
] as const;
type GameId = (typeof GAMES)[number]["id"];
const SCREEN_EVERY_MS = 2000;

const fmt = (iso: string, opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone, ...opts }).format(new Date(iso));

type Tab = "lesson" | "practice" | "games";

export function Room({ token, initial, initialTab }: { token: string; initial: RoomData; initialTab?: Tab }) {
  const [room, setRoom] = useState(initial);
  const [tab, setTab] = useState<Tab>(initialTab ?? (initial.gamesOpen ? "games" : "lesson"));
  const [game, setGame] = useState<GameId | null>(null);
  const [slide, setSlide] = useState(-1); // -1 = smart slides (when there are some)
  const openRef = useRef(initial.gamesOpen);
  const gameBox = useRef<HTMLDivElement>(null);
  const gameFrame = useRef<HTMLIFrameElement>(null);
  const gameInfo = GAMES.find((g) => g.id === game);

  // While games are open, send Mr Ken a picture of the game screen every 2 seconds.
  useEffect(() => {
    if (!room.gamesOpen || !game) return;
    let last = "";
    const send = async () => {
      try {
        let html = "";
        const frameDoc = gameFrame.current?.contentDocument;
        if (frameDoc?.documentElement) {
          html = snapshotDocument(frameDoc, new URL(gameFrame.current!.src, location.href).href.replace(/[^/]*$/, ""));
        } else if (gameBox.current) {
          html = snapshotElement(gameBox.current);
        }
        if (!html || html === last || html.length > 400_000) return;
        last = html;
        await fetch(`/api/room/${token}/screen`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ game, html }),
          keepalive: false,
        });
      } catch {
        /* skip this one */
      }
    };
    const id = setInterval(send, SCREEN_EVERY_MS);
    const first = setTimeout(send, 500);
    return () => {
      clearInterval(id);
      clearTimeout(first);
    };
  }, [room.gamesOpen, game, token]);

  // Check every few seconds whether Mr Ken has opened or closed games, or added slides.
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch(`/api/room/${token}`, { cache: "no-store" });
        if (!res.ok) return;
        const next = (await res.json()) as RoomData;
        if (!alive) return;
        setRoom(next);
        if (next.gamesOpen !== openRef.current) {
          openRef.current = next.gamesOpen;
          if (next.gamesOpen) setTab("games");
          else {
            setTab((t) => (t === "games" ? "lesson" : t)); // don't pull them out of practice
            setGame(null);
          }
        }
      } catch {
        /* offline for a moment — try again next time */
      }
    };
    const id = setInterval(load, 5000);
    const onVisible = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [token]);

  const slides = room.materials.filter((m) => m.kind === "canva");
  const others = room.materials.filter((m) => m.kind !== "canva");
  const onBoard = room.hasBoard && slide < 0;
  const current = onBoard ? undefined : slides[Math.min(Math.max(0, slide), Math.max(0, slides.length - 1))];

  return (
    <div className="mx-auto flex min-h-dvh max-w-6xl flex-col px-4 pb-8 pt-4">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Hi {room.firstName}!</h1>
          {room.lesson ? (
            <p className="text-sm text-muted">
              {room.lesson.when === "now" ? "Lesson now" : room.lesson.when === "next" ? "Next lesson" : "Last lesson"} ·{" "}
              {fmt(room.lesson.start_at, { weekday: "long", day: "numeric", month: "short" })} ·{" "}
              {fmt(room.lesson.start_at, { hour: "2-digit", minute: "2-digit", hour12: false })}
            </p>
          ) : (
            <p className="text-sm text-muted">Maths with Mr Ken</p>
          )}
        </div>
        <div role="tablist" aria-label="Room" className="flex rounded-xl border border-line bg-surface p-1">
          <button
            role="tab"
            aria-selected={tab === "lesson"}
            onClick={() => setTab("lesson")}
            className={`min-h-11 rounded-lg px-4 text-sm font-medium ${tab === "lesson" ? "bg-accent text-accent-text" : "text-muted"}`}
          >
            Lesson
          </button>
          <button
            role="tab"
            aria-selected={tab === "practice"}
            onClick={() => setTab("practice")}
            className={`min-h-11 rounded-lg px-4 text-sm font-medium ${tab === "practice" ? "bg-accent text-accent-text" : "text-muted"}`}
          >
            ⚽ Practice
          </button>
          <button
            role="tab"
            aria-selected={tab === "games"}
            onClick={() => setTab("games")}
            className={`min-h-11 rounded-lg px-4 text-sm font-medium ${tab === "games" ? "bg-accent text-accent-text" : "text-muted"}`}
          >
            Games {room.gamesOpen ? "" : "🔒"}
          </button>
        </div>
      </header>

      {tab === "lesson" ? (
        <section className="flex flex-1 flex-col gap-4">
          {slides.length + (room.hasBoard ? 1 : 0) > 1 ? (
            <div className="flex flex-wrap gap-2">
              {room.hasBoard ? (
                <button
                  onClick={() => setSlide(-1)}
                  className={`min-h-10 rounded-xl border px-3 text-sm ${onBoard ? "border-accent bg-accent-soft text-accent" : "border-line bg-surface"}`}
                >
                  ✏️ Write on slides
                </button>
              ) : null}
              {slides.map((s, i) => (
                <button
                  key={s.href}
                  onClick={() => setSlide(i)}
                  className={`min-h-10 rounded-xl border px-3 text-sm ${!onBoard && i === Math.max(0, slide) ? "border-accent bg-accent-soft text-accent" : "border-line bg-surface"}`}
                >
                  {s.label || `Slides ${i + 1}`}
                </button>
              ))}
            </div>
          ) : null}

          {onBoard ? (
            <Whiteboard api={`/api/room/${token}/board`} me="student" otherName="Mr Ken" />
          ) : current ? (
            <div className="space-y-2">
              {current.embed ? (
                <div className="relative w-full overflow-hidden rounded-2xl border border-line bg-surface" style={{ aspectRatio: "16 / 9" }}>
                  <iframe
                    key={current.embed}
                    src={current.embed}
                    title={current.label || "Lesson slides"}
                    className="absolute inset-0 h-full w-full"
                    allow="fullscreen"
                    allowFullScreen
                    loading="lazy"
                    referrerPolicy="no-referrer"
                  />
                </div>
              ) : null}
              <a href={current.href} target="_blank" rel="noopener noreferrer" className="btn-secondary w-full sm:w-auto">
                Open slides in Canva ↗
              </a>
            </div>
          ) : (
            <div className="card flex flex-1 items-center justify-center py-16 text-center text-muted">
              Mr Ken will add today&apos;s slides here soon.
            </div>
          )}

          {others.length ? (
            <div className="card space-y-2">
              <h2 className="font-medium">Worksheets and links</h2>
              {others.map((m) => (
                <a
                  key={m.href}
                  href={m.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-h-12 items-center justify-between rounded-xl bg-surface-2 px-3"
                >
                  <span>{m.label}</span>
                  <span className="text-sm text-muted">{m.kind === "pdf" ? "PDF" : "Open"} ↗</span>
                </a>
              ))}
            </div>
          ) : null}
        </section>
      ) : tab === "practice" ? (
        <FootballTables api={`/api/room/${token}/practice`} />
      ) : !room.gamesOpen ? (
        <section className="card flex flex-1 flex-col items-center justify-center py-16 text-center">
          <p className="text-4xl" aria-hidden>
            🔒
          </p>
          <h2 className="mt-3 text-xl font-semibold">Games open at break time</h2>
          <p className="mt-1 text-muted">Mr Ken will unlock them. This page will update by itself.</p>
        </section>
      ) : game && gameInfo && "src" in gameInfo ? (
        <section className="flex flex-1 flex-col gap-2">
          <div className="flex items-center justify-between">
            <button className="btn-quiet px-0" onClick={() => setGame(null)}>
              ‹ All games
            </button>
            <span className="text-xs text-muted">Mr Ken can see your game screen during break.</span>
          </div>
          <iframe
            ref={gameFrame}
            key={gameInfo.id}
            src={gameInfo.src}
            title={gameInfo.name}
            className="w-full flex-1 rounded-2xl border border-line bg-surface"
            style={{ minHeight: "75dvh" }}
          />
        </section>
      ) : game ? (
        <section className="mx-auto w-full max-w-lg space-y-4">
          <div className="flex items-center justify-between">
            <button className="btn-quiet px-0" onClick={() => setGame(null)}>
              ‹ All games
            </button>
            <span className="text-xs text-muted">Mr Ken can see your game screen during break.</span>
          </div>
          <div ref={gameBox} className="card">
            <h2 className="mb-4 text-xl font-semibold">{gameInfo?.name}</h2>
            {game === "tt" ? <TimesTables /> : game === "qm" ? <QuickMaths /> : <MiniSudoku />}
          </div>
        </section>
      ) : (
        <section className="mx-auto grid w-full max-w-lg gap-3">
          <h2 className="text-xl font-semibold">Break time! Pick a game</h2>
          {GAMES.map((g) => (
            <button key={g.id} onClick={() => setGame(g.id)} className="card flex min-h-20 items-center justify-between text-left hover:border-accent">
              <span>
                <span className="block text-lg font-medium">{g.name}</span>
                <span className="text-sm text-muted">{g.blurb}</span>
              </span>
              <span aria-hidden className="text-muted">
                ›
              </span>
            </button>
          ))}
        </section>
      )}
    </div>
  );
}
