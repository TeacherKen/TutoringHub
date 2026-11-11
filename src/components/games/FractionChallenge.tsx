"use client";
import { useEffect, useState } from "react";
import { CHALLENGE_LEVELS, challengeHint, challengeQ, type ChallengeLevel, type ChallengeQ } from "@/lib/fractions";
import { FracText } from "./FractionShapes";
import { NumberPad } from "./NumberPad";
import { useBest } from "./useBest";
import { BigButton, GameHero, LevelPicker, ResultCard, THEMES } from "./GameKit";

const T = THEMES.pirate;
const PI = "/games/art/pirate"; // Kenney Pirate Pack, Block Pack, Platformer Pack (CC0)

/**
 * The treasure voyage: each right answer sails the pirate ship one step to Treasure Island.
 * A wrong answer: a cannonball splashes next to the ship (and a hint shows).
 */
function Voyage({ n, max, splash }: { n: number; max: number; splash: number }) {
  const pct = Math.min(1, n / max);
  return (
    <div className="relative h-36 overflow-hidden rounded-3xl shadow-[0_8px_24px_rgba(0,0,0,.25)] ring-4 ring-black/15 sm:h-44" style={{ background: "radial-gradient(120% 140% at 30% 0%, #5cc4f0, #1f7fb8 60%, #0b3a5c)" }} aria-hidden>
      {/* waves */}
      <div className="absolute inset-0 opacity-30 [background-image:radial-gradient(ellipse_18px_5px_at_50%_50%,#fff_40%,transparent_42%)] [background-size:70px_36px]" />
      {/* treasure island */}
      <div className="absolute -right-6 top-1/2 h-28 w-36 -translate-y-1/2 rounded-[50%] bg-[radial-gradient(circle_at_45%_40%,#f7e3a8,#e2c27a_65%,#c9a35a)] shadow-[0_0_0_10px_rgba(255,255,255,.25)] sm:h-32 sm:w-44" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/games/art/scene/treePalm.png" alt="" className="absolute right-12 top-2 h-20 w-auto sm:h-24" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`${PI}/chest.png`} alt="" className="absolute bottom-6 right-6 h-12 w-auto sm:h-14" />
      {/* coins collected so far */}
      <div className="absolute bottom-2 left-3 flex -space-x-2">
        {Array.from({ length: n }, (_, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={i} src={`${PI}/coin.png`} alt="" className="pz-anim h-6 w-6 animate-[tt-pop_.3s_ease-out]" />
        ))}
      </div>
      {/* the ship */}
      <div className="absolute top-1/2 -translate-y-1/2 transition-[left] duration-700 ease-out" style={{ left: `calc(${pct} * (100% - 13rem) + 0.5rem)` }}>
        {splash ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={splash} src={`${PI}/splash.png`} alt="" className="pz-anim absolute -top-4 left-14 h-12 w-12 opacity-0" style={{ animation: "qm-burst .7s ease-out" }} />
        ) : null}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`${PI}/ship.png`} alt="" className="pz-anim h-16 w-auto drop-shadow-[0_6px_6px_rgba(0,0,0,.35)] sm:h-20" style={{ animation: "pf-rock 2.4s ease-in-out infinite" }} />
      </div>
      <span className="absolute right-3 top-2 rounded-full bg-black/35 px-2.5 py-0.5 text-xs font-bold tracking-wider text-white">{max - n} TO TREASURE ISLAND</span>
    </div>
  );
}

// 🏆 Fraction Challenge (older children): fractions of amounts, adding and taking away fractions with the
// same bottom number, and equivalent fractions. Answers go in on the big number pad. 10 questions.

const COUNT = 10;
const secs = (tenths: number) => `${(tenths / 10).toFixed(1)}s`;

/** "Share 12 into 3 groups": the groups drawn as dots, shown after a wrong answer to a "1/3 of 12" question. */
function Groups({ q }: { q: Extract<ChallengeQ, { kind: "of" }> }) {
  const each = q.whole / q.f.d;
  if (q.whole > 40) return null;
  return (
    <div className="flex flex-wrap justify-center gap-2" aria-hidden>
      {Array.from({ length: q.f.d }, (_, g) => (
        <div key={g} className={`flex max-w-[6.5rem] flex-wrap justify-center gap-1 rounded-xl border-2 p-2 ${g < q.f.n ? "border-accent bg-accent-soft" : "border-line"}`}>
          {Array.from({ length: each }, (_, i) => (
            <span key={i} className={`h-3 w-3 rounded-full ${g < q.f.n ? "bg-accent" : "bg-muted/50"}`} />
          ))}
        </div>
      ))}
    </div>
  );
}

