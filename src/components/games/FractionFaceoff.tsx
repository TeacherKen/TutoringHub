"use client";
import { useEffect, useRef, useState } from "react";
import { compareFrac, FACE_LEVELS, faceQ, fracText, type FaceLevel, type FaceQ, type Frac } from "@/lib/fractions";
import { Bar, FracText } from "./FractionShapes";
import { useBest } from "./useBest";
import { BigButton, GameHero, LevelPicker, ResultCard, THEMES } from "./GameKit";

const T = THEMES.robot;
const RB = "/games/art/robots"; // Kenney Robot Pack (CC0)

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
  // A fight: which robot attacks (1 left, -1 right, 0 both: a draw), and a count so each one replays.
  const [fight, setFight] = useState<{ by: -1 | 0 | 1; n: number } | null>(null);
  const fightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (fightTimer.current) clearTimeout(fightTimer.current);
  }, []);
  function attack(by: -1 | 0 | 1, ms = 700) {
    setFight((f) => ({ by, n: (f?.n ?? 0) + 1 }));
    if (fightTimer.current) clearTimeout(fightTimer.current);
    fightTimer.current = setTimeout(() => setFight(null), ms);
  }
  const [missed, setMissed] = useState<FaceQ[]>([]);
  const [newBest, setNewBest] = useState(false);
  const { best, offer } = useBest(`ff-${level}`, (a, b) => a > b, "pts");
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
      attack(pick);
      setQ((p) => faceQ(level, Math.random, p ?? undefined));
      return;
    }
    setMissed((m) => (m.some((x) => fracText(x.left) === fracText(q.left) && fracText(x.right) === fracText(q.right)) ? m : [...m, q]));
    attack(truth, 900);
    setOops(truth === 0 ? "They're the same amount!" : `${fracText(truth === 1 ? q.left : q.right)} is bigger.`);
    setTimeout(() => {
      setOops(null);
      setQ((p) => faceQ(level, Math.random, p ?? undefined));
    }, OOPS_MS);
  }

  if (phase === "setup") {
    return (
      <div className="space-y-4">
        <GameHero theme={T} art="🤖" title="FRACTION FACE-OFF">
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
      <ResultCard theme={T} art="🤖" label="Time's up! You scored" big={score} newBest={newBest} bestText={`Your best: ${best ?? score}`} onAgain={start} onChange={() => setPhase("setup")}>
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
  const truth = compareFrac(q.left, q.right);
  /** A robot holding up its fraction screen. Tap the screen of the robot with the bigger fraction. */
  const bot = (f: Frac, side: -1 | 1) => {
    const colour = side === 1 ? "red" : "blue";
    const charging = fight != null && (fight.by === side || fight.by === 0);
    const knocked = fight != null && fight.by !== 0 && fight.by !== side;
    const won = charging || flash === side;
    const lost = knocked;
    const pose = charging ? "jump" : knocked ? (oops ? "damage1" : "hurt") : "drive1";
    return (
      <button
        type="button"
        onClick={() => answer(side)}
        disabled={!!oops}
        aria-label={`${fracText(f)} is bigger`}
        className="group flex flex-1 flex-col items-center gap-1 transition active:scale-[.98]"
      >
        <span
          className={`flex min-h-36 w-full flex-col items-center justify-center gap-3 rounded-2xl border-[6px] bg-[#f4fbff] p-3 text-[#16233a] shadow-[0_6px_0_rgba(0,0,0,.3),inset_0_0_0_2px_rgba(0,0,0,.08)] transition group-hover:-translate-y-1 ${
            won ? "border-[#30a46c] bg-[#e7f9ee]" : side === 1 ? "border-[#d9573b]" : "border-[#3e7fd6]"
          }`}
        >
          <FracText f={f} className="text-5xl sm:text-6xl" />
          {hints || oops ? <Bar parts={f.d} shaded={bar(f)} plain label={`Bar showing ${fracText(f)}`} /> : null}
        </span>
        <span className="h-3 w-2 bg-[#5a6475]" aria-hidden />
        <span className={side === -1 ? "-scale-x-100" : ""}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            key={`${pose}-${fight?.n ?? 0}`}
            src={`${RB}/${colour}_${pose}.png`}
            alt=""
            aria-hidden
            className={`pz-anim block h-24 w-auto drop-shadow-[0_6px_4px_rgba(0,0,0,.35)] sm:h-28 ${charging ? (fight?.by === 0 ? "animate-[ff-bump_.6s_ease-in-out]" : "animate-[ff-charge_.6s_ease-in-out]") : knocked ? "animate-[ff-knock_.7s_ease-out]" : ""}`}
          />
        </span>
      </button>
    );
  };
  return (
    <div className="space-y-4">
      <div
        className="relative space-y-3 overflow-hidden rounded-3xl p-4 shadow-[0_8px_24px_rgba(0,0,0,.25)] ring-4 ring-black/15"
        style={{ backgroundImage: "url(/games/art/bg/empty.png)", backgroundSize: "auto 100%", backgroundPosition: "center bottom", backgroundColor: "#cdeaf7" }}
      >
        <div className="absolute inset-x-0 bottom-0 h-16 bg-[repeating-linear-gradient(90deg,#5a6475_0_24px,#4a5363_24px_48px)]" aria-hidden />
        <div className="relative flex items-center justify-between text-white">
          <span className="rounded-xl bg-[#16233a]/80 px-3 py-1 font-bold">
            Wins <span className="tabular-nums text-[#ffd84d]">{score}</span>
          </span>
          <span className="rounded-xl bg-[#16233a]/80 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] sm:text-sm">Robot battle: tap the bigger one</span>
          <span className={`rounded-xl px-3 py-1 font-bold tabular-nums ${left <= 10 ? "bg-[#ff6b5e]" : "bg-[#16233a]/80"}`}>{left}s</span>
        </div>
        <div className="relative h-2.5 overflow-hidden rounded-full bg-[#16233a]/50">
          <div className="h-full rounded-full transition-all" style={{ width: `${(left / SECONDS) * 100}%`, background: "linear-gradient(90deg,#7ee0c3,#ffd84d)" }} />
        </div>
        <div className="relative flex items-end gap-3 pb-2">
          {bot(q.left, 1)}
          <span className="relative mb-36 grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[#ffd84d] font-sport text-xl font-bold text-[#16233a] shadow-lg ring-4 ring-white sm:mb-40" aria-hidden>
            VS
          </span>
          {fight ? (
            <span key={fight.n} className="pz-anim pointer-events-none absolute bottom-8 left-1/2 z-20 -translate-x-1/2 animate-[ff-pow_.6s_ease-out_both]" aria-hidden>
              <span className="relative grid h-24 w-24 place-items-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/games/art/pirate/splash.png" alt="" className="absolute inset-0 h-full w-full" />
                <span className="relative font-sport text-2xl font-extrabold italic text-white [text-shadow:0_2px_0_#7a2b00,0_0_6px_#7a2b00]">{fight.by === 0 ? "CLANG!" : "POW!"}</span>
              </span>
            </span>
          ) : null}
          {bot(q.right, -1)}
        </div>
      </div>
      {level === "mixed" ? (
        <button type="button" onClick={() => answer(0)} disabled={!!oops} className={`min-h-14 w-full rounded-2xl text-lg font-bold transition active:translate-y-0.5 ${flash === 0 ? "bg-[#30a46c] text-white" : "bg-[#16233a] text-white shadow-[0_4px_0_#0a1220]"}`}>
          = They&apos;re the same (a draw!)
        </button>
      ) : null}
      <p aria-live="polite" className="min-h-7 text-center font-medium text-danger">
        {oops ? `Oops! ${oops}` : ""}
      </p>
    </div>
  );
}
