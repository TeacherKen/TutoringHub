"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { factKey, parseFact, pickRound, TABLES, updateFact, type Answer, type FactState } from "@/lib/facts";
import { MasteryGrid } from "../MasteryGrid";

// ⚽ Football Times Tables: a penalty shootout. Every right answer is a goal.
// Facts answered wrong or slowly come back sooner (see lib/facts.ts).

type Data = { name: string; tables: number[]; progress: FactState[]; sessions: { score: number; total: number; created_at: string }[] };
type Kick = { fact: string; second: boolean };
type Shot = { result: "goal" | "saved"; corner: number } | null;

const KICKS = 10;
const PENDING_KEY = "tutoringhub-tt-pending";

const answerOf = (fact: string) => {
  const p = parseFact(fact)!;
  return p[0] * p[1];
};

export function FootballTables({ api }: { api: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tables, setTables] = useState<number[]>([]);
  const [stage, setStage] = useState<"setup" | "play" | "done">("setup");
  const [kicks, setKicks] = useState<Kick[]>([]);
  const [i, setI] = useState(0);
  const [typed, setTyped] = useState("");
  const [shot, setShot] = useState<Shot>(null);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [goals, setGoals] = useState<boolean[]>([]);
  const started = useRef(0);

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
    setAnswers([]);
    setGoals([]);
    setStage("play");
    started.current = Date.now();
  }

  const kick = kicks[i];
  const busy = useRef(false);

  // End of the round: show the result, update the chart and save.
  const finish = useCallback(
    (done: Answer[], scored: boolean[]) => {
      const body = { answers: done, tables, score: scored.filter(Boolean).length, total: scored.length };
      setStage("done");
      // Update the chart straight away; the server keeps the real copy.
      setData((d) => {
        if (!d) return d;
        const map = new Map(d.progress.map((p) => [p.fact, p]));
        for (const a of done) map.set(a.fact, updateFact(map.get(a.fact), a, new Date()));
        return { ...d, progress: [...map.values()] };
      });
      fetch(api, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
        .then((r) => {
          if (!r.ok) throw new Error();
        })
        .catch(() => writePending([...readPending(), body])); // no internet: send it next time
    },
    [api, tables],
  );

  const shoot = useCallback(() => {
    if (!kick || shot || !typed || busy.current) return;
    busy.current = true;
    const correct = Number(typed) === answerOf(kick.fact);
    const nextAnswers = [...answers, { fact: kick.fact, correct, ms: Date.now() - started.current }];
    const nextGoals = kick.second ? goals : [...goals, correct];
    // Missed ones get a second chance at the end of the round.
    const nextKicks = !correct && !kick.second ? [...kicks, { fact: kick.fact, second: true }] : kicks;
    setAnswers(nextAnswers);
    setGoals(nextGoals);
    setKicks(nextKicks);
    setShot({ result: correct ? "goal" : "saved", corner: Math.floor(Math.random() * 3) });
    setTimeout(
      () => {
        busy.current = false;
        setShot(null);
        setTyped("");
        started.current = Date.now();
        if (i + 1 >= nextKicks.length) finish(nextAnswers, nextGoals);
        else setI(i + 1);
      },
      correct ? 1100 : 2600,
    );
  }, [kick, shot, typed, answers, goals, kicks, i, finish]);

  // Keyboard on a Mac: numbers, Backspace, Enter.
  useEffect(() => {
    if (stage !== "play") return;
    const onKey = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) setTyped((t) => (t.length < 3 ? t + e.key : t));
      else if (e.key === "Backspace") setTyped((t) => t.slice(0, -1));
      else if (e.key === "Enter") shoot();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [stage, shoot]);

  if (error) return <p className="card text-center text-muted">{error}</p>;
  if (!data) return <p className="card text-center text-muted">Loading…</p>;

  // ---- Choose tables -------------------------------------------------------------------
  if (stage === "setup") {
    return (
      <section className="space-y-4">
        <div className="card space-y-4 text-center">
          <h2 className="text-2xl font-bold">⚽ Football Times Tables</h2>
          <p className="text-muted">Score a goal for every right answer! Pick your tables:</p>
          <div className="flex flex-wrap justify-center gap-2">
            {TABLES.map((t) => {
              const on = tables.includes(t);
              return (
                <button
                  key={t}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setTables((x) => (on ? x.filter((y) => y !== t) : [...x, t].sort((a, b) => a - b)))}
                  className={`h-14 min-w-14 rounded-2xl border-2 px-3 text-xl font-bold transition active:scale-95 ${on ? "border-green-600 bg-green-600 text-white" : "border-line bg-surface"}`}
                >
                  {t}×
                </button>
              );
            })}
          </div>
          <button type="button" className="btn-primary h-16 w-full max-w-xs text-xl" disabled={!tables.length} onClick={start}>
            ⚽ Kick off!
          </button>
        </div>
        <div className="card space-y-2">
          <h3 className="font-medium">{data.name}&apos;s times tables</h3>
          <MasteryGrid progress={data.progress} />
        </div>
      </section>
    );
  }

  // ---- Result ---------------------------------------------------------------------------
  if (stage === "done") {
    const score = goals.filter(Boolean).length;
    const stars = score >= 9 ? 3 : score >= 7 ? 2 : score >= 5 ? 1 : 0;
    const missed = [...new Set(answers.filter((a) => !a.correct).map((a) => a.fact))];
    return (
      <section className="card space-y-4 text-center">
        <p className="text-6xl" aria-hidden>
          {score >= 9 ? "🏆" : score >= 7 ? "🥇" : "⚽"}
        </p>
        <h2 className="text-3xl font-bold">
          You scored {score} out of {goals.length}!
        </h2>
        <p className="text-4xl" aria-label={`${stars} stars`}>
          {"⭐".repeat(stars) || "💪"}
        </p>
        {missed.length ? (
          <div className="space-y-1">
            <p className="text-muted">Keep practising:</p>
            <p className="text-xl font-semibold">{missed.map((f) => `${f.replace("x", " × ")} = ${answerOf(f)}`).join("   ·   ")}</p>
          </div>
        ) : (
          <p className="text-xl text-green-700">Perfect round — no misses!</p>
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
  const [a, b] = parseFact(kick?.fact ?? factKey(2, 2))!;
  const cornerX = ["-35%", "0%", "35%"][shot?.corner ?? 1];
  const keeperX = shot?.result === "goal" ? ["35%", "-35%", "35%"][shot.corner] : shot?.result === "saved" ? cornerX : "0%";
  return (
    <section className="mx-auto max-w-xl space-y-3">
      <div className="flex items-center justify-center gap-1.5" aria-label="Kicks so far">
        {Array.from({ length: KICKS }, (_, n) => (
          <span key={n} className={`flex h-7 w-7 items-center justify-center rounded-full text-sm ${n < goals.length ? (goals[n] ? "bg-green-600 text-white" : "bg-red-500 text-white") : "bg-surface-2"}`}>
            {n < goals.length ? (goals[n] ? "⚽" : "✕") : ""}
          </span>
        ))}
      </div>

      {/* The pitch */}
      <div className="relative h-56 overflow-hidden rounded-2xl bg-gradient-to-b from-green-500 to-green-700 sm:h-64">
        <div
          className="absolute left-1/2 top-4 h-28 w-4/5 -translate-x-1/2 rounded-t-md border-4 border-b-0 border-white"
          style={{ backgroundImage: "repeating-linear-gradient(45deg, rgba(255,255,255,.25) 0 2px, transparent 2px 12px), repeating-linear-gradient(-45deg, rgba(255,255,255,.25) 0 2px, transparent 2px 12px)" }}
        />
        <div className="absolute left-1/2 top-12 text-5xl transition-transform duration-500" style={{ transform: `translateX(calc(-50% + ${keeperX}))` }} aria-hidden>
          🧤
        </div>
        <div
          className="absolute left-1/2 text-4xl transition-all duration-500 ease-out"
          style={{
            bottom: shot ? (shot.result === "goal" ? "62%" : "52%") : "8%",
            transform: `translateX(calc(-50% + ${shot ? cornerX : "0%"})) scale(${shot ? 0.7 : 1})`,
          }}
          aria-hidden
        >
          ⚽
        </div>
        {shot ? (
          <div className="absolute inset-x-0 bottom-3 text-center text-3xl font-black text-white drop-shadow-lg">
            {shot.result === "goal" ? "GOAL! 🎉" : "Saved! 🧤"}
          </div>
        ) : null}
      </div>

      {/* The question */}
      <div className="card text-center">
        {kick?.second ? <p className="text-sm font-medium text-amber-700">Second chance!</p> : null}
        <p className="text-5xl font-black tabular-nums tracking-tight">
          {a} × {b} = <span className={typed ? "" : "text-muted"}>{shot?.result === "saved" ? a * b : typed || "?"}</span>
        </p>
        {shot?.result === "saved" ? <p className="mt-1 text-lg text-red-600">The answer is {a * b}. You&apos;ll get it next time!</p> : null}
      </div>

      {/* Number pad, big for small fingers */}
      <div className="grid grid-cols-3 gap-2">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9", "⌫", "0", "⚽"].map((k) => (
          <button
            key={k}
            type="button"
            disabled={!!shot || (k === "⚽" && !typed)}
            onClick={() => {
              if (k === "⌫") setTyped((t) => t.slice(0, -1));
              else if (k === "⚽") shoot();
              else setTyped((t) => (t.length < 3 ? t + k : t));
            }}
            className={`h-16 rounded-2xl text-3xl font-bold shadow-sm transition active:scale-95 disabled:opacity-40 ${
              k === "⚽" ? "bg-green-600 text-white" : "border border-line bg-surface"
            }`}
            aria-label={k === "⚽" ? "Kick" : k === "⌫" ? "Delete" : k}
          >
            {k === "⚽" ? "⚽ Kick" : k}
          </button>
        ))}
      </div>
    </section>
  );
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
