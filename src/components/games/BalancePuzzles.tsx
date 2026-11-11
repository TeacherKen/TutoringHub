"use client";
import { useState } from "react";
import { balanceQ, balanceStars, BALANCE_LEVELS, SHAPE_NAME, type BalanceLevel, type BalanceQ, type Item, type Shape } from "@/lib/games/balance";
import { NumberPad } from "./NumberPad";
import { useBest } from "./useBest";
import { BigButton, GameHero, HowToPlay, LevelPicker, ResultCard, THEMES } from "./GameKit";

const T = THEMES.scale;

// Balance Puzzles: the Alien Weigh Station! Aliens want to ride home in the UFO, but first each kind
// of alien must be weighed. The scales balance, so both sides weigh the same: what does one alien weigh?
// (Aliens and wood: Kenney "Physics Assets"; desert: "Platformer Pack Remastered". All CC0.)

const ALIEN = "/games/art/aliens";
const ALIENS: Record<Shape, string> = { circle: "alienPink_round", triangle: "alienGreen_round", square: "alienBlue_square" };

const ROUNDS = 8;
const secs = (ms: number) => `${Math.round(ms / 1000)}s`;

/** One of the aliens (each kind is a mystery weight). Hops when the puzzle is solved. */
export function ShapeIcon({ s, size = 34, hop = false, delay = 0 }: { s: Shape; size?: number; hop?: boolean; delay?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`${ALIEN}/${ALIENS[s]}.png`}
      alt={SHAPE_NAME[s]}
      width={size}
      height={size}
      draggable={false}
      className="select-none object-contain drop-shadow-[0_2px_2px_rgba(0,0,0,.3)]"
      style={hop ? { animation: `bp-hop .5s ease-out ${delay}ms 2` } : undefined}
    />
  );
}

/** A metal weight with a handle and its number. */
function Weight({ n }: { n: number }) {
  const w = n >= 10 ? 46 : 40;
  return (
    <svg viewBox={`0 0 ${w} 44`} width={w} height={44} role="img" aria-label={`${n}`} style={{ filter: "drop-shadow(0 2px 2px rgba(0,0,0,.3))" }}>
      <defs>
        <linearGradient id={`pz-wt-${w}`} x1="0" x2="1">
          <stop offset="0%" stopColor="#5b6578" />
          <stop offset="45%" stopColor="#9aa4b6" />
          <stop offset="100%" stopColor="#3d4556" />
        </linearGradient>
      </defs>
      <path d={`M${w / 2 - 7} 12 Q${w / 2 - 7} 3 ${w / 2} 3 Q${w / 2 + 7} 3 ${w / 2 + 7} 12`} fill="none" stroke="#3d4556" strokeWidth="3.5" />
      <path d={`M6 12 L${w - 6} 12 L${w - 1} 41 Q${w - 1} 43 ${w - 3} 43 L3 43 Q1 43 1 41 Z`} fill={`url(#pz-wt-${w})`} />
      <text x={w / 2} y="34" textAnchor="middle" fontSize="17" fontWeight="800" fill="#fff" style={{ fontVariantNumeric: "tabular-nums" }}>
        {n}
      </text>
    </svg>
  );
}

function Load({ items, hop }: { items: Item[]; hop: boolean }) {
  return (
    <div className="flex min-h-[46px] flex-wrap items-end justify-center gap-1">
      {items.map((it, i) => ("n" in it ? <Weight key={i} n={it.n} /> : <ShapeIcon key={i} s={it.s} size={40} hop={hop} delay={i * 80} />))}
    </div>
  );
}

