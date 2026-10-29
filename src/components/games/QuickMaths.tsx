"use client";
import { useEffect, useRef, useState } from "react";
import { useBest } from "./useBest";

const LEVELS = {
  easy: "Easy · add and take away to 20",
  medium: "Medium · to 100, and times tables",
  hard: "Hard · bigger numbers and dividing",
} as const;
type Level = keyof typeof LEVELS;
type Q = { text: string; answer: number };
const COUNT = 10;
const r = (lo: number, hi: number) => lo + Math.floor(Math.random() * (hi - lo + 1));

function makeQ(level: Level): Q {
  if (level === "easy") {
    const a = r(1, 10);
    const b = r(1, 10);
    return Math.random() < 0.5 ? { text: `${a} + ${b}`, answer: a + b } : { text: `${a + b} − ${b}`, answer: a };
  }
  if (level === "medium") {
    const k = r(0, 2);
    if (k === 0) {
      const a = r(10, 60);
      const b = r(5, 39);
      return { text: `${a} + ${b}`, answer: a + b };
    }
    if (k === 1) {
      const a = r(30, 99);
      const b = r(5, a - 1);
      return { text: `${a} − ${b}`, answer: a - b };
    }
    const a = r(2, 10);
    const b = r(2, 10);
    return { text: `${a} × ${b}`, answer: a * b };
  }
  const k = r(0, 3);
  if (k === 0) {
    const a = r(100, 600);
    const b = r(50, 399);
    return { text: `${a} + ${b}`, answer: a + b };
  }
  if (k === 1) {
    const a = r(200, 999);
    const b = r(50, a - 1);
    return { text: `${a} − ${b}`, answer: a - b };
  }
  if (k === 2) {
    const a = r(3, 12);
    const b = r(11, 25);
    return { text: `${a} × ${b}`, answer: a * b };
  }
  const b = r(2, 12);
  const ans = r(2, 12);
  return { text: `${b * ans} ÷ ${b}`, answer: ans };
}

export function QuickMaths() {
  const [level, setLevel] = useState<Level>("easy");
  const [phase, setPhase] = useState<"setup" | "play" | "done">("setup");
  const [q, setQ] = useState<Q>({ text: "", answer: 0 });
  const [n, setN] = useState(0);
  const [answer, setAnswer] = useState("");
  const [startedAt, setStartedAt] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [wrong, setWrong] = useState(false);
  const [newBest, setNewBest] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  // Best = fastest time (lower is better), in tenths of a second.
  const { best, offer } = useBest(`qm-${level}`, (a, b) => a < b);

  useEffect(() => {
    if (phase !== "play") return;
    const id = setInterval(() => setElapsed(Date.now() - startedAt), 100);
    return () => clearInterval(id);
  }, [phase, startedAt]);

  function start() {
    setN(0);
    setAnswer("");
    setQ(makeQ(level));
    setStartedAt(Date.now());
    setElapsed(0);
    setPhase("play");
    setNewBest(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function submit() {
    if (!answer) return;
    if (Number(answer) === q.answer) {
      const next = n + 1;
      setN(next);
      setWrong(false);
      if (next >= COUNT) {
        const time = Math.round((Date.now() - startedAt) / 100);
        setElapsed(time * 100);
        setPhase("done");
        setNewBest(offer(time));
      } else {
        setQ(makeQ(level));
      }
    } else {
      setWrong(true);
    }
    setAnswer("");
    inputRef.current?.focus();
  }

  const secs = (tenths: number) => `${(tenths / 10).toFixed(1)}s`;

  if (phase === "setup") {
    return (
      <div className="space-y-4">
        <p className="text-muted">Answer {COUNT} questions as fast as you can. Wrong answers just try again.</p>
        <div className="grid gap-2">
          {(Object.keys(LEVELS) as Level[]).map((l) => (
            <button
              key={l}
              type="button"
              aria-pressed={level === l}
              onClick={() => setLevel(l)}
              className={`min-h-12 rounded-xl border px-4 text-left ${level === l ? "border-accent bg-accent-soft font-medium text-accent" : "border-line bg-surface"}`}
            >
              {LEVELS[l]}
            </button>
          ))}
        </div>
        {best != null ? <p className="text-sm text-muted">Your fastest: {secs(best)}</p> : null}
        <button type="button" className="btn-primary w-full" onClick={start}>
          Start
        </button>
      </div>
    );
  }

  if (phase === "done") {
    return (
      <div className="space-y-4 text-center">
        <p className="text-sm text-muted">All {COUNT} done!</p>
        <p className="text-5xl font-semibold tabular-nums">{secs(Math.round(elapsed / 100))}</p>
        <p className={newBest ? "font-medium text-ok" : "text-muted"}>{newBest ? "New fastest time!" : `Your fastest: ${best != null ? secs(best) : "—"}`}</p>
        <div className="flex gap-2">
          <button type="button" className="btn-secondary flex-1" onClick={() => setPhase("setup")}>
            Change level
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
        <span>
          Question <strong className="text-ink tabular-nums">{n + 1}</strong> of {COUNT}
        </span>
        <span className="tabular-nums">{secs(Math.round(elapsed / 100))}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
        <div className="h-full bg-accent transition-all" style={{ width: `${(n / COUNT) * 100}%` }} />
      </div>
      <p className="py-4 text-center text-5xl font-semibold tabular-nums sm:text-6xl">{q.text}</p>
      {wrong ? <p className="-mt-3 text-center text-sm text-danger">Not quite — try again</p> : null}
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
          onChange={(e) => setAnswer(e.target.value.replace(/\D/g, "").slice(0, 5))}
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
