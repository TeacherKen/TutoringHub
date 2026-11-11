"use client";
import { useEffect, useRef, useState } from "react";
import { NumberPad } from "./NumberPad";
import { useBest } from "./useBest";
import { BigButton, Board, GameHero, ResultCard, THEMES } from "./GameKit";

const T = THEMES.race;
const RC = "/games/art/race"; // Kenney Racing Pack (CC0)

/**
 * The race: your red car moves one step for each right answer. The blue "pace car" drives
 * steadily and reaches the flag when time runs out, at your best score (or 20) — beat it!
 */
function RaceTrack({ score, goal, left, ready }: { score: number; goal: number; left: number; ready: number | null }) {
  const you = Math.min(1, score / goal);
  const pace = Math.min(1, (SECONDS - left) / SECONDS);
  const x = (p: number) => `calc(${p} * (100% - 7.5rem) + 0.5rem)`;
  return (
    <div className="relative overflow-hidden rounded-3xl bg-[linear-gradient(#5cb85c,#3f9a45)] shadow-[0_8px_24px_rgba(0,0,0,.3)] ring-4 ring-black/15">
      <div className="flex justify-around px-2 pt-2" aria-hidden>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`${RC}/tribune.png`} alt="" className="h-12 w-auto sm:h-16" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`${RC}/tribune.png`} alt="" className="hidden h-12 w-auto sm:block sm:h-16" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`${RC}/tribune.png`} alt="" className="h-12 w-auto sm:h-16" />
      </div>
      <div className="relative mt-2 h-28 bg-repeat-x" style={{ backgroundImage: `url(${RC}/track.png)`, backgroundSize: "auto 100%" }} aria-hidden>
        {/* finish flag */}
        <span className="absolute inset-y-2 right-14 w-4 bg-[conic-gradient(#fff_25%,#111_0_50%,#fff_0_75%,#111_0)] bg-[length:8px_8px] opacity-90" />
        {/* pace car (top lane) and your car (bottom lane) */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`${RC}/car_blue.png`} alt="" className="absolute top-3 h-9 w-auto opacity-90 transition-[left] duration-300 ease-linear" style={{ left: x(pace) }} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`${RC}/car_red.png`} alt="" className="absolute bottom-3 h-11 w-auto transition-[left] duration-300 ease-out" style={{ left: x(you) }} />
        {ready != null ? (
          <div className="absolute inset-0 grid place-items-center bg-black/35">
            <span className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`${RC}/lights.png`} alt="" className="h-10 w-auto" />
              <span key={ready} className="pz-anim animate-[tt-pop_.3s_ease-out] font-sport text-6xl font-extrabold italic text-white [text-shadow:0_3px_0_rgba(0,0,0,.5)]">
                {ready > 0 ? ready : "GO!"}
              </span>
            </span>
          </div>
        ) : null}
      </div>
      <div className="flex items-center justify-between px-3 py-1.5 text-xs font-bold text-white/90">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#ff4d3d]" /> You: {score}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#3e8ef7]" /> Pace car: {goal} by the end
        </span>
      </div>
    </div>
  );
}

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
  const [phase, setPhase] = useState<"setup" | "ready" | "play" | "done">("setup");
  const [ready, setReady] = useState<number | null>(null);
  const [q, setQ] = useState<Q>({ a: 2, b: 3 });
  const [answer, setAnswer] = useState("");
  const [score, setScore] = useState(0);
  const [left, setLeft] = useState(SECONDS);
  const [missed, setMissed] = useState<Q[]>([]);
  const [shake, setShake] = useState(false);
  const [newBest, setNewBest] = useState(false);
  const key = `tt-${[...tables].sort((x, y) => x - y).join("-")}`;
  const { best, offer } = useBest(key, (a, b) => a > b, "pts");

  const scoreRef = useRef(0);
  const lightsRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => () => {
    if (lightsRef.current) clearInterval(lightsRef.current);
  }, []);

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
    setNewBest(false);
    // Race lights: 3, 2, 1, GO!
    setPhase("ready");
    setReady(3);
    let c = 3;
    if (lightsRef.current) clearInterval(lightsRef.current);
    const id = setInterval(() => {
      c -= 1;
      setReady(c);
      if (c < 0) {
        clearInterval(id);
        setReady(null);
        setPhase("play");
      }
    }, 650);
    lightsRef.current = id;
  }

  function submit() {
    if (!answer || phase !== "play") return;
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
        <GameHero theme={T} art={null} title="TIMES TABLES SPRINT">
          Pick your times tables, then answer as many as you can in 60 seconds!
        </GameHero>
        <p className="text-sm font-semibold">Which tables?</p>
        <div className="flex flex-wrap gap-2">
          {ALL.map((t) => {
            const on = tables.includes(t);
            return (
              <button
                key={t}
                type="button"
                aria-pressed={on}
                onClick={() => setTables((cur) => (on ? (cur.length > 1 ? cur.filter((x) => x !== t) : cur) : [...cur, t]))}
                className={`h-14 w-16 rounded-2xl border-2 text-xl font-bold transition ${on ? "-translate-y-0.5 border-transparent text-white shadow-[0_4px_0_#0f1e4d]" : "border-line bg-surface"}`}
                style={on ? { background: `linear-gradient(${T.from}, ${T.to})` } : undefined}
              >
                ×{t}
              </button>
            );
          })}
        </div>
        {best != null ? <p className="text-center text-sm text-muted">Your best with these tables: {best}</p> : null}
        <BigButton theme={T} onClick={start}>
          ▶ Start
        </BigButton>
      </div>
    );
  }

  if (phase === "done") {
    return (
      <ResultCard theme={T} art={null} label="Time's up! You scored" big={score} newBest={newBest} bestText={`Your best: ${best ?? score}`} onAgain={start} onChange={() => setPhase("setup")} changeLabel="Change tables">
        {missed.length ? (
          <div className="rounded-2xl border-2 border-dashed border-line bg-surface-2 p-3 text-left">
            <p className="text-sm font-semibold">Practise these:</p>
            <p className="mt-1 flex flex-wrap gap-x-5 gap-y-1 text-lg tabular-nums">
              {missed.map((m) => (
                <span key={`${m.a}x${m.b}`}>{`${m.a} × ${m.b} = ${m.a * m.b}`}</span>
              ))}
            </p>
          </div>
        ) : null}
      </ResultCard>
    );
  }

  return (
    <div className="space-y-5">
      <Board theme={T}>
        <div className="flex items-center justify-between">
          <span className="rounded-xl bg-black/30 px-3 py-1.5 text-center">
            <span className="block text-[10px] font-bold tracking-[0.2em] opacity-70">SCORE</span>
            <span className="font-sport text-3xl font-bold tabular-nums text-[#ffc629]">{score}</span>
          </span>
          <svg viewBox="0 0 44 44" className="h-16 w-16 -rotate-90" aria-label={`${left} seconds left`}>
            <circle cx="22" cy="22" r="18" fill="rgba(0,0,0,.3)" stroke="rgba(255,255,255,.15)" strokeWidth="5" />
            <circle cx="22" cy="22" r="18" fill="none" stroke={left <= 10 ? "#ff6b5e" : "#ffc629"} strokeWidth="5" strokeLinecap="round" strokeDasharray={113} strokeDashoffset={113 * (1 - left / SECONDS)} className="transition-all duration-300" />
            <text x="22" y="22" textAnchor="middle" dominantBaseline="central" fontSize="13" fontWeight="800" fill="#fff" transform="rotate(90 22 22)">
              {left}
            </text>
          </svg>
        </div>
        <p key={`${q.a}x${q.b}`} className={`pz-anim py-3 text-center font-sport text-7xl font-bold tabular-nums ${shake ? "animate-[pz-shake_.3s] text-[#ff8a7a]" : "animate-[tt-pop_.25s_ease-out]"}`}>
          {phase === "ready" ? "Ready…" : `${q.a} × ${q.b}`}
        </p>
      </Board>
      <RaceTrack score={score} goal={Math.max(10, best ?? 20)} left={left} ready={ready} />
      <NumberPad value={answer} onChange={setAnswer} onSubmit={submit} max={3} wrong={shake} />
    </div>
  );
}
