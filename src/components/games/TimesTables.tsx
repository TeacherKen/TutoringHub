"use client";
import { useEffect, useRef, useState } from "react";
import { NumberPad } from "./NumberPad";
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
  const key = `tt-${[...tables].sort((x, y) => x - y).join("-")}`;
  const { best, offer } = useBest(key, (a, b) => a > b);

  const scoreRef = useRef(0);

  // The clock: set up once when a round starts (not again on every draw), and it ends at a fixed time.
  const offerRef = useRef(offer);
  useEffect(() => {
    offerRef.current = offer;
  });
  useEffect(() => {
    if (phase !== "play") return;
    const endsAt = Date.now() + SECONDS * 1000;
    const tick = setInterval(() => {
      const leftNow = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
      setLeft(leftNow);
      if (leftNow === 0) {
        clearInterval(tick);
        setPhase("done");
        setNewBest(offerRef.current(scoreRef.current));
      }
    }, 250);
    return () => clearInterval(tick);
  }, [phase]);

  function start() {
    scoreRef.current = 0;
    setScore(0);
    setMissed([]);
    setLeft(SECONDS);
    setAnswer("");
    setQ(makeQ(tables));
    setPhase("play");
    setNewBest(false);
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
            <p className="mt-1 flex flex-wrap gap-x-5 gap-y-1 text-lg tabular-nums">
              {missed.map((m) => (
                <span key={`${m.a}x${m.b}`}>{`${m.a} × ${m.b} = ${m.a * m.b}`}</span>
              ))}
            </p>
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
      <NumberPad value={answer} onChange={setAnswer} onSubmit={submit} max={3} wrong={shake} />
    </div>
  );
}
