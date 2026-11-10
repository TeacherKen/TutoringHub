"use client";
import { useTeachListener } from "./TeachTogether";
import { FractionShow } from "./games/FractionShow";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import type { RoomData } from "@/lib/room";
import { createClient } from "@/lib/supabase/client";
import { MAX_LIVE_HTML, watchChannel, type PracticeLive, type WatchView } from "@/lib/watch";
import { BuiltInGame } from "./games/BuiltInGame";
import { snapshotDocument, snapshotElement } from "@/lib/snapshot";
import { Whiteboard } from "./Whiteboard";
import { FootballTables } from "./games/FootballTables";
import { GAMES as ALL_GAMES, type GameInfo } from "@/lib/games";
import { useWolfLink, WVS_SRC } from "./games/WolfOnline";
import { SIDE_NAME, type Side } from "@/lib/wvs";
import { ReportContext } from "./games/report";
import { MissionList } from "./games/Missions";
import type { GameResult, MissionView } from "@/lib/gameScore";

// Break-time games (football is the Practice tab). Games with a `src` are Mr Ken's own games.
const GAMES = ALL_GAMES.filter((g) => g.id !== "football");
type GameId = GameInfo["id"];
const SCREEN_EVERY_MS = 2000;

const fmt = (iso: string, opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone, ...opts }).format(new Date(iso));

type Tab = "lesson" | "practice" | "games";
const noSubscribe = () => () => {};

