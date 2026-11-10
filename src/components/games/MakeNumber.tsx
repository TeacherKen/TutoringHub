"use client";
import { useState } from "react";
import { apply, makeNumber, MN_LEVELS, type MNLevel, type MNPuzzle, type Op } from "@/lib/games/makeNumber";
import { useBest } from "./useBest";
import { BigButton, GameHero, LevelPicker, ResultCard, THEMES } from "./GameKit";

const T = THEMES.felt;

// 🎯 Make the Number: tap a card, a sign, then another card — they join into a new card.
// Use every card once and finish on the target number.

const PUZZLES = 5;
const OPS: Op[] = ["+", "−", "×", "÷"];
type Card = { id: number; v: number; made?: string };
const secs = (ms: number) => `${(ms / 1000).toFixed(0)}s`;
const OP_COLOUR: Record<Op, string> = { "+": "#16a34a", "−": "#2563eb", "×": "#ea580c", "÷": "#9333ea" };

/** The target: an archery board with the number in the middle. */
function TargetBoard({ n, hit }: { n: number; hit: boolean }) {
  return (
    <div className={`pz-anim relative mx-auto grid h-36 w-36 place-items-center ${hit ? "animate-[tt-pop_.5s_ease-out]" : ""}`}>
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full drop-shadow-lg" aria-hidden>
        <circle cx="50" cy="50" r="49" fill="#f8fafc" />
        <circle cx="50" cy="50" r="41" fill="#ef4444" />
        <circle cx="50" cy="50" r="33" fill="#f8fafc" />
        <circle cx="50" cy="50" r="25" fill="#ef4444" />
        <circle cx="50" cy="50" r="18" fill="#facc15" />
      </svg>
      <span className="relative text-4xl font-black tabular-nums text-[#1f2a44] [text-shadow:0_1px_0_#fff]">{n}</span>
    </div>
  );
}

