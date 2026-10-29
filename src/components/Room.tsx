"use client";
import { useEffect, useRef, useState } from "react";
import type { RoomData } from "@/lib/room";
import { TimesTables } from "./games/TimesTables";
import { QuickMaths } from "./games/QuickMaths";
import { MiniSudoku } from "./games/MiniSudoku";

const GAMES = [
  { id: "tt", name: "Times Tables Sprint", blurb: "How many in 60 seconds?" },
  { id: "qm", name: "Quick Maths", blurb: "10 questions, beat your time" },
  { id: "sd", name: "Mini Sudoku", blurb: "Fill the grid with 1 to 4 (or 6)" },
] as const;
type GameId = (typeof GAMES)[number]["id"];

const fmt = (iso: string, opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone, ...opts }).format(new Date(iso));

export function Room({ token, initial }: { token: string; initial: RoomData }) {
  const [room, setRoom] = useState(initial);
  const [tab, setTab] = useState<"lesson" | "games">(initial.gamesOpen ? "games" : "lesson");
  const [game, setGame] = useState<GameId | null>(null);
  const [slide, setSlide] = useState(0);
  const openRef = useRef(initial.gamesOpen);

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
            setTab("lesson");
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
  const current = slides[Math.min(slide, Math.max(0, slides.length - 1))];

  return (
    <div className="mx-auto flex min-h-dvh max-w-5xl flex-col px-4 pb-8 pt-4">
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
          {slides.length > 1 ? (
            <div className="flex flex-wrap gap-2">
              {slides.map((s, i) => (
                <button
                  key={s.href}
                  onClick={() => setSlide(i)}
                  className={`min-h-10 rounded-xl border px-3 text-sm ${i === slide ? "border-accent bg-accent-soft text-accent" : "border-line bg-surface"}`}
                >
                  {s.label || `Slides ${i + 1}`}
                </button>
              ))}
            </div>
          ) : null}

          {current ? (
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
      ) : !room.gamesOpen ? (
        <section className="card flex flex-1 flex-col items-center justify-center py-16 text-center">
          <p className="text-4xl" aria-hidden>
            🔒
          </p>
          <h2 className="mt-3 text-xl font-semibold">Games open at break time</h2>
          <p className="mt-1 text-muted">Mr Ken will unlock them. This page will update by itself.</p>
        </section>
      ) : game ? (
        <section className="mx-auto w-full max-w-lg space-y-4">
          <button className="btn-quiet px-0" onClick={() => setGame(null)}>
            ‹ All games
          </button>
          <div className="card">
            <h2 className="mb-4 text-xl font-semibold">{GAMES.find((g) => g.id === game)?.name}</h2>
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