export function Room({ token, initial, initialTab }: { token: string; initial: RoomData; initialTab?: Tab }) {
  const onDevice = useSyncExternalStore(noSubscribe, () => true, () => false);
  const [room, setRoom] = useState(initial);
  const [tab, setTab] = useState<Tab>(initialTab ?? (initial.gamesOpen ? "games" : "lesson"));
  const teach = useTeachListener(token);
  const teachOn = Boolean(teach);
  const teachRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (teachOn) teachRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [teachOn]);
  const [game, setGame] = useState<GameId | null>(null);
  const [slide, setSlide] = useState(-1); // -1 = smart slides (when there are some)
  const openRef = useRef(initial.gamesOpen);
  const gameBox = useRef<HTMLDivElement>(null);
  const gameFrame = useRef<HTMLIFrameElement>(null);
  const gameInfo = GAMES.find((g) => g.id === game);
  // 🎯 A homework mission's game can be played even while break-time games are closed.
  const [missionGame, setMissionGame] = useState<GameId | null>(null);
  const [missionNote, setMissionNote] = useState<string | null>(null);
  const recentDone = (m: MissionView) => !m.done || (m.doneAt != null && Date.now() - Date.parse(m.doneAt) < 3 * 86_400_000);
  const missions = room.missions.filter(recentDone);
  const openMissions = missions.filter((m) => !m.done).length;
  const playMission = (id: string) => {
    setMissionGame(id as GameId);
    setGame(id as GameId);
    setTab("games");
    setMissionNote(null);
  };
  /** A finished round: save it to this child (Mr Ken's student page, the family page, missions). */
  const report = useCallback(
    (r: GameResult) => {
      if (!game) return;
      const before = room.missions;
      fetch(`/api/room/${token}/games`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ game, ...r }), keepalive: true })
        .then((res) => (res.ok ? res.json() : null))
        .then((d: { missions?: MissionView[] } | null) => {
          if (!d?.missions) return;
          const justDone = d.missions.find((m) => m.done && !before.find((b) => b.id === m.id)?.done);
          if (justDone) setMissionNote(`🎉 Mission complete: ${justDone.name}! Well done!`);
          setRoom((rm) => ({ ...rm, missions: d.missions! }));
        })
        .catch(() => {
          /* offline: this round isn't saved, the game still works */
        });
    },
    [game, token, room.missions],
  );

  /** A picture (HTML copy, no scripts) of the game screen right now, or "" if there's no game. */
  const snapGame = useCallback((): string => {
    try {
      const frameDoc = gameFrame.current?.contentDocument;
      if (frameDoc?.documentElement) return snapshotDocument(frameDoc, new URL(gameFrame.current!.src, location.href).href.replace(/[^/]*$/, ""));
      if (gameBox.current) return snapshotElement(gameBox.current);
    } catch {
      /* the game is still loading */
    }
    return "";
  }, []);

  // ---- 👀 Mr Ken watching live ---------------------------------------------------------------
  // His screen says "I'm watching" every few seconds; while it does, this room tells it what's
  // happening (football answers as they're typed, a picture of a game screen when it changes).
  const [watched, setWatched] = useState(false);
  const watchedUntil = useRef(0);
  const watchCh = useRef<RealtimeChannel | null>(null);
  const practiceNow = useRef<PracticeLive | null>(null);
  const lastLiveHtml = useRef("");
  const viewRef = useRef({ tab, game });
  useLayoutEffect(() => {
    viewRef.current = { tab, game };
  }, [tab, game]);

  const sendView = useCallback(
    (full: boolean, snap?: string) => {
      const ch = watchCh.current;
      if (!ch || Date.now() > watchedUntil.current) return;
      const { tab: t, game: g } = viewRef.current;
      const view: WatchView = { tab: t, game: t === "games" ? g : null, practice: t === "practice" ? practiceNow.current : null };
      if (t === "games" && g) {
        const html = snap ?? snapGame();
        if (html && html.length <= MAX_LIVE_HTML && (full || html !== lastLiveHtml.current)) {
          view.html = html;
          lastLiveHtml.current = html;
        }
      }
      void ch.send({ type: "broadcast", event: "view", payload: view });
    },
    [snapGame],
  );

  useEffect(() => {
    let sb: ReturnType<typeof createClient>;
    try {
      sb = createClient();
    } catch {
      return; // no live connection: Mr Ken still sees game pictures the slower way
    }
    const ch = sb.channel(watchChannel(token), { config: { broadcast: { self: false, ack: false } } });
    ch.on("broadcast", { event: "watch" }, ({ payload }) => {
      if (payload?.on === false) {
        watchedUntil.current = 0;
        setWatched(false);
        return;
      }
      watchedUntil.current = Date.now() + 12_000;
      setWatched(true);
      sendView(payload?.need === true);
    }).subscribe();
    watchCh.current = ch;
    const tick = setInterval(() => {
      if (Date.now() > watchedUntil.current) return setWatched(false);
      const { tab: t, game: g } = viewRef.current;
      if (t !== "games" || !g || document.hidden) return; // nothing to show while the app is in the background
      const html = snapGame();
      if (html && html !== lastLiveHtml.current) sendView(false, html);
    }, 1000);
    return () => {
      clearInterval(tick);
      watchCh.current = null;
      void sb.removeChannel(ch);
    };
  }, [token, sendView, snapGame]);

  // A new tab or game: tell Mr Ken straight away.
  useEffect(() => {
    sendView(true);
  }, [tab, game, sendView]);

  // ---- 🐺🐑 Wolf vs Sheep with Mr Ken (he invites; it opens here even when games are locked) ----
  const [wvs, setWvs] = useState<{ side: Side } | null>(null);
  const [wvsNote, setWvsNote] = useState<string | null>(null);
  const wvsInvite = useRef<{ side: Side; moves: { pieceId: string; to: string }[] } | null>(null);
  const wvsOn = useRef(false);
  const { frameRef: wvsFrame, send: wvsSend } = useWolfLink(token, "student", (m, api) => {
    if (m.local) {
      if (m.type === "loaded" && wvsInvite.current) {
        api.toGame({ type: "start", side: wvsInvite.current.side, moves: wvsInvite.current.moves, opponent: "Mr Ken" });
        api.send({ type: "here" });
      } else if (m.type === "left") leaveWvs();
      return;
    }
    if (m.type === "invite" && m.studentSide) {
      if (wvsOn.current) api.send({ type: "here" });
      else {
        wvsInvite.current = { side: m.studentSide, moves: m.moves ?? [] };
        wvsOn.current = true;
        setWvsNote(null);
        setWvs({ side: m.studentSide });
      }
    } else if (m.type === "end" && wvsOn.current) {
      wvsOn.current = false;
      setWvs(null);
      setWvsNote("Mr Ken ended the game. Well played!");
    }
  });
  function leaveWvs() {
    wvsSend({ type: "left" });
    wvsOn.current = false;
    setWvs(null);
  }

  const onPracticeLive = useCallback(
    (p: PracticeLive) => {
      practiceNow.current = p;
      sendView(false);
    },
    [sendView],
  );

  /** After a tap in a game, send the new picture quickly (and again once any animation ends). */
  const quickPicture = useCallback(() => {
    if (Date.now() > watchedUntil.current) return;
    for (const wait of [150, 700]) {
      setTimeout(() => {
        const html = snapGame();
        if (html && html !== lastLiveHtml.current) sendView(false, html);
      }, wait);
    }
  }, [snapGame, sendView]);

  // While games are open, send Mr Ken a picture of the game screen every 2 seconds.
  useEffect(() => {
    if (!room.gamesOpen || !game) return;
    let last = "";
    const send = async () => {
      if (document.hidden) return; // the app is in the background: save battery and data
      try {
        const html = snapGame();
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
  }, [room.gamesOpen, game, token, snapGame]);

  // Check every few seconds whether Mr Ken has opened or closed games, or added slides.
  useEffect(() => {
    let alive = true;
    const load = async () => {
      if (document.hidden) return; // checked again as soon as the app is opened
      try {
        const res = await fetch(`/api/room/${token}`, { cache: "no-store" });
        if (!res.ok) return;
        const next = (await res.json()) as RoomData;
        if (!alive) return;
        setRoom(next);
        if (next.gamesOpen !== openRef.current) {
          openRef.current = next.gamesOpen;
          if (next.gamesOpen) setTab((t) => (t === "practice" ? t : "games")); // don't end a practice round
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
    <div className="page-enter mx-auto flex min-h-dvh max-w-6xl flex-col overflow-x-clip px-4 pb-8 pt-5">
      <header className="glass mb-5 flex rounded-[26px] px-5 py-4 flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-[32px] font-semibold leading-tight tracking-tight sm:text-[40px]">Hi {room.firstName}!</h1>
          {room.lesson ? (
            <p className="text-sm text-muted">
              {room.lesson.when === "now" ? "Lesson now" : room.lesson.when === "next" ? "Next lesson" : "Last lesson"} ·{" "}
              {/* The child's own time zone, so it's only written once the page is on their device. */}
              {onDevice ? `${fmt(room.lesson.start_at, { weekday: "long", day: "numeric", month: "short" })} · ${fmt(room.lesson.start_at, { hour: "2-digit", minute: "2-digit", hour12: false })}` : "…"}
            </p>
          ) : (
            <p className="text-sm text-muted">Maths with Mr Ken</p>
          )}
          {watched ? (
            <p className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1 text-sm font-medium text-accent" role="status">
              👀 Mr Ken is watching
            </p>
          ) : null}
        </div>
        <div role="tablist" aria-label="Room" className="glass flex gap-1 rounded-[22px] p-1.5">
          <button
            role="tab"
            aria-selected={tab === "lesson"}
            onClick={() => setTab("lesson")}
            className={`tab press ${tab === "lesson" ? "is-on" : ""}`}
          >
            Lesson
          </button>
          <button
            role="tab"
            aria-selected={tab === "practice"}
            onClick={() => setTab("practice")}
            className={`tab press ${tab === "practice" ? "is-on" : ""}`}
          >
            ⚽ Practice
          </button>
          <button
            role="tab"
            aria-selected={tab === "games"}
            onClick={() => setTab("games")}
            className={`tab press ${tab === "games" ? "is-on" : ""}`}
          >
            Games {room.gamesOpen ? "" : openMissions ? `🎯${openMissions}` : "🔒"}
          </button>
        </div>
      </header>

      {/* 🧑‍🏫 Mr Ken is showing something live (teach together): it sits on top of everything else. */}
      {teach ? (
        <section ref={teachRef} className="glass mb-5 scroll-mt-4 rounded-[26px] border-2 border-accent p-4 sm:p-5" aria-live="polite">
          <p className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1 text-sm font-semibold text-accent">🧑‍🏫 Mr Ken is showing you</p>
          <div className="rounded-2xl bg-surface p-3 text-ink">
            <FractionShow value={teach} readOnly />
          </div>
        </section>
      ) : null}

      {wvsNote && !wvs ? (
        <p role="status" className="mb-3 rounded-xl bg-accent-soft p-3 text-sm text-accent">
          {wvsNote}
        </p>
      ) : null}

      {wvs ? (
        <section className="flex flex-1 flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-medium">
              🐺🐑 Wolf vs Sheep with Mr Ken · you are the {SIDE_NAME[wvs.side]}
            </p>
            <button type="button" className="btn-secondary min-h-10 px-3 text-sm" onClick={leaveWvs}>
              Leave game
            </button>
          </div>
          <iframe ref={wvsFrame} src={WVS_SRC} title="Wolf vs Sheep with Mr Ken" className="w-full flex-1 rounded-2xl border border-line bg-surface" style={{ minHeight: "75dvh" }} />
        </section>
      ) : tab === "lesson" ? (
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
        <FootballTables api={`/api/room/${token}/practice`} onLive={onPracticeLive} />
      ) : !room.gamesOpen && !(game && game === missionGame) ? (
        <section className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-4">
          <MissionList missions={missions} onPlay={playMission} title="🎯 Your missions" />
          <div className="card flex flex-1 flex-col items-center justify-center py-12 text-center">
            <p className="text-4xl" aria-hidden>
              🔒
            </p>
            <h2 className="mt-3 text-xl font-semibold">Other games open at break time</h2>
            <p className="mt-1 text-muted">Mr Ken will unlock them. This page will update by itself.</p>
          </div>
        </section>
      ) : game && gameInfo?.src ? (
        <section className="flex flex-1 flex-col gap-2">
          <div className="flex items-center justify-between">
            <button className="btn-quiet px-0" onClick={() => setGame(null)}>
              ‹ All games
            </button>
            {room.gamesOpen ? <span className="text-xs text-muted">Mr Ken can see your game screen.</span> : null}
          </div>
          <iframe
            ref={gameFrame}
            key={gameInfo.id}
            src={gameInfo.src}
            onLoad={(e) => {
              // Mr Ken's games are on this site, so taps inside them can be noticed.
              try {
                e.currentTarget.contentDocument?.addEventListener("pointerup", quickPicture);
                e.currentTarget.contentDocument?.addEventListener("keyup", quickPicture);
              } catch {
                /* fine: the 1-second check still sends changes */
              }
            }}
            title={gameInfo.name}
            className="w-full flex-1 rounded-2xl border border-line bg-surface"
            style={{ minHeight: "75dvh" }}
          />
        </section>
      ) : game ? (
        <section className={`mx-auto w-full space-y-4 ${gameInfo?.wide ? "max-w-5xl" : "max-w-lg"}`}>
          <div className="flex items-center justify-between">
            <button className="btn-quiet px-0" onClick={() => {
              setGame(null);
              setMissionNote(null);
            }}>
              ‹ {room.gamesOpen ? "All games" : "Back"}
            </button>
            {room.gamesOpen ? <span className="text-xs text-muted">Mr Ken can see your game screen.</span> : null}
          </div>
          {missionNote ? (
            <p role="status" className="pz-anim animate-[tt-pop_.4s_ease-out] rounded-2xl bg-ok-soft p-3 text-center font-semibold text-ok">
              {missionNote}
            </p>
          ) : (
            missions
              .filter((m) => m.game === game && !m.done)
              .slice(0, 1)
              .map((m) => (
                <p key={m.id} className="rounded-2xl bg-accent-soft p-3 text-sm font-medium text-accent">
                  🎯 Mission: {m.rounds} round{m.rounds === 1 ? "" : "s"} · {m.played} done so far
                </p>
              ))
          )}
          <div ref={gameBox} className="card" onPointerUp={quickPicture} onKeyUp={quickPicture}>
            <h2 className="mb-4 text-xl font-semibold">{gameInfo?.name}</h2>
            <ReportContext.Provider value={report}>
              <BuiltInGame id={game} />
            </ReportContext.Provider>
          </div>
        </section>
      ) : (
        <section className="mx-auto grid w-full max-w-lg gap-3">
          <MissionList missions={missions} onPlay={playMission} title="🎯 Your missions" />
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
