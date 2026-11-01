"use client";
import { useEffect, useRef, useState } from "react";
import { compareFrac, FACE_LEVELS, faceQ, fracText, type FaceLevel, type FaceQ, type Frac } from "@/lib/fractions";
import { Bar, FracText } from "./FractionShapes";
import { useBest } from "./useBest";

// ⚔️ Fraction Face-off: tap the bigger fraction, as many as you can in 60 seconds. A wrong tap shows
// why (the two bars side by side) and costs a moment, so guessing doesn't pay.

const SECONDS = 60;
const OOPS_MS = 1600;
const bar = (f: Frac) => Array.from({ length: f.n }, (_, i) => i);

export function FractionFaceoff() {
  const [level, setLevel] = useState<FaceLevel>("bottom");
  const [phase, setPhase] = useState<"setup" | "play" | "done">("setup");
  const [q, setQ] = useState<FaceQ | null>(null);
  const [score, setScore] = useState(0);
  const [left, setLeft] = useState(SECONDS);
  const [oops, setOops] = useState<string | null>(null);
  const [flash, setFlash] = useState<-1 | 0 | 1 | null>(null);
  const [missed, setMissed] = useState<FaceQ[]>([]);
  const [newBest, setNewBest] = useState(false);
  const { best, offer } = useBest(`ff-${level}`, (a, b) => a > b);
  const scoreRef = useRef(0);
  const hints = level !== "mixed"; // the bars show on the easier levels

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
    setOops(null);
    setFlash(null);
    setQ(faceQ(level));
    setNewBest(false);
    setPhase("play");
  }

  /** 1 = "the left one", -1 = "the right one", 0 = "they're the same". */
  function answer(pick: -1 | 0 | 1) {
    if (!q || oops) return;
    const truth = compareFrac(q.left, q.right);
    if (pick === truth) {
      scoreRef.current += 1;
      setScore(scoreRef.current);
      setFlash(pick);
      setTimeout(() => setFlash(null), 200);
      setQ((p) => faceQ(level, Math.random, p ?? undefined));
      return;
    }
    setMissed((m) => (m.some((x) => fracText(x.left) === fracText(q.left) && fracText(x.right) === fracText(q.right)) ? m : [...m, q]));
    setOops(truth === 0 ? "They're the same amount!" : `${fracText(truth === 1 ? q.left : q.right)} is bigger.`);
    setTimeout(() => {
      setOops(null);
      setQ((p) => faceQ(level, Math.random, p ?? undefined));
    }, OOPS_MS);
  }

  if (phase === "setup") {
    return (
      <div className="space-y-4">
        <p className="text-muted">Tap the bigger fraction. How many can you get in 60 seconds? A wrong tap costs a moment.</p>
        <div className="grid gap-2">
          {(Object.keys(FACE_LEVELS) as FaceLevel[]).map((l) => (
            <button
              key={l}
              type="button"
              aria-pressed={level === l}
              onClick={() => setLevel(l)}
              className={`min-h-12 rounded-xl border px-4 text-left ${level === l ? "border-accent bg-accent-soft font-medium text-accent" : "border-line bg-surface"}`}
            >
              {FACE_LEVELS[l]}
            </button>
          ))}
        </div>
        {best != null ? <p className="text-sm text-muted">Your best on this level: {best}</p> : null}
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
            <p className="text-sm font-medium">Tricky ones:</p>
            <ul className="mt-2 flex flex-wrap gap-x-6 gap-y-3">
              {missed.map((m) => {
                const c = compareFrac(m.left, m.right);
                return (
                  <li key={`${fracText(m.left)}|${fracText(m.right)}`} className="flex items-center gap-2 text-xl">
                    <FracText f={m.left} className="text-xl" />
                    <span className="font-semibold">{c === 1 ? ">" : c === -1 ? "<" : "="}</span>
                    <FracText f={m.right} className="text-xl" />
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
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

  if (!q) return null;
  const card = (f: Frac, side: -1 | 1) => {
    const truth = compareFrac(q.left, q.right);
    const winner = oops && truth === side;
    return (
      <button
        type="button"
        onClick={() => answer(side)}
        disabled={!!oops}
        aria-label={`${fracText(f)} is bigger`}
        className={`flex min-h-40 flex-1 flex-col items-center justify-center gap-4 rounded-3xl border-2 p-4 transition active:scale-95 ${
          flash === side ? "border-ok bg-ok-soft" : winner ? "border-ok" : "border-line bg-surface-2 hover:border-accent"
        }`}
      >
        <FracText f={f} className="text-6xl" />
        {hints || oops ? <Bar parts={f.d} shaded={bar(f)} plain label={`Bar showing ${fracText(f)}`} /> : null}
      </button>
    );
  };
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm text-muted">
        <span>
          Score: <strong className="text-ink tabular-nums">{score}</strong>
        </span>
        <span className="tabular-nums">{left}s</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
        <div className="h-full bg-accent transition-all" style={{ width: `${(left / SECONDS) * 100}%` }} />
      </div>
      <h3 className="text-center text-xl font-semibold">Tap the bigger one</h3>
      <div className="flex items-stretch gap-3">
        {card(q.left, 1)}
        {card(q.right, -1)}
      </div>
      {level === "mixed" ? (
        <button
          type="button"
          onClick={() => answer(0)}
          disabled={!!oops}
          className={`min-h-14 w-full rounded-2xl border-2 text-lg font-semibold transition active:scale-95 ${flash === 0 ? "border-ok bg-ok-soft" : "border-line bg-surface-2 hover:border-accent"}`}
        >
          = They&apos;re the same
        </button>
      ) : null}
      <p aria-live="polite" className="min-h-7 text-center font-medium text-danger">
        {oops ? `Oops! ${oops}` : ""}
      </p>
    </div>
  );
}
