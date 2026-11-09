"use client";
import { useState } from "react";
import { balanceQ, balanceStars, BALANCE_LEVELS, SHAPE_NAME, type BalanceLevel, type BalanceQ, type Item, type Shape } from "@/lib/games/balance";
import { NumberPad } from "./NumberPad";
import { useBest } from "./useBest";

// ⚖️ Balance Puzzles: the scales balance, so both sides weigh the same. What does one shape weigh?

const ROUNDS = 8;
const COLOUR: Record<Shape, string> = { circle: "#e5484d", triangle: "#3e63dd", square: "#30a46c" };
const secs = (ms: number) => `${Math.round(ms / 1000)}s`;

export function ShapeIcon({ s, size = 34 }: { s: Shape; size?: number }) {
  const c = COLOUR[s];
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-label={SHAPE_NAME[s]} role="img" className="drop-shadow-sm">
      {s === "circle" ? <circle cx="20" cy="20" r="17" fill={c} /> : s === "triangle" ? <path d="M20 3 L37 35 L3 35 Z" fill={c} strokeLinejoin="round" /> : <rect x="4" y="4" width="32" height="32" rx="4" fill={c} />}
    </svg>
  );
}

function Weight({ n }: { n: number }) {
  return (
    <span className="grid h-9 min-w-9 place-items-center rounded-lg bg-[#3b4252] px-1.5 text-base font-bold tabular-nums text-white shadow-sm" style={{ clipPath: "polygon(18% 0, 82% 0, 100% 100%, 0 100%)" }}>
      {n}
    </span>
  );
}

function Pan({ items }: { items: Item[] }) {
  return (
    <div className="flex min-h-[3.25rem] flex-wrap items-end justify-center gap-1 px-1">
      {items.map((it, i) => ("n" in it ? <Weight key={i} n={it.n} /> : <ShapeIcon key={i} s={it.s} />))}
    </div>
  );
}

/** One balanced scale: two pans on a level beam. */
export function ScaleView({ left, right }: { left: Item[]; right: Item[] }) {
  return (
    <div className="mx-auto w-full max-w-md" role="img" aria-label="A balanced scale">
      <div className="grid grid-cols-2 gap-6">
        <Pan items={left} />
        <Pan items={right} />
      </div>
      <div className="grid grid-cols-2 gap-6">
        <div className="mx-2 h-2 rounded-b-full bg-[#c9a227]" />
        <div className="mx-2 h-2 rounded-b-full bg-[#c9a227]" />
      </div>
      <div className="relative mt-1 h-1.5 rounded-full bg-[#8b6d1f]" />
      <div className="mx-auto h-8 w-2 bg-[#8b6d1f]" />
      <div className="mx-auto h-2 w-24 rounded-full bg-[#8b6d1f]" />
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
  const { best, offer } = useBest(`bp-${level}`, (a, b) => a > b);

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
      setNote({ kind: "ok", text: `Yes! One ${SHAPE_NAME[q.ask]} weighs ${q.answer}. ⚖️` });
      setTimeout(next, 1100);
      return;
    }
    const t = tries + 1;
    setTries(t);
    setWrongTotal((w) => w + 1);
    setAnswer("");
    if (t >= 2) setNote({ kind: "show", text: `One ${SHAPE_NAME[q.ask]} weighs ${q.answer}. Check it: put ${q.answer} in place of each ${SHAPE_NAME[q.ask]} — both sides match!` });
    else setNote({ kind: "bad", text: `Not quite. ${q.hint}` });
  }

  if (phase === "setup")
    return (
      <div className="space-y-4">
        <div className="flex justify-center gap-3" aria-hidden>
          <ShapeIcon s="circle" size={44} />
          <ShapeIcon s="triangle" size={44} />
          <ShapeIcon s="square" size={44} />
        </div>
        <p className="text-muted">The scales are balanced: both sides weigh the same. Work out what each shape weighs. {ROUNDS} puzzles.</p>
        <div className="grid gap-2">
          {(Object.keys(BALANCE_LEVELS) as BalanceLevel[]).map((l) => (
            <button key={l} type="button" aria-pressed={level === l} onClick={() => setLevel(l)} className={`min-h-12 rounded-xl border px-4 text-left ${level === l ? "border-accent bg-accent-soft font-medium text-accent" : "border-line bg-surface"}`}>
              {BALANCE_LEVELS[l]}
            </button>
          ))}
        </div>
        {best != null ? <p className="text-sm text-muted">Your best: {"⭐".repeat(best)}</p> : null}
        <button type="button" className="btn-primary w-full" onClick={start}>
          Start
        </button>
      </div>
    );

  if (phase === "done") {
    const stars = balanceStars(wrongTotal);
    return (
      <div className="space-y-4 text-center">
        <p className="text-6xl" aria-hidden>
          ⚖️
        </p>
        <p className="text-4xl">
          {"⭐".repeat(stars)}
          <span className="opacity-25">{"⭐".repeat(3 - stars)}</span>
        </p>
        <p className="text-muted">
          {ROUNDS} puzzles in {secs(took)} · {wrongTotal === 0 ? "no mistakes!" : `${wrongTotal} wrong ${wrongTotal === 1 ? "try" : "tries"}`}
        </p>
        {newBest ? <p className="font-medium text-ok">New best! 🏆</p> : null}
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
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm text-muted">
        <span>
          Puzzle <strong className="tabular-nums text-ink">{round}</strong> of {ROUNDS}
        </span>
        <span>{BALANCE_LEVELS[level].split(" — ")[0]}</span>
      </div>
      <div className="space-y-5 rounded-2xl bg-surface-2/60 p-4">
        {q.scales.map((s, i) => (
          <ScaleView key={`${round}-${i}`} left={s.left} right={s.right} />
        ))}
      </div>
      <div className="flex items-center justify-center gap-3 text-xl font-semibold">
        <span>One</span>
        <ShapeIcon s={q.ask} size={40} />
        <span>weighs how much?</span>
      </div>
      {note ? (
        <p className={`rounded-xl p-3 text-center font-medium ${note.kind === "ok" ? "bg-ok-soft text-ok" : note.kind === "bad" ? "bg-danger-soft text-danger" : "bg-accent-soft text-accent"}`} role="status">
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