function Question({ q }: { q: ChallengeQ }) {
  const big = "text-5xl";
  if (q.kind === "of")
    return (
      <p className="flex items-center justify-center gap-3 text-4xl font-semibold tabular-nums">
        <FracText f={q.f} className={big} /> of {q.whole} = <span className="text-muted">?</span>
      </p>
    );
  if (q.kind === "equiv")
    return (
      <p className="flex items-center justify-center gap-3 text-4xl font-semibold">
        <FracText f={q.from} className={big} /> = <FracText f={{ n: q.answer, d: q.d }} top="?" className={big} />
      </p>
    );
  return (
    <p className="flex items-center justify-center gap-3 text-4xl font-semibold">
      <FracText f={q.a} className={big} /> {q.kind === "add" ? "+" : "−"} <FracText f={q.b} className={big} /> = <FracText f={{ n: q.answer, d: q.a.d }} top="?" className={big} />
    </p>
  );
}

export function FractionChallenge() {
  const [level, setLevel] = useState<ChallengeLevel>("unit");
  const [phase, setPhase] = useState<"setup" | "play" | "done">("setup");
  const [q, setQ] = useState<ChallengeQ | null>(null);
  const [n, setN] = useState(0);
  const [answer, setAnswer] = useState("");
  const [wrong, setWrong] = useState(false);
  const [misses, setMisses] = useState(0);
  const [startedAt, setStartedAt] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [newBest, setNewBest] = useState(false);
  const { best, offer } = useBest(`fc-${level}`, (a, b) => a < b, "ds");

  useEffect(() => {
    if (phase !== "play") return;
    const id = setInterval(() => setElapsed(Date.now() - startedAt), 100);
    return () => clearInterval(id);
  }, [phase, startedAt]);

  function start() {
    setN(0);
    setAnswer("");
    setWrong(false);
    setQ(challengeQ(level));
    setStartedAt(Date.now());
    setElapsed(0);
    setNewBest(false);
    setPhase("play");
  }

  function submit() {
    if (!q || !answer) return;
    if (Number(answer) === q.answer) {
      const next = n + 1;
      setN(next);
      setWrong(false);
      if (next >= COUNT) {
        const time = Math.round((Date.now() - startedAt) / 100);
        setElapsed(time * 100);
        setNewBest(offer(time));
        setPhase("done");
      } else setQ(challengeQ(level, Math.random, q));
    } else {
      setWrong(true);
      setMisses((m) => m + 1);
    }
    setAnswer("");
  }

  if (phase === "setup") {
    return (
      <div className="space-y-4">
        <GameHero theme={T} art={null} title="FRACTION CHALLENGE">
          {COUNT} questions. A wrong answer gets a hint, then you try again.
        </GameHero>
        <LevelPicker theme={T} levels={Object.entries(CHALLENGE_LEVELS) as [ChallengeLevel, string][]} value={level} onChange={setLevel} />
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

  if (!q) return null;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm text-muted">
        <span>
          Question <strong className="text-ink tabular-nums">{n + 1}</strong> of {COUNT}
        </span>
        <span className="tabular-nums">{secs(Math.round(elapsed / 100))}</span>
      </div>
      <Voyage n={n} max={COUNT} splash={misses} />
      <div key={n} className="rpg-panel pz-anim animate-[tt-pop_.3s_ease-out] px-2 py-1 text-center">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#7a4a1a]">Captain&apos;s question</p>
        <div className="text-[#3b2410]">
          <Question q={q} />
        </div>
      </div>
      {wrong ? (
        <div className="rpg-panel-light pz-anim animate-[pz-shake_.35s] space-y-3 px-2 py-1 text-center">
          <p className="font-medium text-[#b42318]">Splash! A cannonball missed you. {challengeHint(q)}</p>
          {q.kind === "of" ? <Groups q={q} /> : null}
        </div>
      ) : null}
      <NumberPad
        value={answer}
        onChange={(v) => {
          setAnswer(v);
        }}
        onSubmit={submit}
        max={3}
        wrong={wrong && !answer}
      />
    </div>
  );
}
