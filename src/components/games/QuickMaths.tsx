"use client";
import { useEffect, useState } from "react";
import { NumberPad } from "./NumberPad";
import { useBest } from "./useBest";
import { BigButton, Board, GameHero, LevelPicker, ResultCard, Runner, THEMES } from "./GameKit";

const T = THEMES.chalk;

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
  // Best = fastest time (lower is better), in tenths of a second.
  const { best, offer } = useBest(`qm-${level}`, (a, b) => a < b, "ds");

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
  }

  const secs = (tenths: number) => `${(tenths / 10).toFixed(1)}s`;

  if (phase === "setup") {
    return (
      <div className="space-y-4">
        <GameHero theme={T} art="🧮" title="QUICK MATHS">
          Answer {COUNT} questions as fast as you can. A wrong answer? Just try again.
        </GameHero>
        <LevelPicker theme={T} levels={Object.entries(LEVELS) as [Level, string][]} value={level} onChange={setLevel} />
        {best != null ? <p className="text-center text-sm text-muted">⏱️ Your fastest: {secs(best)}</p> : null}
        <BigButton theme={T} onClick={start}>
          ▶ Start
        </BigButton>
      </div>
    );
  }

  if (phase === "done") {
    return (
      <ResultCard theme={T} art="🧮" label={`All ${COUNT} done in`} big={secs(Math.round(elapsed / 100))} newBest={newBest} bestText={`Your fastest: ${best != null ? secs(best) : "—"}`} onAgain={start} onChange={() => setPhase("setup")} />
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
      <Runner theme={T} value={n} max={COUNT} />
      <Board theme={T}>
        <p key={q.text + n} className={`pz-anim py-3 text-center font-[cursive,ui-rounded] text-5xl font-bold tabular-nums [text-shadow:0_0_1px_rgba(255,255,255,.6)] sm:text-6xl ${wrong ? "animate-[pz-shake_.35s]" : "animate-[tt-pop_.3s_ease-out]"}`}>
          {q.text} = ?
        </p>
        {wrong ? <p className="text-center text-sm font-semibold text-[#ffb4a8]">Not quite. Try again!</p> : null}
        <span className="absolute bottom-1.5 right-3 h-1.5 w-8 rounded-full bg-white/70" aria-hidden />
      </Board>
      <NumberPad
        value={answer}
        onChange={(v) => {
          setAnswer(v);
          setWrong(false);
        }}
        onSubmit={submit}
        max={5}
        wrong={wrong}
      />
    </div>
  );
}