/** One balanced scale: a brass beam on a stand, with a pan hanging on each side. */
export function ScaleView({ left, right, wobble = false }: { left: Item[]; right: Item[]; wobble?: boolean }) {
  return (
    <div className="relative mx-auto w-full max-w-[440px]" role="img" aria-label="A balanced scale">
      <style>{`@keyframes bp-hop{0%,100%{transform:none}40%{transform:translateY(-12px) rotate(-6deg)}}`}</style>
      <div className={`pz-anim origin-[50%_62px] ${wobble ? "animate-[pz-tip_.9s_ease-in-out]" : ""}`}>
        <div className="relative z-10 grid grid-cols-2 gap-10 px-1">
          <Load items={left} hop={wobble} />
          <Load items={right} hop={wobble} />
        </div>
        <svg viewBox="0 0 440 40" className="-mt-1 block w-full" aria-hidden>
          <defs>
            <linearGradient id="pz-brass" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#e7b26a" />
              <stop offset="50%" stopColor="#c08442" />
              <stop offset="100%" stopColor="#8a5626" />
            </linearGradient>
          </defs>
          {/* pans */}
          <path d="M14 4 L196 4 Q190 22 105 22 Q20 22 14 4Z" fill="url(#pz-brass)" />
          <path d="M244 4 L426 4 Q420 22 335 22 Q250 22 244 4Z" fill="url(#pz-brass)" />
          <ellipse cx="105" cy="4" rx="91" ry="2.5" fill="#f3cf98" />
          <ellipse cx="335" cy="4" rx="91" ry="2.5" fill="#f3cf98" />
          {/* strings */}
          <path d="M105 22 L105 34 M335 22 L335 34" stroke="#8a6a1c" strokeWidth="2" />
          {/* beam */}
          <rect x="60" y="30" width="320" height="10" rx="3" fill="url(#pz-brass)" stroke="#6b3f1a" strokeWidth="1.5" />
          <path d="M80 35 H140 M170 34 H200 M250 36 H330" stroke="#8a5626" strokeWidth="1" opacity=".6" />
        </svg>
      </div>
      <svg viewBox="0 0 440 60" className="-mt-1 block w-full" aria-hidden>
        <circle cx="220" cy="4" r="9" fill="#6b3f1a" />
        <circle cx="220" cy="4" r="4" fill="#f3cf98" />
        <path d="M214 10 L200 46 L240 46 L226 10Z" fill="#8a5626" stroke="#6b3f1a" strokeWidth="1.5" />
        <rect x="160" y="46" width="120" height="10" rx="3" fill="#6b3f1a" />
      </svg>
    </div>
  );
}

