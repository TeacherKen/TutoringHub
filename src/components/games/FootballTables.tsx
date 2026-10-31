"use client";
import "@fontsource/barlow-condensed/700.css";
import "@fontsource/barlow-condensed/700-italic.css";
import "@fontsource/barlow-condensed/800-italic.css";
import { useCallback, useEffect, useState } from "react";
import {
  cleanMode,
  makeQuestion,
  MODE_EXAMPLES,
  MODE_NAMES,
  MODES,
  pickRound,
  questionWithAnswer,
  TABLES,
  updateFact,
  type Answer,
  type FactState,
  type GameMode,
  type Question,
} from "@/lib/facts";
import { setSoundOn, sfx, soundOn } from "@/lib/gameSound";
import { addRound, newTrophies, shelf, trophies, type Trophy, type TrophyStats } from "@/lib/trophies";
import { MasteryGrid } from "../MasteryGrid";
import { Medal, TrophyShelf } from "../Trophies";
import { KITS, Stadium, type Kit } from "./Stadium";
import { ConfettiBurst, Controls, GLASS, makeConfetti, PANEL, Shirt, type Confetti } from "./Controls";
import { useKeys, usePenalty } from "./usePenalty";

// ⚽ Football Times Tables: a penalty shootout. Type the answer, tap the goal to aim, score!
// Facts answered wrong or slowly come back sooner (see lib/facts.ts).

type Data = {
  name: string;
  tables: number[];
  progress: FactState[];
  sessions: { score: number; total: number; created_at: string }[];
  best?: number | null;
  stats?: TrophyStats;
  mode?: GameMode | null; // what Mr Ken chose for this child (null: not chosen)
};
type Kick = { q: Question; second: boolean };
type Result = { score: number; total: number; newHigh: boolean; first: boolean; won: Trophy[] };

const KICKS = 10;
const PENDING_KEY = "tutoringhub-tt-pending";
const KIT_KEY = "tutoringhub-tt-kit";
const MODE_KEY = "tutoringhub-tt-mode";

