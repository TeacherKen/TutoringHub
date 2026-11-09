"use client";
import { useEffect, useRef, useState } from "react";
import { compareFrac, FACE_LEVELS, faceQ, fracText, type FaceLevel, type FaceQ, type Frac } from "@/lib/fractions";
import { Bar, FracText } from "./FractionShapes";
import { useBest } from "./useBest";
import { BigButton, GameHero, LevelPicker, ResultCard, THEMES } from "./GameKit";

const T = THEMES.berry;

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
        <GameHero theme={T} art="⚔️" title="FRACTION FACE-OFF">
          Tap the bigger fraction. How many can you get in 60 seconds? A wrong tap costs a moment.
        </GameHero>
        <LevelPicker theme={T} levels={Object.entries(FACE_LEVELS) as [FaceLevel, string][]} value={level} onChange={setLevel} />
        {best != null ? <p className="text-center text-sm text-muted">🏅 Your best on this level: {best}</p> : null}
        <BigButton theme={T} onClick={start}>
          ▶ Start
        </BigButton>
      </div>
    );
  }

  if (phase === "done") {
    return (
      <ResultCard theme={T} art="⚔️" label="Time's up! You scored" big={score} newBest={newBest} bestText={`Your best: ${best ?? score}`} onAgain={start} onChange={() => setPhase("setup")}>
        {missed.length ? (
          <div className="rounded-2xl border-2 border-dashed border-line bg-surface-2 p-3 text-left">
            <p className="text-sm font-semibold">📝 Tricky ones:</p>
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
      </ResultCard>
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
        className={`flex min-h-44 flex-1 flex-col items-center justify-center gap-4 rounded-3xl border-4 bg-white p-4 text-[#2b1030] shadow-[0_6px_0_rgba(0,0,0,.25)] transition hover:-translate-y-1 active:translate-y-1 active:shadow-none ${
          flash === side ? "border-[#30a46c] bg-[#e7f9ee]" : winner ? "border-[#30a46c]" : "border-white"
        }`}
      >
        <FracText f={f} className="text-6xl" />
        {hints || oops ? <Bar parts={f.d} shaded={bar(f)} plain label={`Bar showing ${fracText(f)}`} /> : null}
      </button>
    );
  };
  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-3xl p-4 shadow-[0_8px_24px_rgba(0,0,0,.2)]" style={{ background: `radial-gradient(120% 100% at 50% 0%, ${T.from}, ${T.to})`, color: T.ink }}>
        <div className="flex items-center justify-between">
          <span className="rounded-xl bg-black/30 px-3 py-1 font-bold">
            ⭐ <span className="tabular-nums">{score}</span>
          </span>
          <span className="text-sm font-bold uppercase tracking-[0.2em]">Tap the bigger one</span>
          <span className={`rounded-xl px-3 py-1 font-bold tabular-nums ${left <= 10 ? "bg-[#ff6b5e]" : "bg-black/30"}`}>⏱ {left}s</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-black/30">
          <div className="h-full rounded-full transition-all" style={{ width: `${(left / SECONDS) * 100}%`, background: T.accent }} />
        </div>
        <div className="relative flex items-stretch gap-3">
          {card(q.left, 1)}
          <span className="absolute left-1/2 top-1/2 z-10 grid h-12 w-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-[#ffd166] font-sport text-xl font-bold text-[#4c1036] shadow-lg ring-4 ring-white" aria-hidden>
            VS
          </span>
          {card(q.right, -1)}
        </div>
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
