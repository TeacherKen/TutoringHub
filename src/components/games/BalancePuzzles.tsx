"use client";
import { useState } from "react";
import { balanceQ, balanceStars, BALANCE_LEVELS, SHAPE_NAME, type BalanceLevel, type BalanceQ, type Item, type Shape } from "@/lib/games/balance";
import { NumberPad } from "./NumberPad";
import { useBest } from "./useBest";
import { BigButton, GameHero, LevelPicker, ResultCard, THEMES } from "./GameKit";

const T = THEMES.scale;

// ⚖️ Balance Puzzles: the scales balance, so both sides weigh the same. What does one shape weigh?

const ROUNDS = 8;
// Each shape: light, main and dark colour (for a soft 3D look).
const PAINT: Record<Shape, [string, string, string]> = {
  circle: ["#ff9a9e", "#e5484d", "#a3262a"],
  triangle: ["#9db4ff", "#3e63dd", "#22379a"],
  square: ["#8fe3b4", "#30a46c", "#17683f"],
};
const secs = (ms: number) => `${Math.round(ms / 1000)}s`;

/** A shiny shape (a ball, a pyramid-ish triangle, a block). */
export function ShapeIcon({ s, size = 34 }: { s: Shape; size?: number }) {
  const [light, main, dark] = PAINT[s];
  const id = `pz-${s}`;
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-label={SHAPE_NAME[s]} role="img" style={{ filter: "drop-shadow(0 2px 2px rgba(0,0,0,.25))" }}>
      <defs>
        <radialGradient id={`${id}-g`} cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor={light} />
          <stop offset="55%" stopColor={main} />
          <stop offset="100%" stopColor={dark} />
        </radialGradient>
      </defs>
      {s === "circle" ? (
        <>
          <circle cx="20" cy="20" r="17" fill={`url(#${id}-g)`} />
          <ellipse cx="14" cy="12" rx="5" ry="3" fill="#fff" opacity=".45" />
        </>
      ) : s === "triangle" ? (
        <>
          <path d="M20 3.5 Q21.6 3.5 22.4 5 L37 33 Q37.8 36 34.6 36 L5.4 36 Q2.2 36 3 33 L17.6 5 Q18.4 3.5 20 3.5Z" fill={`url(#${id}-g)`} />
          <path d="M19 10 L12 25" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" opacity=".4" />
        </>
      ) : (
        <>
          <rect x="4" y="4" width="32" height="32" rx="6" fill={`url(#${id}-g)`} />
          <rect x="8" y="8" width="11" height="5" rx="2.5" fill="#fff" opacity=".4" />
        </>
      )}
    </svg>
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

function Load({ items }: { items: Item[] }) {
  return (
    <div className="flex min-h-[46px] flex-wrap items-end justify-center gap-1">
      {items.map((it, i) => ("n" in it ? <Weight key={i} n={it.n} /> : <ShapeIcon key={i} s={it.s} size={38} />))}
    </div>
  );
}

/** One balanced scale: a brass beam on a stand, with a pan hanging on each side. */
export function ScaleView({ left, right, wobble = false }: { left: Item[]; right: Item[]; wobble?: boolean }) {
  return (
    <div className="relative mx-auto w-full max-w-[440px]" role="img" aria-label="A balanced scale">
      <div className={`pz-anim origin-[50%_62px] ${wobble ? "animate-[pz-tip_.9s_ease-in-out]" : ""}`}>
        <div className="relative z-10 grid grid-cols-2 gap-10 px-1">
          <Load items={left} />
          <Load items={right} />
        </div>
        <svg viewBox="0 0 440 40" className="-mt-1 block w-full" aria-hidden>
          <defs>
            <linearGradient id="pz-brass" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f6d77b" />
              <stop offset="50%" stopColor="#d4a52c" />
              <stop offset="100%" stopColor="#9c741a" />
            </linearGradient>
          </defs>
          {/* pans */}
          <path d="M14 4 L196 4 Q190 22 105 22 Q20 22 14 4Z" fill="url(#pz-brass)" />
          <path d="M244 4 L426 4 Q420 22 335 22 Q250 22 244 4Z" fill="url(#pz-brass)" />
          <ellipse cx="105" cy="4" rx="91" ry="2.5" fill="#fbe7a6" />
          <ellipse cx="335" cy="4" rx="91" ry="2.5" fill="#fbe7a6" />
          {/* strings */}
          <path d="M105 22 L105 34 M335 22 L335 34" stroke="#8a6a1c" strokeWidth="2" />
          {/* beam */}
          <rect x="60" y="31" width="320" height="8" rx="4" fill="url(#pz-brass)" />
        </svg>
      </div>
      <svg viewBox="0 0 440 60" className="-mt-1 block w-full" aria-hidden>
        <circle cx="220" cy="4" r="9" fill="#9c741a" />
        <circle cx="220" cy="4" r="4" fill="#f6d77b" />
        <path d="M214 10 L206 46 L234 46 L226 10Z" fill="#7b5a14" />
        <rect x="170" y="46" width="100" height="10" rx="5" fill="#5f450f" />
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

  const stage = "rounded-3xl p-4 sm:p-5 shadow-inner";
  const sky = { background: "linear-gradient(180deg, #e8f1ff 0%, #f7f3e8 100%)" };

  if (phase === "setup")
    return (
      <div className="space-y-4">
        <GameHero theme={T} art="⚖️" title="BALANCE PUZZLES">
          The scales are balanced: both sides weigh the same. Work out what each shape weighs. {ROUNDS} puzzles.
        </GameHero>
        <div className={stage} style={sky}>
          <ScaleView left={[{ s: "triangle" }, { s: "triangle" }]} right={[{ n: 8 }]} />
        </div>
        <LevelPicker theme={T} levels={Object.entries(BALANCE_LEVELS) as [BalanceLevel, string][]} value={level} onChange={setLevel} />
        {best != null ? <p className="text-center text-sm text-muted">Your best: {"⭐".repeat(best)}</p> : null}
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
        art="⚖️"
        label={`${ROUNDS} puzzles solved`}
        big={
          <span aria-label={`${stars} stars`}>
            {Array.from({ length: 3 }, (_, i) => (
              <span key={i} className={`pz-anim inline-block ${i < stars ? "animate-[tt-pop_.5s_ease-out_both]" : "opacity-25 grayscale"}`} style={{ animationDelay: `${i * 180}ms` }}>
                ⭐
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
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted">
          Puzzle <strong className="tabular-nums text-ink">{round}</strong> of {ROUNDS}
        </span>
        <div className="flex flex-1 gap-1" aria-hidden>
          {Array.from({ length: ROUNDS }, (_, i) => (
            <span key={i} className={`h-2 flex-1 rounded-full ${i < round - 1 ? "bg-[#d4a52c]" : i === round - 1 ? "bg-[#f6d77b]" : "bg-line"}`} />
          ))}
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
          {note.kind === "ok" ? "🎉 " : note.kind === "bad" ? "🤔 " : "💡 "}
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