export function FootballTables({ api }: { api: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tables, setTables] = useState<number[]>([]);
  const [kit, setKit] = useState<Kit>(KITS[1]);
  const [mode, setMode] = useState<GameMode>("times");
  const [sound, setSound] = useState(true);
  const [stage, setStage] = useState<"setup" | "play" | "done">("setup");
  const [kicks, setKicks] = useState<Kick[]>([]);
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [goals, setGoals] = useState<boolean[]>([]);
  const [confetti, setConfetti] = useState<Confetti[]>([]);
  const [result, setResult] = useState<Result | null>(null);
  const [allTrophies, setAllTrophies] = useState(false);
  const pen = usePenalty();

  useEffect(() => {
    let alive = true;
    // Rounds that couldn't be saved earlier (no internet) are sent first, one at a time.
    sendPending(api)
      .catch(() => undefined)
      .then(() => fetch(api, { cache: "no-store" }))
      .then(async (res) => {
        if (!res.ok) throw new Error(res.status === 503 ? "Times tables aren't set up yet. Ask Mr Ken." : "Couldn't load. Check the internet and refresh.");
        const d = (await res.json()) as Data;
        if (!alive) return;
        setData(d);
        setTables((t) => (t.length ? t : d.tables));
        setSound(soundOn());
        setKit(readKit(api));
        setMode(d.mode ? cleanMode(d.mode) : (readMode(api) ?? "times")); // Mr Ken's choice first
      })
      .catch((e: unknown) => alive && setError(e instanceof Error ? e.message : "Couldn't load."));
    return () => {
      alive = false;
    };
  }, [api]);

  const { reset } = pen;
  function start() {
    if (!data || !tables.length) return;
    setKicks(pickRound(tables, data.progress, new Date(), KICKS).map((fact) => ({ q: makeQuestion(fact, mode), second: false })));
    setI(0);
    setConfetti([]);
    setAnswers([]);
    setGoals([]);
    setResult(null);
    reset();
    setStage("play");
    sfx.whistle();
  }

  const kick = kicks[i];

  // Full time: show the result and new trophies, update the chart and save.
  const finish = useCallback(
    (done: Answer[], scored: boolean[], bestStreak: number, powers: number) => {
      if (!data) return;
      const score = scored.filter(Boolean).length;
      const body = { answers: done, tables, score, total: scored.length, bestStreak, powers, mode };
      const map = new Map(data.progress.map((p) => [p.fact, p]));
      for (const a of done) map.set(a.fact, updateFact(map.get(a.fact), a, new Date()));
      const progress = [...map.values()];
      let won: Trophy[] = [];
      let stats = data.stats;
      if (stats) {
        const after = addRound(stats, { score, total: scored.length, game: mode === "times" ? "tt" : `tt-${mode}`, best_streak: bestStreak, powers, created_at: new Date().toISOString() }, progress);
        won = newTrophies(trophies(stats), trophies(after));
        stats = after;
      }
      const best = data.best ?? null;
      setResult({ score, total: scored.length, newHigh: best != null && score > best, first: best == null, won });
      setStage("done");
      if (score >= 7 || won.length) {
        sfx.win();
        setConfetti(makeConfetti(["#ffc629", "#ffffff", kit.shirt]));
      } else sfx.whistle();
      // Update the chart and trophies straight away; the server keeps the real copy.
      setData({ ...data, progress, stats, best: Math.max(data.best ?? 0, score) });
      fetch(api, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
        .then((r) => {
          if (!r.ok) throw new Error();
        })
        .catch(() => writePending(api, [...readPending(api), body])); // no internet: send it next time
    },
    [api, tables, data, kit.shirt, mode],
  );

  const { kick: takeKick, typed } = pen;
  const shoot = useCallback(
    (aim?: number) => {
      if (!kick) return;
      const r = takeKick(kick.q, typed, {
        aim,
        counts: !kick.second,
        onNext: (res) => {
          const nextAnswers = [...answers, { fact: res.fact, correct: res.correct, ms: res.ms }];
          const nextGoals = kick.second ? goals : [...goals, res.correct];
          // Missed ones get a second chance at the end of the round.
          const nextKicks = !res.correct && !kick.second ? [...kicks, { q: kick.q, second: true }] : kicks;
          setAnswers(nextAnswers);
          setGoals(nextGoals);
          setKicks(nextKicks);
          if (i + 1 >= nextKicks.length) finish(nextAnswers, nextGoals, Math.max(pen.bestStreak, res.streak), pen.powers + (res.power ? 1 : 0));
          else setI(i + 1);
        },
        onLand: (res) => {
          if (!kick.second) setGoals((g) => [...g, res.correct]); // the score box updates as the ball lands
        },
      });
      return r;
    },
    [kick, takeKick, typed, answers, goals, kicks, i, finish, pen.bestStreak, pen.powers],
  );

  useKeys(stage === "play" && !pen.shot, pen.press, shoot);

  function toggleSound() {
    setSoundOn(!sound);
    setSound(!sound);
  }

  function chooseMode(m: GameMode) {
    setMode(m);
    sfx.tap();
    try {
      localStorage.setItem(`${MODE_KEY}:${api}`, m);
    } catch {
      /* fine */
    }
  }

  function chooseKit(k: Kit) {
    setKit(k);
    sfx.tap();
    try {
      localStorage.setItem(`${KIT_KEY}:${api}`, k.id);
    } catch {
      /* fine */
    }
  }

  if (error) return <p className="card text-center text-muted">{error}</p>;
  if (!data) return <p className="card text-center text-muted">Loading…</p>;

  const myTrophies = data.stats ? shelf(trophies(data.stats), tables) : [];
  const gotCount = myTrophies.filter((t) => t.got).length;
  // Won trophies, plus the few closest to being won (all of them if asked).
  const nearest = myTrophies
    .filter((t) => !t.got)
    .sort((a, b) => b.have / b.need - a.have / a.need)
    .slice(0, 4);
  const showTrophies = allTrophies ? myTrophies : [...myTrophies.filter((t) => t.got), ...nearest];

  // ---- Before the match: tables and kit --------------------------------------------------
  if (stage === "setup") {
    return (
      <section className="mx-auto w-full max-w-3xl space-y-4">
        <div className={`${PANEL} space-y-6 px-5 py-6 text-center sm:px-8`}>
          <div>
            <h2 className="font-sport text-[clamp(34px,6vw,52px)] font-extrabold italic leading-none">Football Times Tables</h2>
            <p className="mt-2 text-white/70">Every right answer is a goal. Choose your tables, your game and your kit.</p>
          </div>
          <div className="space-y-2.5">
            <p className="font-sport text-xl font-bold">Tables</p>
            <div className="flex flex-wrap justify-center gap-2">
              {TABLES.map((t) => {
                const on = tables.includes(t);
                return (
                  <button
                    key={t}
                    type="button"
                    aria-pressed={on}
                    onClick={() => {
                      sfx.tap();
                      setTables((x) => (on ? x.filter((y) => y !== t) : [...x, t].sort((a, b) => a - b)));
                    }}
                    className={`font-sport h-14 min-w-14 rounded-xl px-3 text-2xl font-bold transition active:scale-95 ${on ? "bg-[#ffc629] text-[#0b1d42]" : `${GLASS} text-white hover:bg-white/15`}`}
                  >
                    {t}×
                  </button>
                );
              })}
            </div>
          </div>
          <div className="space-y-2.5">
            <p className="font-sport text-xl font-bold">Game</p>
            <div className="mx-auto grid max-w-xl grid-cols-2 gap-2 sm:grid-cols-4">
              {MODES.map((m) => {
                const on = mode === m;
                return (
                  <button
                    key={m}
                    type="button"
                    aria-pressed={on}
                    onClick={() => chooseMode(m)}
                    className={`flex min-h-16 flex-col items-center justify-center rounded-xl px-2 transition active:scale-95 ${on ? "bg-[#ffc629] text-[#0b1d42]" : `${GLASS} text-white hover:bg-white/15`}`}
                  >
                    <span className="font-sport text-xl font-bold leading-tight">{MODE_NAMES[m]}</span>
                    <span className={`font-sport text-base leading-tight ${on ? "text-[#0b1d42]/70" : "text-white/60"}`}>{MODE_EXAMPLES[m]}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="space-y-2.5">
            <p className="font-sport text-xl font-bold">Kit</p>
            <div className="flex flex-wrap justify-center gap-2">
              {KITS.map((k) => {
                const on = kit.id === k.id;
                return (
                  <button
                    key={k.id}
                    type="button"
                    aria-label={`${k.id} shirt`}
                    aria-pressed={on}
                    onClick={() => chooseKit(k)}
                    className={`flex h-16 w-16 items-center justify-center rounded-xl transition active:scale-95 ${on ? "bg-white/20 ring-2 ring-[#ffc629]" : `${GLASS} hover:bg-white/15`}`}
                  >
                    <Shirt colour={k.shirt} text={k.text} />
                  </button>
                );
              })}
            </div>
          </div>
          <div className="space-y-2">
            <button
              type="button"
              className="font-sport h-16 w-full max-w-xs rounded-2xl bg-[#ffc629] text-3xl font-extrabold italic text-[#0b1d42] shadow-lg transition hover:bg-[#ffd447] active:scale-95 disabled:opacity-40"
              disabled={!tables.length}
              onClick={start}
            >
              Kick off
            </button>
            <p className="text-sm text-white/65">
              {data.best != null ? `High score: ${data.best} out of 10` : null}
              {data.best != null && data.stats ? " · " : null}
              {data.stats ? `${data.stats.stars} ${data.stats.stars === 1 ? "star" : "stars"}` : null}
            </p>
          </div>
          {myTrophies.length ? (
            <div className="space-y-2 text-left">
              <p className="font-sport text-center text-xl font-bold">
                Trophies <span className="text-white/60">{gotCount} won</span>
              </p>
              <TrophyShelf items={showTrophies} dark />
              {showTrophies.length < myTrophies.length ? (
                <p className="text-center">
                  <button type="button" className="text-sm text-white/70 underline" onClick={() => setAllTrophies(true)}>
                    See all {myTrophies.length} trophies
                  </button>
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
        <div className="card space-y-2">
          <h3 className="font-medium">{data.name}&apos;s times tables</h3>
          <MasteryGrid progress={data.progress} />
        </div>
      </section>
    );
  }

  // ---- Full time -------------------------------------------------------------------------
  if (stage === "done" && result) {
    const { score } = result;
    const stars = score >= 9 ? 3 : score >= 7 ? 2 : score >= 5 ? 1 : 0;
    const missed = [...new Set(kicks.filter((k) => k.second).map((k) => questionWithAnswer(k.q)))];
    return (
      <section className="mx-auto w-full max-w-3xl space-y-4">
        <div className={`${PANEL} relative space-y-5 overflow-hidden px-5 py-7 text-center sm:px-8`}>
          <ConfettiBurst pieces={confetti} />
          <p className="font-sport text-xl font-bold italic text-white/70">Full time</p>
          <div className="font-sport tt-pop mx-auto inline-flex items-stretch overflow-hidden rounded-lg text-[clamp(26px,5vw,44px)] font-bold leading-none shadow-[0_10px_30px_rgba(0,0,0,.4)]">
            <span className="w-2" style={{ background: kit.shirt }} />
            <span className="bg-[#0b1d42] px-4 py-3 uppercase tracking-wide">{data.name}</span>
            <span className="min-w-[1.5em] bg-white px-3 py-3 font-extrabold tabular-nums text-[#0b1d42]">{score}</span>
            <span className="min-w-[1.5em] border-l border-[#0b1d42]/15 bg-white px-3 py-3 font-extrabold tabular-nums text-[#0b1d42]">{result.total - score}</span>
            <span className="bg-[#0b1d42] px-4 py-3 uppercase tracking-wide">Keeper</span>
            <span className="w-2 bg-[#b8ef2a]" />
          </div>
          <Stars n={stars} />
          {result.won.length ? (
            <div className="space-y-2">
              <p className="font-sport text-2xl font-extrabold italic text-[#ffc629]">{result.won.length === 1 ? "New trophy!" : `${result.won.length} new trophies!`}</p>
              <div className="flex flex-wrap justify-center gap-3">
                {result.won.map((t, n) => (
                  <div key={t.id} className="tt-pop flex w-28 flex-col items-center gap-1" style={{ animationDelay: `${900 + n * 250}ms` }}>
                    <Medal t={t} size={72} />
                    <span className="text-sm font-semibold leading-tight">{t.name}</span>
                    <span className="text-xs leading-tight text-white/60">{t.how}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          <div className="flex flex-wrap justify-center gap-2 text-sm font-semibold">
            {result.newHigh ? <span className="tt-pop rounded-full bg-[#ffc629] px-3 py-1 text-[#0b1d42]">New high score</span> : null}
            {pen.powers ? (
              <span className={`${GLASS} rounded-full px-3 py-1`}>
                ⚡ {pen.powers} power {pen.powers === 1 ? "shot" : "shots"}
              </span>
            ) : null}
            {pen.bestStreak >= 2 ? <span className={`${GLASS} rounded-full px-3 py-1`}>{pen.bestStreak} goals in a row</span> : null}
          </div>
          {missed.length ? (
            <div className="space-y-1.5">
              <p className="text-white/70">Practise these for next time</p>
              <div className="flex flex-wrap justify-center gap-2">
                {missed.map((f) => (
                  <span key={f} className="font-sport rounded-lg bg-white px-3 py-1 text-2xl font-bold text-[#0b1d42]">
                    {f}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <p className="font-sport text-2xl font-bold italic text-[#ffc629]">A perfect match, no misses</p>
          )}
          <div className="flex flex-wrap justify-center gap-2">
            <button
              type="button"
              className="font-sport h-14 rounded-2xl bg-[#ffc629] px-7 text-2xl font-extrabold italic text-[#0b1d42] shadow-lg transition hover:bg-[#ffd447] active:scale-95"
              onClick={start}
            >
              Play again
            </button>
            <button type="button" className={`font-sport h-14 rounded-2xl px-6 text-xl font-bold ${GLASS} transition hover:bg-white/15 active:scale-95`} onClick={() => setStage("setup")}>
              Change tables
            </button>
          </div>
        </div>
        <div className="card">
          <MasteryGrid progress={data.progress} tables={tables} />
        </div>
      </section>
    );
  }

  // ---- The match -------------------------------------------------------------------------
  return (
    <section className={`${PANEL} mx-auto w-full max-w-6xl`}>
      <div className="grid gap-3 lg:grid-cols-[1.55fr_1fr] lg:items-stretch">
        <Stadium
          shot={pen.shot}
          aiming={!!pen.typed && !pen.shot}
          onAim={shoot}
          kit={kit}
          name={data.name}
          cheer={pen.cheer}
          banner={pen.banner}
          goals={goals}
          kicks={KICKS}
          streak={pen.streak}
          sound={sound}
          onToggleSound={toggleSound}
        />
        <Controls q={kick?.q ?? { fact: "2x2", kind: "times" }} typed={pen.typed} shot={pen.shot} second={kick?.second} clockKey={i} onPress={pen.press} onKick={() => shoot()} />
      </div>
    </section>
  );
}

export function Stars({ n }: { n: number }) {
  return (
    <div className="flex justify-center gap-2" aria-label={`${n} out of 3 stars`}>
      {[0, 1, 2].map((k) => (
        <svg key={k} viewBox="0 0 24 24" className={`h-12 w-12 ${k < n ? "tt-pop" : ""}`} style={{ animationDelay: `${350 + k * 220}ms` }} aria-hidden>
          <path
            d="M12 2.5l2.9 6 6.6.8-4.9 4.5 1.3 6.5L12 17l-5.9 3.3 1.3-6.5L2.5 9.3l6.6-.8z"
            fill={k < n ? "#ffc629" : "rgba(255,255,255,.12)"}
            stroke={k < n ? "#e0a800" : "rgba(255,255,255,.2)"}
            strokeWidth="1"
            strokeLinejoin="round"
          />
        </svg>
      ))}
    </div>
  );
}

// Saved per child, so brothers and sisters sharing one iPad keep their own kit and rounds.
function readKit(api: string): Kit {
  try {
    const id = localStorage.getItem(`${KIT_KEY}:${api}`);
    return KITS.find((k) => k.id === id) ?? KITS[1];
  } catch {
    return KITS[1];
  }
}

function readMode(api: string): GameMode | null {
  try {
    const m = localStorage.getItem(`${MODE_KEY}:${api}`);
    return m ? cleanMode(m) : null;
  } catch {
    return null;
  }
}

/** Send rounds saved on this device while offline, oldest first; each is removed once saved.
 *  Only one send runs at a time, so a round is never sent twice at once. */
const sendingNow = new Map<string, Promise<void>>();
function sendPending(api: string): Promise<void> {
  const running = sendingNow.get(api);
  if (running) return running;
  const job = sendPendingNow(api).finally(() => sendingNow.delete(api));
  sendingNow.set(api, job);
  return job;
}

async function sendPendingNow(api: string) {
  for (let n = 0; n < 20; n++) {
    const [next] = readPending(api);
    if (!next) return;
    const r = await fetch(api, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(next) }).catch(() => null);
    if (!r) return; // still offline: try again next time
    if (r.status >= 500) return; // server trouble: keep it for next time
    writePending(api, readPending(api).slice(1)); // saved (or refused for good): take it off the list
  }
}

function readPending(api: string): unknown[] {
  try {
    return JSON.parse(localStorage.getItem(`${PENDING_KEY}:${api}`) ?? "[]") as unknown[];
  } catch {
    return [];
  }
}
function writePending(api: string, v: unknown[]) {
  try {
    if (v.length) localStorage.setItem(`${PENDING_KEY}:${api}`, JSON.stringify(v.slice(-20)));
    else localStorage.removeItem(`${PENDING_KEY}:${api}`);
  } catch {
    /* storage blocked — fine */
  }
}
