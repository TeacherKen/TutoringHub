"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { FAST_MS, parseFact, pickRound, TABLES, updateFact, type Answer, type FactState } from "@/lib/facts";
import { setSoundOn, sfx, soundOn } from "@/lib/gameSound";
import { MasteryGrid } from "../MasteryGrid";
import { KITS, Stadium, TARGETS, type Confetti, type Kit, type Shot } from "./Stadium";

// ⚽ Football Times Tables: a penalty shootout. Type the answer, tap the goal to aim, score!
// Facts answered wrong or slowly come back sooner (see lib/facts.ts).

type Data = { name: string; tables: number[]; progress: FactState[]; sessions: { score: number; total: number; created_at: string }[]; best?: number | null };
type Kick = { fact: string; second: boolean };
type Banner = { key: number; text: string; tone: "goal" | "saved"; sub?: string };
type Result = { score: number; total: number; newHigh: boolean; first: boolean };

const KICKS = 10;
const PENDING_KEY = "tutoringhub-tt-pending";
const KIT_KEY = "tutoringhub-tt-kit";
const FLY_MS = 700;
const CONFETTI_COLORS = ["#facc15", "#ef4444", "#3b82f6", "#22c55e", "#f97316", "#a855f7", "#ffffff"];

const answerOf = (fact: string) => {
  const p = parseFact(fact)!;
  return p[0] * p[1];
};

const makeConfetti = (n = 30, spread = 440): Confetti[] =>
  Array.from({ length: n }, () => ({
    dx: (Math.random() - 0.5) * spread,
    dy: -70 + Math.random() * 280,
    r: Math.random() * 900 - 450,
    c: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
    d: Math.random() * 150,
  }));

