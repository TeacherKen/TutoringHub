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

/** The robots' weapons (Kenney Space Shooter, Space Shooter Extension, Tank Pack art, CC0). A streak of
 *  right answers unlocks bigger ones: laser → cannon → rocket → energy orb, and every 5th is a MEGA BEAM. */
type Weapon = "laser" | "cannon" | "rocket" | "orb" | "mega";
const WEAPONS: Weapon[] = ["laser", "cannon", "rocket", "orb"];
const weaponFor = (streak: number): Weapon => (streak % 5 === 0 ? "mega" : WEAPONS[(streak - 1) % 4]);
const SHOUT: Record<Weapon, string> = { laser: "LASER!", cannon: "CANNON!", rocket: "ROCKET!", orb: "ENERGY ORB!", mega: "MEGA BEAM!" };

/** One attack flying from one robot to the other, with the hit at the end. `by`: 1 = the left (red) robot. */
function Shot({ by, kind }: { by: -1 | 0 | 1; kind: Weapon }) {
  if (by === 0) {
    return (
      <span className="pz-anim pointer-events-none absolute bottom-8 left-1/2 z-20 -translate-x-1/2 animate-[ff-pow_.6s_ease-out_both]" aria-hidden>
        <span className="relative grid h-24 w-24 place-items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`${RB}/boom.png`} alt="" className="absolute inset-0 h-full w-full" />
          <span className="relative font-sport text-2xl font-extrabold italic text-white [text-shadow:0_2px_0_#7a2b00,0_0_6px_#7a2b00]">CLANG!</span>
        </span>
      </span>
    );
  }
  const fromLeft = by === 1;
  const colour = fromLeft ? "red" : "blue";
  const from = fromLeft ? "24%" : "76%";
  const to = fromLeft ? "76%" : "24%";
  const flip = fromLeft ? "" : "-scale-x-100";
  const fly = (delay = 0, dur = 0.3): React.CSSProperties => ({ ["--from" as string]: from, ["--to" as string]: to, left: from, animation: `ff-fly ${dur}s linear ${delay}s both` });
  const img = (src: string, cls: string) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" className={`${cls} ${flip}`} />
  );
  return (
    <div className="pointer-events-none absolute inset-0 z-20" aria-hidden>
      {kind === "laser"
        ? [0, 0.07, 0.14].map((d) => (
            <span key={d} className="absolute bottom-[4.2rem] -translate-x-1/2" style={fly(d, 0.22)}>
              {img(`${RB}/laser_${colour}.png`, "h-4 w-16 drop-shadow-[0_0_8px_rgba(255,255,255,.95)]")}
            </span>
          ))
        : null}
      {kind === "cannon" ? (
        <span className="absolute bottom-[4rem] -translate-x-1/2" style={fly(0, 0.38)}>
          <span className="block" style={{ animation: "ff-arc .38s ease-in-out both" }}>
            {img(`${RB}/shell.png`, "h-6 w-auto")}
          </span>
        </span>
      ) : null}
      {kind === "rocket" ? (
        <span className="absolute bottom-[4.4rem] -translate-x-1/2" style={fly(0, 0.4)}>
          <span className="flex items-center" style={{ animation: "ff-wobble .4s linear both" }}>
            {fromLeft ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`${RB}/smoke.png`} alt="" className="-mr-2 h-5 w-5 opacity-70" />
            ) : null}
            {img(`${RB}/rocket_${colour}.png`, "h-9 w-auto")}
            {!fromLeft ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`${RB}/smoke.png`} alt="" className="-ml-2 h-5 w-5 opacity-70" />
            ) : null}
          </span>
        </span>
      ) : null}
      {kind === "orb" ? (
        <span className="absolute bottom-[3.8rem] -translate-x-1/2" style={fly(0, 0.42)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`${RB}/orb_${colour}.png`} alt="" className="h-12 w-12 animate-[spin_.4s_linear_infinite] drop-shadow-[0_0_12px_rgba(255,255,255,.95)]" />
        </span>
      ) : null}
      {kind === "mega" ? (
        <span
          className={`absolute bottom-[4.1rem] h-7 rounded-full ${fromLeft ? "origin-left" : "origin-right"}`}
          style={{
            left: fromLeft ? "24%" : "24%",
            right: "24%",
            background: fromLeft ? "linear-gradient(90deg,#fff,#ff9a7a 30%,#ff3d2e)" : "linear-gradient(270deg,#fff,#9ad0ff 30%,#2e7dff)",
            boxShadow: fromLeft ? "0 0 22px 6px #ff6b4d" : "0 0 22px 6px #4d9bff",
            animation: "ff-beam .55s ease-out both",
          }}
        />
      ) : null}
      {/* the hit */}
      <span className="absolute bottom-[2.6rem] -translate-x-1/2" style={{ left: to }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`${RB}/boom.png`} alt="" className={`${kind === "mega" ? "h-28 w-28" : "h-20 w-20"} opacity-0`} style={{ animation: `ff-boom .45s ease-out ${kind === "laser" ? 0.22 : kind === "mega" ? 0.2 : 0.36}s both` }} />
      </span>
      <span className="absolute bottom-[7.5rem] left-1/2 z-30 -translate-x-1/2 whitespace-nowrap rounded-full bg-[#16233a]/70 px-3 font-sport text-2xl font-extrabold italic text-white opacity-0 [text-shadow:0_2px_0_#16233a,0_0_8px_#16233a]" style={{ animation: "ff-shout .7s ease-out both" }}>
        {SHOUT[kind]}
      </span>
    </div>
  );
}