/** A number card, like a playing card (numbers in the corners). Joined cards are gold. */
function NumberCard({ v, made, picked, done, onClick }: { v: number; made?: string; picked: boolean; done: boolean; onClick: () => void }) {
  const face = made ? "linear-gradient(160deg, #fff7d6, #fde68a)" : "linear-gradient(160deg, #ffffff, #eef2ff)";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={picked}
      aria-label={made ? `${v}, made from ${made}` : `${v}`}
      className={`pz-anim relative flex h-28 w-20 flex-col items-center justify-center rounded-2xl border-2 text-[42px] font-black tabular-nums text-[#1f2a44] transition duration-150 active:scale-95 sm:h-32 sm:w-24 ${
        picked ? "-translate-y-2 border-accent shadow-[0_10px_24px_rgba(13,148,136,.45)]" : done ? "border-[#16a34a] shadow-md" : "border-white shadow-[0_4px_10px_rgba(15,23,42,.18)]"
      } ${made ? "animate-[tt-pop_.35s_ease-out]" : ""}`}
      style={{ background: face }}
    >
      <span className="absolute left-2 top-1 text-xs font-bold opacity-50">{v}</span>
      <span className="absolute bottom-1 right-2 rotate-180 text-xs font-bold opacity-50">{v}</span>
      {v}
      {made ? <span className="mt-0.5 rounded-full bg-white/70 px-1.5 text-[11px] font-semibold text-[#92400e]">{made}</span> : null}
    </button>
  );
}

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
  const { best, offer } = useBest(`mn-${level}`, (a, b) => a < b, "s");
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
    setNote({ ok: false, text: `💡 ${k === 0 ? "Start with" : "Then"} ${s.a} ${s.op} ${s.b} = ${s.r}${k === 0 && cards.length < puzzle.cards.length ? " (tap ⟲ Restart first)" : ""}` });
  }

  if (phase === "setup")
    return (
      <div className="space-y-4">
        <GameHero theme={T} art="🎯" title="MAKE THE NUMBER">
          Join the number cards with + − × ÷ to hit the target. Use every card once! {PUZZLES} puzzles: how fast can you go?
        </GameHero>
        <div className="flex items-center justify-center gap-3 rounded-2xl p-3" style={{ background: `radial-gradient(120% 100% at 30% 0%, ${T.from}, ${T.to})` }} aria-hidden>
          {[3, 8].map((v, i) => (
            <span key={i} className="grid h-16 w-12 place-items-center rounded-xl bg-white text-2xl font-black text-[#1f2a44] shadow-[0_4px_0_rgba(0,0,0,.25)]">
              {v}
            </span>
          ))}
          <span className="text-3xl font-black text-[#ffd84d]">×</span>
          <span className="text-2xl font-black text-white">=</span>
          <span className="-my-6 scale-75">
            <TargetBoard n={24} hit={false} />
          </span>
        </div>
        <LevelPicker theme={T} levels={(Object.keys(MN_LEVELS) as MNLevel[]).map((l) => [l, MN_LEVELS[l].label] as [MNLevel, string])} value={level} onChange={setLevel} />
        {best != null ? <p className="text-center text-sm text-muted">⏱️ Your fastest: {secs(best * 1000)}</p> : null}
        <BigButton theme={T} onClick={start}>
          ▶ Start
        </BigButton>
      </div>
    );

  if (phase === "done")
    return (
      <ResultCard
        theme={T}
        art="🎯"
        label={`All ${PUZZLES} targets hit in`}
        big={secs(took)}
        newBest={newBest}
        bestText={`Your fastest: ${best != null ? secs(best * 1000) : "—"}`}
        onAgain={start}
        onChange={() => setPhase("setup")}
      />
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
      <div className="rounded-3xl p-4 pb-5 shadow-inner" style={{ background: "radial-gradient(120% 90% at 50% 0%, #2b6b4f 0%, #1d4d39 70%)" }}>
        <p className="mb-1 text-center text-xs font-bold tracking-[0.25em] text-white/70">MAKE THIS NUMBER</p>
        <TargetBoard n={puzzle.target} hit={!!note?.ok} />
        <div className="mt-4 flex min-h-32 flex-wrap items-center justify-center gap-3">
          {cards.map((c) => (
            <NumberCard key={c.id} v={c.v} made={c.made} picked={pickA === c.id} done={!!note?.ok} onClick={() => tapCard(c)} />
          ))}
        </div>
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
              className="h-16 rounded-full text-4xl font-black text-white transition active:scale-95 disabled:opacity-35"
              style={{
                background: `radial-gradient(circle at 35% 30%, color-mix(in srgb, ${OP_COLOUR[o]}, #fff 30%), ${OP_COLOUR[o]})`,
                boxShadow: op === o ? `0 0 0 4px #fff, 0 0 0 7px ${OP_COLOUR[o]}` : "inset 0 -4px 0 rgba(0,0,0,.2)",
              }}
            >
              {o}
            </button>
          );
        })}
      </div>
      <p className={`pz-anim min-h-12 rounded-2xl p-3 text-center font-medium ${note ? (note.ok ? "animate-[tt-pop_.4s_ease-out] bg-ok-soft text-ok" : "bg-accent-soft text-accent") : "text-muted"}`} role="status">
        {note?.text ?? (pickA == null ? "Tap a card." : op == null ? "Now tap a sign." : "Now tap another card.")}
      </p>
      <div className="grid grid-cols-3 gap-2">
        <button type="button" className="btn-secondary" onClick={undo} disabled={!history.length || !!note?.ok}>
          ↩ Undo
        </button>
        <button type="button" className="btn-secondary" onClick={reset} disabled={!history.length || !!note?.ok}>
          ⟲ Restart
        </button>
        <button type="button" className="btn-secondary" onClick={hint} disabled={!!note?.ok}>
          💡 Hint
        </button>
      </div>
    </div>
  );
}