export function BalancePuzzles() {
  const [level, setLevel] = useState<BalanceLevel>("easy");
  const [phase, setPhase] = useState<"setup" | "play" | "done">("setup");
  const [q, setQ] = useState<BalanceQ | null>(null);
  const [round, setRound] = useState(0);
  const [answer, setAnswer] = useState("");
  const [tries, setTries] = useState(0);
  const [wrongTotal, setWrongTotal] = useState(0);
  const [note, setNote] = useState<{ kind: "ok" | "bad" | "show"; text: string } | null>(null);
  const [startedAt, setStartedAt] = useState(0);
  const [took, setTook] = useState(0);
  const [newBest, setNewBest] = useState(false);
  const { best, offer } = useBest(`bp-${level}`, (a, b) => a > b, "stars");

  function start() {
    setQ(balanceQ(level));
    setRound(1);
    setAnswer("");
    setTries(0);
    setWrongTotal(0);
    setNote(null);
    setStartedAt(Date.now());
    setPhase("play");
  }

  function next() {
    if (round >= ROUNDS) {
      const stars = balanceStars(wrongTotal);
      setTook(Date.now() - startedAt);
      setNewBest(offer(stars));
      setPhase("done");
      return;
    }
    setQ(balanceQ(level, Math.random));
    setRound((r) => r + 1);
    setAnswer("");
    setTries(0);
    setNote(null);
  }

  function check() {
    if (!q || !answer || note?.kind === "ok" || note?.kind === "show") return;
    if (Number(answer) === q.answer) {
      setNote({ kind: "ok", text: `Yes! One ${SHAPE_NAME[q.ask]} weighs ${q.answer}.` });
      setTimeout(next, 1200);
      return;
    }
    const t = tries + 1;
    setTries(t);
    setWrongTotal((w) => w + 1);
    setAnswer("");
    if (t >= 2) setNote({ kind: "show", text: `One ${SHAPE_NAME[q.ask]} weighs ${q.answer}. Check it: put ${q.answer} in place of each ${SHAPE_NAME[q.ask]} — both sides match!` });
    else setNote({ kind: "bad", text: `Not quite. ${q.hint}` });
  }

  const stage = "rounded-3xl p-4 sm:p-5 shadow-[0_6px_18px_rgba(0,0,0,.15)] ring-2 ring-black/5";
  const sky = { background: "linear-gradient(rgba(255,255,255,.35), rgba(255,255,255,.1)), url(/games/art/pizza/desert.png) center 75% / cover, #f6d9a8" };

  if (phase === "setup")
    return (
      <div className="space-y-4">
        <GameHero theme={T} art={null} title="BALANCE PUZZLES">
          Welcome to the Alien Weigh Station! The aliens can only fly home once we know what each one weighs. {ROUNDS} puzzles.
        </GameHero>
        <HowToPlay
          theme={T}
          steps={[
            "The scale is balanced, so both sides weigh exactly the same.",
            <>Each kind of alien has a secret weight. The grey blocks show their weight with a number.</>,
            <>Example: 2 green aliens balance 8. So 2 green aliens = 8, and 1 green alien = <strong>4</strong>.</>,
            "Type your answer and press OK. Two scales? Solve the easy one first, then use it on the other!",
          ]}
        />
        <div className={stage} style={sky}>
          <ScaleView left={[{ s: "triangle" }, { s: "triangle" }]} right={[{ n: 8 }]} />
        </div>
        <LevelPicker theme={T} levels={Object.entries(BALANCE_LEVELS) as [BalanceLevel, string][]} value={level} onChange={setLevel} />
        {best != null ? <p className="flex items-center justify-center gap-1 text-sm text-muted">Your best: {Array.from({ length: best }, (_, i) => <StarIcon key={i} className="h-5 w-5" />)}</p> : null}
        <BigButton theme={T} onClick={start}>
          ▶ Start
        </BigButton>
      </div>
    );

  if (phase === "done") {
    const stars = balanceStars(wrongTotal);
    return (
      <ResultCard
        theme={T}
        art={null}
        label={`All ${ROUNDS} aliens weighed! They fly home happy.`}
        big={
          <span aria-label={`${stars} stars`}>
            {Array.from({ length: 3 }, (_, i) => (
              <span key={i} className={`pz-anim inline-block ${i < stars ? "animate-[tt-pop_.5s_ease-out_both]" : "opacity-25 grayscale"}`} style={{ animationDelay: `${i * 180}ms` }}>
                <StarIcon className="h-14 w-14" />
              </span>
            ))}
          </span>
        }
        newBest={newBest}
        bestText={`${secs(took)} · ${wrongTotal === 0 ? "no mistakes!" : `${wrongTotal} wrong ${wrongTotal === 1 ? "try" : "tries"}`}`}
        onAgain={start}
        onChange={() => setPhase("setup")}
      >
        <div className={stage} style={sky}>
          <ScaleView left={[{ s: "circle" }, { s: "triangle" }, { s: "square" }]} right={[{ n: ROUNDS }]} wobble />
        </div>
      </ResultCard>
    );
  }

  if (!q) return null;
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted">
          Puzzle <strong className="tabular-nums text-ink">{round}</strong> of {ROUNDS}
        </span>
        <div className="relative ml-auto flex items-center gap-0.5" aria-label={`${round - 1} aliens weighed`}>
          {Array.from({ length: ROUNDS }, (_, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={`${ALIEN}/${["alienPink_round", "alienGreen_round", "alienBlue_square"][i % 3]}.png`} alt="" aria-hidden className={`h-6 w-6 object-contain ${i < round - 1 ? "" : i === round - 1 ? "animate-[pz-float_2s_ease-in-out_infinite]" : "opacity-30 grayscale"}`} />
          ))}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/games/art/space/ufo.png" alt="" aria-hidden className="ml-1 h-7 w-9 object-contain" />
        </div>
      </div>
      <div key={round} className={`${stage} pz-anim space-y-4 animate-[tt-pop_.35s_ease-out]`} style={sky}>
        {q.scales.map((s, i) => (
          <ScaleView key={i} left={s.left} right={s.right} wobble={note?.kind === "ok"} />
        ))}
      </div>
      <div className="flex items-center justify-center gap-3 text-xl font-semibold">
        <span>One</span>
        <span className="pz-anim animate-[pz-float_2s_ease-in-out_infinite]">
          <ShapeIcon s={q.ask} size={44} />
        </span>
        <span>weighs how much?</span>
      </div>
      {note ? (
        <p
          className={`pz-anim rounded-2xl p-3 text-center font-medium ${note.kind === "ok" ? "animate-[tt-pop_.4s_ease-out] bg-ok-soft text-ok" : note.kind === "bad" ? "animate-[pz-shake_.35s_ease-in-out] bg-danger-soft text-danger" : "bg-accent-soft text-accent"}`}
          role="status"
        >
          {note.text}
        </p>
      ) : null}
      {note?.kind === "show" ? (
        <button type="button" className="btn-primary w-full" onClick={next}>
          Next puzzle
        </button>
      ) : (
        <NumberPad value={answer} onChange={setAnswer} onSubmit={check} max={2} wrong={note?.kind === "bad"} />
      )}
    </div>
  );
}

function StarIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path d="M12 2.5l2.9 6 6.6.8-4.9 4.5 1.3 6.5L12 17.1l-5.9 3.2 1.3-6.5L2.5 9.3l6.6-.8z" fill="#ffd84d" stroke="#c99a00" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}
