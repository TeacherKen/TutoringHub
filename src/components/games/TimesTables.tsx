"use client";
import { useEffect, useRef, useState } from "react";
import { useBest } from "./useBest";

const ALL = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const SECONDS = 60;

type Q = { a: number; b: number };
function makeQ(tables: number[], prev?: Q): Q {
  for (let i = 0; i < 10; i++) {
    const a = tables[Math.floor(Math.random() * tables.length)];
    const b = 1 + Math.floor(Math.random() * 12);
    const q = Math.random() < 0.5 ? { a, b } : { a: b, b: a };
    if (!prev || prev.a !== q.a || prev.b !== q.b) return q;
  }
  return { a: tables[0], b: 2 };
}

export function TimesTables() {
  const [tables, setTables] = useState<number[]>([2, 3, 4]);
  const [phase, setPhase] = useState<"setup" | "play" | "done">("setup");
  const [q, setQ] = useState<Q>({ a: 2, b: 3 });
  const [answer, setAnswer] = useState("");
  const [score, setScore] = useState(0);
  const [left, setLeft] = useState(SECONDS);
  const [missed, setMissed] = useState<Q[]>([]);
  const [shake, setShake] = useState(false);
  const [newBest, setNewBest] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const key = `tt-${[...tables].sort((x, y) => x - y).join("-")}`;
  const { best, offer } = useBest(key, (a, b) => a > b);

  const scoreRef = useRef(0);

  useEffect(() => {
    if (phase !== "play") return;
    const tick = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    const end = setTimeout(() => {
      setPhase("done");
      setNewBest(offer(scoreRef.current));
    }, SECONDS * 1000);
    return () => {
      clearInterval(tick);
      clearTimeout(end);
    };
  }, [phase, offer]);

  function start() {
    scoreRef.current = 0;
    setScore(0);
    setMissed([]);
    setLeft(SECONDS);
    setAnswer("");
    setQ(makeQ(tables));
    setPhase("play");
    setNewBest(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function submit() {
    if (!answer) return;
    if (Number(answer) === q.a * q.b) {
      scoreRef.current += 1;
      setScore(scoreRef.current);
      setQ((p) => makeQ(tables, p));
    } else {
      setMissed((m) => (m.some((x) => x.a === q.a && x.b === q.b) ? m : [...m, q]));
      setShake(true);
      setTimeout(() => setShake(false), 300);
    }
    setAnswer("");
    inputRef.current?.focus();
  }

  if (phase === "setup") {
    return (
      <div className="space-y-5">
        <p className="text-muted">Pick your times tables, then answer as many as you can in 60 seconds.</p>
        <div className="flex flex-wrap gap-2">
          {ALL.map((t) => {
            const on = tables.includes(t);
            return (
              <button
                key={t}
                type="button"
                aria-pressed={on}
                onClick={() => setTables((cur) => (on ? (cur.length > 1 ? cur.filter((x) => x !== t) : cur) : [...cur, t]))}
                className={`h-12 w-14 rounded-xl border text-lg font-semibold ${on ? "border-accent bg-accent-soft text-accent" : "border-line bg-surface"}`}
              >
                ×{t}
              </button>
            );
          })}
        </div>
        {best != null ? <p className="text-sm text-muted">Your best with these tables: {best}</p> : null}
        <button type="button" className="btn-primary w-full" onClick={start}>
          Start
        </button>
      </div>
    );
  }

  if (phase === "done") {
    return (
      <div className="space-y-4 text-center">
        <p className="text-sm text-muted">Time&apos;s up!</p>
        <p className="text-5xl font-semibold tabular-nums">{score}</p>
        <p className={newBest ? "font-medium text-ok" : "text-muted"}>{newBest ? "New personal best!" : `Your best: ${best ?? score}`}</p>
        {missed.length ? (
          <div className="rounded-xl bg-surface-2 p-3 text-left">
            <p className="text-sm font-medium">Practise these:</p>
            <p className="mt-1 text-lg tabular-nums">{missed.map((m) => `${m.a} × ${m.b} = ${m.a * m.b}`).join("   ·   ")}</p>
          </div>
        ) : null}
        <div className="flex gap-2">
          <button type="button" className="btn-secondary flex-1" onClick={() => setPhase("setup")}>
            Change tables
          </button>
          <button type="button" className="btn-primary flex-1" onClick={start}>
            Play again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between text-sm text-muted">
        <span>Score: <strong className="text-ink tabular-nums">{score}</strong></span>
        <span className="tabular-nums">{left}s</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
        <div className="h-full bg-accent transition-all" style={{ width: `${(left / SECONDS) * 100}%` }} />
      </div>
      <p className={`py-4 text-center text-6xl font-semibold tabular-nums ${shake ? "animate-pulse text-danger" : ""}`}>
        {q.a} × {q.b}
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="flex gap-2"
      >
        <input
          ref={inputRef}
          value={answer}
          onChange={(e) => setAnswer(e.target.value.replace(/\D/g, "").slice(0, 3))}
          inputMode="numeric"
          autoComplete="off"
          aria-label="Your answer"
          className="input text-center text-3xl font-semibold tabular-nums"
        />
        <button className="btn-primary px-6">OK</button>
      </form>
    </div>
  );
}
