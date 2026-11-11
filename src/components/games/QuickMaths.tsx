"use client";
import { useEffect, useState } from "react";
import { NumberPad } from "./NumberPad";
import { useBest } from "./useBest";
import { BigButton, GameHero, LevelPicker, ResultCard, THEMES } from "./GameKit";

const T = THEMES.space;
const SP = "/games/art/space"; // Kenney Alien UFO Pack, Space Shooter, Planets (CC0)

/**
 * The space race: your UFO flies towards the planet, one hop for each right answer.
 * The question glows in the middle; a laser burst flashes when you get one right.
 */
function SpaceRace({ n, max, text, wrong }: { n: number; max: number; text: string; wrong: boolean }) {
  const pct = Math.min(1, n / max);
  return (
    <div className="relative h-72 overflow-hidden rounded-3xl shadow-[0_8px_24px_rgba(0,0,0,.35)] ring-4 ring-black/20 sm:h-80" style={{ backgroundImage: `url(${SP}/bg.png)`, backgroundSize: "256px" }}>
      {[
        [8, 12, 14, 0],
        [30, 70, 10, 0.6],
        [55, 18, 16, 1.2],
        [78, 60, 12, 0.3],
        [15, 52, 9, 0.9],
        [66, 8, 11, 1.5],
      ].map(([x, y, sz, d], i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={i} src={`${SP}/star.png`} alt="" aria-hidden className="pz-anim absolute" style={{ left: `${x}%`, top: `${y}%`, width: sz, animation: `qm-twinkle 1.8s ease-in-out ${d}s infinite` }} />
      ))}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`${SP}/planet.png`} alt="" aria-hidden className="absolute -right-10 bottom-2 h-40 w-40 opacity-95 sm:h-48 sm:w-48" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`${SP}/ufo_pink.png`} alt="" aria-hidden className="pz-anim absolute left-4 top-4 h-8" style={{ animation: "pz-float 3s ease-in-out infinite" }} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`${SP}/ufo_yellow.png`} alt="" aria-hidden className="pz-anim absolute right-6 top-6 h-6" style={{ animation: "pz-float 2.4s ease-in-out .5s infinite" }} />

      <p key={text + n} className={`pz-anim relative pt-12 text-center font-sport text-6xl font-bold tabular-nums text-white [text-shadow:0_0_18px_rgba(126,224,195,.65),0_3px_0_rgba(0,0,0,.4)] sm:text-7xl ${wrong ? "animate-[pz-shake_.35s]" : "animate-[tt-pop_.3s_ease-out]"}`}>
        {text} = ?
      </p>
      {wrong ? <p className="relative mt-1 text-center text-sm font-semibold text-[#ffb4a8]">Not quite. Try again!</p> : null}

      {/* the flight path to the planet, with a dot for each question */}
      <div className="absolute inset-x-6 bottom-10 flex items-center justify-between pr-24 sm:pr-32" aria-hidden>
        {Array.from({ length: max }, (_, i) => (
          <span key={i} className={`h-2 w-2 rounded-full ${i < n ? "bg-[#7ee0c3] shadow-[0_0_8px_#7ee0c3]" : "bg-white/25"}`} />
        ))}
      </div>
      <div className="absolute bottom-3 transition-[left] duration-500 ease-out" style={{ left: `calc(${4 + pct * 62}% )` }} aria-hidden>
        {n > 0 ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={`b${n}`} src={`${SP}/burst.png`} alt="" className="pz-anim absolute -left-8 -top-2 h-12 opacity-0" style={{ animation: "qm-burst .6s ease-out" }} />
        ) : null}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`${SP}/ufo.png`} alt="" className="pz-anim h-16 drop-shadow-[0_0_10px_rgba(126,224,195,.6)] sm:h-20" style={{ animation: "pz-float 2s ease-in-out infinite" }} />
      </div>
      <span className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-black/35 px-3 py-0.5 text-xs font-bold tracking-wider text-white/85">
        {max - n} TO THE PLANET
      </span>
    </div>
  );
}

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
        <GameHero theme={T} art={null} title="QUICK MATHS">
          Answer {COUNT} questions as fast as you can. A wrong answer? Just try again.
        </GameHero>
        <LevelPicker theme={T} levels={Object.entries(LEVELS) as [Level, string][]} value={level} onChange={setLevel} />
        {best != null ? <p className="text-center text-sm text-muted">Your fastest: {secs(best)}</p> : null}
        <BigButton theme={T} onClick={start}>
          ▶ Start
        </BigButton>
      </div>
    );
  }

  if (phase === "done") {
    return (
      <ResultCard theme={T} art={null} label={`All ${COUNT} done in`} big={secs(Math.round(elapsed / 100))} newBest={newBest} bestText={`Your fastest: ${best != null ? secs(best) : "—"}`} onAgain={start} onChange={() => setPhase("setup")} />
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
      <SpaceRace n={n} max={COUNT} text={q.text} wrong={wrong} />
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
