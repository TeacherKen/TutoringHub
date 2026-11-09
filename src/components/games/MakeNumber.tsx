"use client";
import { useState } from "react";
import { apply, makeNumber, MN_LEVELS, type MNLevel, type MNPuzzle, type Op } from "@/lib/games/makeNumber";
import { useBest } from "./useBest";

// 🎯 Make the Number: tap a card, a sign, then another card — they join into a new card.
// Use every card once and finish on the target number.

const PUZZLES = 5;
const OPS: Op[] = ["+", "−", "×", "÷"];
type Card = { id: number; v: number; made?: string };
const secs = (ms: number) => `${(ms / 1000).toFixed(0)}s`;

export function MakeNumber() {
  const [level, setLevel] = useState<MNLevel>("easy");
  const [phase, setPhase] = useState<"setup" | "play" | "done">("setup");
  const [puzzle, setPuzzle] = useState<MNPuzzle | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [history, setHistory] = useState<Card[][]>([]);
  const [pickA, setPickA] = useState<number | null>(null);
  const [op, setOp] = useState<Op | null>(null);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [hints, setHints] = useState(0);
  const [solvedCount, setSolvedCount] = useState(0);
  const [startedAt, setStartedAt] = useState(0);
  const [took, setTook] = useState(0);
  const [newBest, setNewBest] = useState(false);
  const { best, offer } = useBest(`mn-${level}`, (a, b) => a < b);
  const L = MN_LEVELS[level];

  function load(p: MNPuzzle) {
    setPuzzle(p);
    setCards(p.cards.map((v, i) => ({ id: i, v })));
    setHistory([]);
    setPickA(null);
    setOp(null);
    setNote(null);
    setHints(0);
  }
  function start() {
    setSolvedCount(0);
    setStartedAt(Date.now());
    load(makeNumber(level));
    setPhase("play");
  }

  function tapCard(c: Card) {
    if (note?.ok) return;
    if (pickA == null || op == null) {
      setPickA(pickA === c.id ? null : c.id);
      setNote(null);
      return;
    }
    if (c.id === pickA) {
      setPickA(null);
      setOp(null);
      return;
    }
    const a = cards.find((x) => x.id === pickA)!;
    const r = apply(a.v, op, c.v);
    if (r == null) {
      setNote({ ok: false, text: op === "−" ? `${a.v} − ${c.v} goes below zero. Try the bigger number first.` : `${a.v} ÷ ${c.v} doesn't share equally.` });
      setOp(null);
      return;
    }
    const made: Card = { id: Math.max(...cards.map((x) => x.id)) + 1, v: r, made: `${a.v} ${op} ${c.v}` };
    const next = cards.filter((x) => x.id !== a.id && x.id !== c.id).concat(made);
    setHistory((h) => [...h, cards]);
    setCards(next);
    setPickA(null);
    setOp(null);
    if (next.length === 1) {
      if (r === puzzle!.target) {
        setNote({ ok: true, text: `${r}! You made it! 🎯` });
        setTimeout(() => {
          const done = solvedCount + 1;
          setSolvedCount(done);
          if (done >= PUZZLES) {
            const t = Date.now() - startedAt;
            setTook(t);
            setNewBest(offer(Math.round(t / 1000)));
            setPhase("done");
          } else load(makeNumber(level));
        }, 1200);
      } else setNote({ ok: false, text: `That makes ${r}, not ${puzzle!.target}. Tap ↩ Undo and try another way.` });
    } else setNote(null);
  }

  function undo() {
    const prev = history[history.length - 1];
    if (!prev) return;
    setCards(prev);
    setHistory((h) => h.slice(0, -1));
    setPickA(null);
    setOp(null);
    setNote(null);
  }
  function reset() {
    if (!puzzle) return;
    setCards(puzzle.cards.map((v, i) => ({ id: i, v })));
    setHistory([]);
    setPickA(null);
    setOp(null);
    setNote(null);
  }
  function hint() {
    if (!puzzle?.steps.length) return;
    const k = Math.min(hints, puzzle.steps.length - 1);
    const s = puzzle.steps[k];
    setHints(k + 1);
    setNote({ ok: false, text: `💡 ${k === 0 ? "Start with" : "Then"} ${s.a} ${s.op} ${s.b} = ${s.r}${k === 0 && cards.length < puzzle.cards.length ? " (tap Start again first)" : ""}` });
  }

  if (phase === "setup")
    return (
      <div className="space-y-4">
        <p className="text-center text-6xl" aria-hidden>
          🎯
        </p>
        <p className="text-muted">Join the number cards with + − × ÷ to make the target number. Use every card once! {PUZZLES} puzzles — how fast can you go?</p>
        <div className="grid gap-2">
          {(Object.keys(MN_LEVELS) as MNLevel[]).map((l) => (
            <button key={l} type="button" aria-pressed={level === l} onClick={() => setLevel(l)} className={`min-h-12 rounded-xl border px-4 text-left ${level === l ? "border-accent bg-accent-soft font-medium text-accent" : "border-line bg-surface"}`}>
              {MN_LEVELS[l].label}
            </button>
          ))}
        </div>
        {best != null ? <p className="text-sm text-muted">Your fastest: {secs(best * 1000)}</p> : null}
        <button type="button" className="btn-primary w-full" onClick={start}>
          Start
        </button>
      </div>
    );

  if (phase === "done")
    return (
      <div className="space-y-4 text-center">
        <p className="text-6xl" aria-hidden>
          🎯🎉
        </p>
        <p className="text-sm text-muted">All {PUZZLES} targets hit!</p>
        <p className="text-5xl font-semibold tabular-nums">{secs(took)}</p>
        <p className={newBest ? "font-medium text-ok" : "text-muted"}>{newBest ? "New fastest time! 🏆" : `Your fastest: ${best != null ? secs(best * 1000) : "—"}`}</p>
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

  if (!puzzle) return null;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm text-muted">
        <span>
          Puzzle <strong className="tabular-nums text-ink">{solvedCount + 1}</strong> of {PUZZLES}
        </span>
        <button type="button" className="btn-quiet min-h-10 px-2 text-sm" onClick={() => load(makeNumber(level))}>
          New numbers ↻
        </button>
      </div>
      <div className="rounded-2xl bg-[#1f2a44] p-4 text-center text-white">
        <p className="text-xs font-semibold tracking-[0.2em] text-white/70">MAKE</p>
        <p className="text-6xl font-bold tabular-nums">{puzzle.target}</p>
      </div>
      <div className="flex min-h-28 flex-wrap items-center justify-center gap-3">
        {cards.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => tapCard(c)}
            aria-pressed={pickA === c.id}
            className={`flex h-24 w-20 flex-col items-center justify-center rounded-2xl border-4 bg-white text-4xl font-bold tabular-nums text-[#1f2a44] shadow-md transition active:scale-95 ${pickA === c.id ? "-translate-y-1 border-accent" : note?.ok ? "border-ok" : "border-[#d4d4d8]"}`}
          >
            {c.v}
            {c.made ? <span className="mt-0.5 text-[11px] font-medium text-[#71717a]">{c.made}</span> : null}
          </button>
        ))}
      </div>
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${L.ops.length}, minmax(0, 1fr))` }}>
        {OPS.filter((o) => L.ops.includes(o)).map((o) => {
          return (
            <button
              key={o}
              type="button"
              disabled={pickA == null || !!note?.ok}
              onClick={() => setOp(op === o ? null : o)}
              aria-pressed={op === o}
              aria-label={{ "+": "add", "−": "take away", "×": "times", "÷": "divide" }[o]}
              className={`h-16 rounded-2xl text-4xl font-bold transition active:scale-95 disabled:opacity-30 ${op === o ? "bg-accent text-accent-text" : "bg-surface-2"}`}
            >
              {o}
            </button>
          );
        })}
      </div>
      <p className={`min-h-12 rounded-xl p-3 text-center font-medium ${note ? (note.ok ? "bg-ok-soft text-ok" : "bg-accent-soft text-accent") : "text-muted"}`} role="status">
        {note?.text ?? (pickA == null ? "Tap a card." : op == null ? "Now tap a sign." : "Now tap another card.")}
      </p>
      <div className="grid grid-cols-3 gap-2">
        <button type="button" className="btn-secondary" onClick={undo} disabled={!history.length || !!note?.ok}>
          ↩ Undo
        </button>
        <button type="button" className="btn-secondary" onClick={reset} disabled={!history.length || !!note?.ok}>
          Start again
        </button>
        <button type="button" className="btn-secondary" onClick={hint} disabled={!!note?.ok}>
          💡 Hint
        </button>
      </div>
    </div>
  );
}