export function FootballTables({ api }: { api: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tables, setTables] = useState<number[]>([]);
  const [kit, setKit] = useState<Kit>(KITS[1]);
  const [sound, setSound] = useState(true);
  const [stage, setStage] = useState<"setup" | "play" | "done">("setup");
  const [kicks, setKicks] = useState<Kick[]>([]);
  const [i, setI] = useState(0);
  const [typed, setTyped] = useState("");
  const [shot, setShot] = useState<Shot | null>(null);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [goals, setGoals] = useState<boolean[]>([]);
  const [banner, setBanner] = useState<Banner | null>(null);
  const [cheer, setCheer] = useState(0);
  const [confetti, setConfetti] = useState<Confetti[]>([]);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [powers, setPowers] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const started = useRef(0);
  const busy = useRef(false);

  useEffect(() => {
    let alive = true;
    const post = (body: unknown) =>
      fetch(api, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => {
        if (!r.ok) throw new Error("not saved");
      });
    // Rounds that couldn't be saved earlier (no internet) are sent first.
    const pending = readPending();
    Promise.all(pending.map(post))
      .then(() => pending.length && writePending([]))
      .catch(() => undefined)
      .then(() => fetch(api, { cache: "no-store" }))
      .then(async (res) => {
        if (!res.ok) throw new Error(res.status === 503 ? "Times tables aren't set up yet — ask Mr Ken." : "Couldn't load. Check the internet and refresh.");
        const d = (await res.json()) as Data;
        if (!alive) return;
        setData(d);
        setTables((t) => (t.length ? t : d.tables));
        setSound(soundOn());
        setKit(readKit());
      })
      .catch((e: unknown) => alive && setError(e instanceof Error ? e.message : "Couldn't load."));
    return () => {
      alive = false;
    };
  }, [api]);

  function start() {
    if (!data || !tables.length) return;
    setKicks(pickRound(tables, data.progress, new Date(), KICKS).map((fact) => ({ fact, second: false })));
    setI(0);
    setTyped("");
    setShot(null);
    setBanner(null);
    setConfetti([]);
    setAnswers([]);
    setGoals([]);
    setStreak(0);
    setBestStreak(0);
    setPowers(0);
    setResult(null);
    setStage("play");
    sfx.whistle();
    started.current = Date.now();
  }

  const kick = kicks[i];

  // Full time: show the result, update the chart and save.
  const finish = useCallback(
    (done: Answer[], scored: boolean[]) => {
      const score = scored.filter(Boolean).length;
      const body = { answers: done, tables, score, total: scored.length };
      const best = data?.best ?? null;
      setResult({ score, total: scored.length, newHigh: best != null && score > best, first: best == null });
      setStage("done");
      if (score >= 7) {
        sfx.win();
        setConfetti(makeConfetti(50, 600));
      } else sfx.whistle();
      // Update the chart straight away; the server keeps the real copy.
      setData((d) => {
        if (!d) return d;
        const map = new Map(d.progress.map((p) => [p.fact, p]));
        for (const a of done) map.set(a.fact, updateFact(map.get(a.fact), a, new Date()));
        return { ...d, progress: [...map.values()], best: Math.max(d.best ?? 0, score) };
      });
      fetch(api, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
        .then((r) => {
          if (!r.ok) throw new Error();
        })
        .catch(() => writePending([...readPending(), body])); // no internet: send it next time
    },
    [api, tables, data?.best],
  );

  const shoot = useCallback(
    (aim?: number) => {
      if (!kick || shot || !typed || busy.current) return;
      busy.current = true;
      const ms = Date.now() - started.current;
      const correct = Number(typed) === answerOf(kick.fact);
      const power = correct && ms < FAST_MS;
      const target = aim ?? Math.floor(Math.random() * TARGETS.length);
      const others = TARGETS.map((_, n) => n).filter((n) => n !== target);
      const keeper = correct ? others[Math.floor(Math.random() * others.length)] : target;
      const nextAnswers = [...answers, { fact: kick.fact, correct, ms }];
      const nextGoals = kick.second ? goals : [...goals, correct];
      // Missed ones get a second chance at the end of the round.
      const nextKicks = !correct && !kick.second ? [...kicks, { fact: kick.fact, second: true }] : kicks;
      const nextStreak = kick.second ? streak : correct ? streak + 1 : 0;
      setAnswers(nextAnswers);
      setGoals(nextGoals);
      setKicks(nextKicks);
      setShot({ target, keeper, result: correct ? "goal" : "saved", power, stage: "fly" });
      if (power) sfx.power();
      else sfx.kick();

      setTimeout(() => {
        setShot((s) => (s ? { ...s, stage: "after" } : s));
        setStreak(nextStreak);
        setBestStreak((b) => Math.max(b, nextStreak));
        if (correct) {
          sfx.goal();
          setCheer((c) => c + 1);
          setConfetti(makeConfetti());
          if (power) setPowers((p) => p + 1);
          const text = kick.second ? "GOAL!" : nextStreak === 3 ? "HAT-TRICK!" : nextStreak >= 4 ? `${nextStreak} IN A ROW!` : "GOOOAL!";
          setBanner({ key: Date.now(), tone: "goal", text, sub: power ? "⚡ POWER SHOT" : nextStreak === 3 ? "🎩 3 goals in a row" : undefined });
        } else {
          sfx.save();
          setBanner({ key: Date.now(), tone: "saved", text: "SAVED!" });
        }
        setTimeout(
          () => {
            busy.current = false;
            setShot(null);
            setBanner(null);
            setConfetti([]);
            setTyped("");
            started.current = Date.now();
            if (i + 1 >= nextKicks.length) finish(nextAnswers, nextGoals);
            else setI(i + 1);
          },
          correct ? 1300 : 2400,
        );
      }, FLY_MS);
    },
    [kick, shot, typed, answers, goals, kicks, i, streak, finish],
  );

  const press = useCallback((k: string) => {
    sfx.tap();
    if (k === "⌫") setTyped((t) => t.slice(0, -1));
    else setTyped((t) => (t.length < 3 ? t + k : t));
  }, []);

  // Keyboard on a Mac: numbers, Backspace, Enter.
  useEffect(() => {
    if (stage !== "play") return;
    const onKey = (e: KeyboardEvent) => {
      if (shot) return;
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === "Backspace") press("⌫");
      else if (e.key === "Enter") shoot();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [stage, shoot, press, shot]);

  function toggleSound() {
    setSoundOn(!sound);
    setSound(!sound);
  }

  function chooseKit(k: Kit) {
    setKit(k);
    sfx.tap();
    try {
      localStorage.setItem(KIT_KEY, k.id);
    } catch {
      /* fine */
    }
  }

  if (error) return <p className="card text-center text-muted">{error}</p>;
  if (!data) return <p className="card text-center text-muted">Loading…</p>;

  // ---- Choose tables and team colour ---------------------------------------------------
  if (stage === "setup") {
    return (
      <section className="mx-auto w-full max-w-3xl space-y-4">
        <div className="card space-y-5 text-center">
          <h2 className="text-2xl font-bold">⚽ Football Times Tables</h2>
          <div className="space-y-2">
            <p className="font-medium">1. Pick your tables</p>
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
                    className={`h-14 min-w-14 rounded-2xl border-2 px-3 text-xl font-bold transition active:scale-95 ${on ? "border-green-600 bg-green-600 text-white" : "border-line bg-surface"}`}
                  >
                    {t}×
                  </button>
                );
              })}
            </div>
          </div>
          <div className="space-y-2">
            <p className="font-medium">2. Pick your team colour</p>
            <div className="flex flex-wrap justify-center gap-2">
              {KITS.map((k) => (
                <button
                  key={k.id}
                  type="button"
                  aria-label={`${k.id} shirt`}
                  aria-pressed={kit.id === k.id}
                  onClick={() => chooseKit(k)}
                  className={`flex h-16 w-16 items-center justify-center rounded-2xl border-2 transition active:scale-95 ${kit.id === k.id ? "border-ink bg-surface-2 ring-2 ring-ink" : "border-line bg-surface"}`}
                >
                  <svg viewBox="0 0 40 36" className="h-11 w-11" aria-hidden>
                    <path d="M12 2 L4 7 L1 15 L8 17 L9 34 L31 34 L32 17 L39 15 L36 7 L28 2 Q20 7 12 2Z" fill={k.shirt} stroke="#0f172a" strokeWidth="1.2" />
                    <text x="20" y="27" textAnchor="middle" fontSize="11" fontWeight="900" fill={k.text}>
                      10
                    </text>
                  </svg>
                </button>
              ))}
            </div>
          </div>
          <button type="button" className="btn-primary h-16 w-full max-w-xs text-xl" disabled={!tables.length} onClick={start}>
            ⚽ Kick off!
          </button>
          {data.best != null ? <p className="text-sm text-muted">🏆 Your high score: {data.best} out of 10</p> : null}
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
    const missed = [...new Set(answers.filter((a) => !a.correct).map((a) => a.fact))];
    return (
      <section className="card relative mx-auto w-full max-w-3xl space-y-4 overflow-hidden text-center">
        {confetti.length ? (
          <div className="pointer-events-none absolute left-1/2 top-16">
            {confetti.map((c, n) => (
              <span
                key={n}
                className="tt-confetti absolute block h-3 w-2 rounded-sm"
                style={{ background: c.c, animationDelay: `${c.d}ms`, ["--dx" as string]: `${c.dx}px`, ["--dy" as string]: `${c.dy}px`, ["--r" as string]: `${c.r}deg` }}
              />
            ))}
          </div>
        ) : null}
        <p className="text-sm font-bold uppercase tracking-widest text-muted">Full time!</p>
        <p className="tt-pop text-7xl" aria-hidden>
          {score >= 9 ? "🏆" : score >= 7 ? "🥇" : score >= 5 ? "🥈" : "⚽"}
        </p>
        <h2 className="text-3xl font-bold">
          {data.name} {score} – {result.total - score} Keeper
        </h2>
        <p className="flex justify-center gap-1 text-5xl" aria-label={`${stars} stars`}>
          {stars ? (
            Array.from({ length: stars }, (_, n) => (
              <span key={n} className="tt-pop inline-block" style={{ animationDelay: `${300 + n * 250}ms` }}>
                ⭐
              </span>
            ))
          ) : (
            <span>💪</span>
          )}
        </p>
        <div className="flex flex-wrap justify-center gap-2 text-sm font-semibold">
          {result.newHigh ? <span className="tt-pop rounded-full bg-yellow-300 px-3 py-1 text-yellow-950">🏆 New high score!</span> : null}
          {result.first ? <span className="rounded-full bg-green-100 px-3 py-1 text-green-900">🎉 First match played!</span> : null}
          {powers ? <span className="rounded-full bg-orange-100 px-3 py-1 text-orange-900">⚡ {powers} power {powers === 1 ? "shot" : "shots"}</span> : null}
          {bestStreak >= 2 ? <span className="rounded-full bg-red-100 px-3 py-1 text-red-900">🔥 {bestStreak} goals in a row</span> : null}
        </div>
        {missed.length ? (
          <div className="space-y-1">
            <p className="text-muted">Keep practising:</p>
            <p className="text-xl font-semibold">{missed.map((f) => `${f.replace("x", " × ")} = ${answerOf(f)}`).join("   ·   ")}</p>
          </div>
        ) : (
          <p className="text-xl text-green-700">Perfect match — no misses!</p>
        )}
        <div className="flex flex-wrap justify-center gap-2">
          <button type="button" className="btn-primary h-14 px-6 text-lg" onClick={start}>
            ⚽ Play again
          </button>
          <button type="button" className="btn-secondary h-14 px-6 text-lg" onClick={() => setStage("setup")}>
            Change tables
          </button>
        </div>
        <div className="pt-2 text-left">
          <MasteryGrid progress={data.progress} tables={tables} />
        </div>
      </section>
    );
  }

  // ---- Penalty! --------------------------------------------------------------------------
  const [a, b] = parseFact(kick?.fact ?? "2x2")!;
  const scored = goals.filter(Boolean).length;
  const saves = goals.length - scored;
  const savedNow = shot?.result === "saved" && shot.stage === "after";
  return (
    <section className="mx-auto w-full max-w-5xl space-y-3">
      {/* Scoreboard */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-2xl bg-slate-900 px-4 py-2 text-white shadow">
        <div className="flex min-w-0 items-center gap-2">
          <span className="h-5 w-5 shrink-0 rounded" style={{ background: kit.shirt, boxShadow: "inset 0 0 0 2px rgba(255,255,255,.4)" }} />
          <span className="truncate text-sm font-bold uppercase tracking-wide sm:text-base">{data.name}</span>
        </div>
        <span className="rounded-lg bg-black px-3 py-0.5 font-mono text-3xl font-black tabular-nums text-yellow-300">
          {scored}
          <span className="px-1 text-slate-500">–</span>
          {saves}
        </span>
        <div className="flex items-center justify-end gap-2">
          <span className="text-sm font-bold uppercase tracking-wide sm:text-base">Keeper</span>
          <button type="button" onClick={toggleSound} className="rounded-lg px-1.5 py-1 text-lg hover:bg-white/10" aria-label={sound ? "Turn sound off" : "Turn sound on"}>
            {sound ? "🔊" : "🔇"}
          </button>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-1.5" aria-label="Kicks so far">
        {Array.from({ length: KICKS }, (_, n) => (
          <span
            key={n}
            className={`flex h-7 w-7 items-center justify-center rounded-full text-sm ${n < goals.length ? (goals[n] ? "bg-green-600 text-white" : "bg-red-500 text-white") : n === goals.length && !kick?.second ? "bg-yellow-300 ring-2 ring-yellow-500" : "bg-surface-2"}`}
          >
            {n < goals.length ? (goals[n] ? "⚽" : "✕") : ""}
          </span>
        ))}
        {streak >= 2 ? <span className="ml-2 rounded-full bg-orange-500 px-2.5 py-0.5 text-sm font-bold text-white">🔥 {streak} in a row</span> : null}
      </div>

      <div className="grid gap-3 lg:grid-cols-[1.5fr_1fr] lg:items-start">
        <Stadium shot={shot} aiming={!!typed && !shot} onAim={shoot} kit={kit} name={data.name} cheer={cheer} banner={banner} confetti={confetti} />

        <div className="space-y-3">
          {/* The question */}
          <div className="card space-y-3 text-center">
            {kick?.second ? <p className="text-sm font-bold uppercase tracking-wide text-amber-700">Second chance!</p> : null}
            <p className="text-5xl font-black tabular-nums tracking-tight sm:text-6xl">
              {a} × {b} = <span className={savedNow ? "text-red-600" : typed ? "" : "text-muted"}>{savedNow ? a * b : typed || "?"}</span>
            </p>
            <div>
              <div className="relative h-3 overflow-hidden rounded-full bg-surface-2">
                <div key={i} className="tt-drain h-full rounded-full" style={{ animationPlayState: shot ? "paused" : "running" }} />
              </div>
              <p className="mt-1 text-left text-xs text-muted">⚡ Answer before the orange runs out for a power shot!</p>
            </div>
            <p className={`min-h-6 text-base font-medium ${savedNow ? "text-red-600" : "text-ink"}`}>
              {savedNow ? `The answer is ${a * b}. You'll get it next time!` : shot ? "" : typed ? "👆 Tap the goal to aim — or press Kick!" : "Type your answer"}
            </p>
          </div>

          {/* Number pad, big for small fingers */}
          <div className="grid grid-cols-3 gap-2">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9", "⌫", "0", "⚽"].map((k) => (
              <button
                key={k}
                type="button"
                disabled={!!shot || (k === "⚽" && !typed)}
                onClick={() => (k === "⚽" ? shoot() : press(k))}
                className={`h-14 rounded-2xl font-bold shadow-sm transition active:scale-90 disabled:opacity-40 lg:h-16 ${
                  k === "⚽" ? "bg-green-600 text-xl text-white sm:text-2xl" : "border border-line bg-surface text-3xl"
                }`}
                aria-label={k === "⚽" ? "Kick" : k === "⌫" ? "Delete" : k}
              >
                {k === "⚽" ? "⚽ Kick" : k}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function readKit(): Kit {
  try {
    const id = localStorage.getItem(KIT_KEY);
    return KITS.find((k) => k.id === id) ?? KITS[1];
  } catch {
    return KITS[1];
  }
}

function readPending(): unknown[] {
  try {
    return JSON.parse(localStorage.getItem(PENDING_KEY) ?? "[]") as unknown[];
  } catch {
    return [];
  }
}
function writePending(v: unknown[]) {
  try {
    if (v.length) localStorage.setItem(PENDING_KEY, JSON.stringify(v.slice(-20)));
    else localStorage.removeItem(PENDING_KEY);
  } catch {
    /* storage blocked — fine */
  }
}