export function FractionFaceoff() {
  const [level, setLevel] = useState<FaceLevel>("bottom");
  const [phase, setPhase] = useState<"setup" | "play" | "done">("setup");
  const [q, setQ] = useState<FaceQ | null>(null);
  const [score, setScore] = useState(0);
  const [left, setLeft] = useState(SECONDS);
  const [oops, setOops] = useState<string | null>(null);
  const [flash, setFlash] = useState<-1 | 0 | 1 | null>(null);
  // A fight: which robot attacks (1 left, -1 right, 0 both: a draw), and a count so each one replays.
  const [fight, setFight] = useState<{ by: -1 | 0 | 1; n: number; kind: Weapon; combo: number } | null>(null);
  const streak = useRef(0);
  const fightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (fightTimer.current) clearTimeout(fightTimer.current);
  }, []);
  function attack(by: -1 | 0 | 1, ms = 700, kind: Weapon = "laser") {
    setFight((f) => ({ by, n: (f?.n ?? 0) + 1, kind, combo: streak.current }));
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
    streak.current = 0;
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
      streak.current += 1;
      attack(pick, streak.current % 5 === 0 ? 900 : 750, weaponFor(streak.current));
      setQ((p) => faceQ(level, Math.random, p ?? undefined));
      return;
    }
    setMissed((m) => (m.some((x) => fracText(x.left) === fracText(q.left) && fracText(x.right) === fracText(q.right)) ? m : [...m, q]));
    streak.current = 0;
    attack(truth, 900, "laser");
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
            className={`pz-anim block h-24 w-auto drop-shadow-[0_6px_4px_rgba(0,0,0,.35)] sm:h-28 ${charging ? (fight?.by === 0 ? "animate-[ff-bump_.6s_ease-in-out]" : "animate-[ff-recoil_.45s_ease-out]") : knocked ? (fight?.kind === "mega" ? "animate-[ff-knock_.9s_ease-out]" : "animate-[ff-knock_.75s_ease-out]") : ""}`}
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
          {fight ? <Shot key={fight.n} by={fight.by} kind={fight.kind} /> : null}
          {fight && fight.by !== 0 && fight.combo >= 2 && !oops ? (
            <span key={`c${fight.n}`} className="pz-anim pointer-events-none absolute -top-2 left-1/2 z-30 -translate-x-1/2 animate-[tt-pop_.35s_ease-out] whitespace-nowrap rounded-full bg-[#ffd84d] px-3 py-0.5 font-sport text-lg font-extrabold italic text-[#16233a] shadow-lg" aria-hidden>
              COMBO ×{fight.combo}
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
