"use client";
import { useState } from "react";
import { apply, makeNumber, MN_LEVELS, type MNLevel, type MNPuzzle, type Op } from "@/lib/games/makeNumber";
import { useBest } from "./useBest";
import { BigButton, GameHero, HowToPlay, LevelPicker, ResultCard, THEMES } from "./GameKit";

const T = THEMES.felt;

// Make the Number: a card duel! The boss (a zombie or a robot) hides behind 5 number shields.
// Tap a card, a chip (+ − × ÷), then another card: they join into a new gold card. Use every card
// once and finish on the shield's number to smash it. Break all 5 shields to win.
// (Characters: Kenney "Toon Characters"; chips and card backs: "Boardgame Pack". All CC0.)

const ART = "/games/art";
const BOSSES = [
  { name: "Zed the Zombie", key: "zombie" },
  { name: "Bolt the Robot", key: "robot" },
] as const;
const CHIP: Record<Op, string> = { "+": "chipGreenWhite", "−": "chipBlueWhite", "×": "chipRedWhite", "÷": "chipBlackWhite" };
function Pic({ src, className = "", style }: { src: string; className?: string; style?: React.CSSProperties }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" aria-hidden draggable={false} className={`pointer-events-none select-none object-contain ${className}`} style={style} />;
}

const PUZZLES = 5;
const OPS: Op[] = ["+", "−", "×", "÷"];
type Card = { id: number; v: number; made?: string };
const secs = (ms: number) => `${(ms / 1000).toFixed(0)}s`;
const OP_COLOUR: Record<Op, string> = { "+": "#16a34a", "−": "#2563eb", "×": "#ea580c", "÷": "#9333ea" };

/** A round wooden shield with the number to make painted on it. */
function Shield({ n, size = 112, broken = false }: { n: number | null; size?: number; broken?: boolean }) {
  return (
    <span className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full drop-shadow-[0_4px_4px_rgba(0,0,0,.35)]" aria-hidden>
        <circle cx="50" cy="50" r="48" fill={broken ? "#6b7280" : "#8a5a2b"} stroke={broken ? "#4b5563" : "#5b3415"} strokeWidth="3" />
        <circle cx="50" cy="50" r="38" fill={broken ? "#9ca3af" : "#c98a4b"} />
        {[0, 1, 2, 3, 4, 5, 6, 7].map((k) => (
          <circle key={k} cx={[50, 79, 90, 79, 50, 21, 10, 21][k]} cy={[10, 21, 50, 79, 90, 79, 50, 21][k]} r="3" fill={broken ? "#d1d5db" : "#ffd84d"} />
        ))}
        <circle cx="50" cy="50" r="27" fill={broken ? "#e5e7eb" : "#fff7e6"} stroke={broken ? "#9ca3af" : "#e0a526"} strokeWidth="3" />
        {broken ? <path d="M30 18 L46 44 L36 58 L54 86 M60 14 L52 40 L70 62" stroke="#374151" strokeWidth="3.5" fill="none" strokeLinecap="round" strokeLinejoin="round" /> : null}
      </svg>
      {n != null ? (
        <span className="relative font-black tabular-nums text-[#3b1a0a]" style={{ fontSize: size * 0.3 }}>
          {n}
        </span>
      ) : null}
    </span>
  );
}

/** A number card, like a playing card (numbers in the corners). Joined cards are gold. */
function NumberCard({ v, made, picked, done, onClick }: { v: number; made?: string; picked: boolean; done: boolean; onClick: () => void }) {
  const face = made ? "linear-gradient(160deg, #fff7d6, #fde68a)" : "linear-gradient(160deg, #ffffff, #f4f1ea)";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={picked}
      aria-label={made ? `${v}, made from ${made}` : `${v}`}
      className={`pz-anim relative flex h-28 w-20 flex-col items-center justify-center rounded-2xl border-2 text-[42px] font-black tabular-nums text-[#1f2a44] transition duration-150 active:scale-95 sm:h-32 sm:w-24 ${
        picked ? "-translate-y-3 border-[#ffd84d] shadow-[0_0_0_3px_#ffd84d,0_12px_24px_rgba(0,0,0,.45)]" : done ? "border-[#16a34a] shadow-md" : "border-white shadow-[0_4px_10px_rgba(15,23,42,.18)]"
      } ${made ? "animate-[tt-pop_.35s_ease-out]" : ""}`}
      style={{ background: face }}
    >
      <span className="absolute inset-1.5 rounded-xl border border-[#c2412d]/25" aria-hidden />
      <span className="absolute left-2 top-1 text-xs font-bold text-[#c2412d]">{v}</span>
      <span className="absolute bottom-1 right-2 rotate-180 text-xs font-bold text-[#c2412d]">{v}</span>
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
  const [boss, setBoss] = useState(0);
  const [laugh, setLaugh] = useState(0); // counts wrong totals: the boss laughs each time
  const [deal, setDeal] = useState(0); // counts puzzles, so new cards are dealt in
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
    setLaugh(0);
    setDeal((d) => d + 1);
  }
  function start() {
    setBoss(Math.floor(Math.random() * BOSSES.length));
    setLaugh(0);
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
        setNote({ ok: true, text: `${r}! Smash! The shield breaks!` });
        setTimeout(() => {
          const done = solvedCount + 1;
          setSolvedCount(done);
          if (done >= PUZZLES) {
            const t = Date.now() - startedAt;
            setTook(t);
            setNewBest(offer(Math.round(t / 1000)));
            setPhase("done");
          } else load(makeNumber(level));
        }, 1600);
      } else {
        setLaugh((x) => x + 1);
        setNote({ ok: false, text: `That makes ${r}, not ${puzzle!.target}. Tap Undo and try another way.` });
      }
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
    setLaugh(0);
  }
  function reset() {
    if (!puzzle) return;
    setCards(puzzle.cards.map((v, i) => ({ id: i, v })));
    setHistory([]);
    setPickA(null);
    setOp(null);
    setNote(null);
    setLaugh(0);
  }
  function hint() {
    if (!puzzle?.steps.length) return;
    const k = Math.min(hints, puzzle.steps.length - 1);
    const s = puzzle.steps[k];
    setHints(k + 1);
    setNote({ ok: false, text: `Hint: ${k === 0 ? "Start with" : "Then"} ${s.a} ${s.op} ${s.b} = ${s.r}${k === 0 && cards.length < puzzle.cards.length ? " (tap Restart first)" : ""}` });
  }

  if (phase === "setup")
    return (
      <div className="space-y-4">
        <GameHero theme={T} art={null} title="MAKE THE NUMBER">
          A card duel! The boss hides behind {PUZZLES} number shields. Join your cards with + − × ÷ to make each shield&apos;s number and smash it!
        </GameHero>
        <HowToPlay
          theme={T}
          open
          steps={[
            "The boss holds a shield with a number on it. Your job: make that number with your cards.",
            <>Tap a <strong>card</strong>, then a <strong>chip</strong> (+ − × ÷), then <strong>another card</strong>. They join into one new gold card.</>,
            "Keep joining until only one card is left. You must use every card!",
            "If your last card matches the shield, it smashes! Break all 5 shields to win.",
            <>Stuck? Tap <strong>Undo</strong>, <strong>Restart</strong> or <strong>Hint</strong>.</>,
          ]}
        />
        <div className="flex items-center justify-center gap-3 rounded-2xl p-3" style={{ background: `radial-gradient(120% 100% at 30% 0%, ${T.from}, ${T.to})` }} aria-hidden>
          <span className="grid h-16 w-12 place-items-center rounded-xl bg-white text-2xl font-black text-[#1f2a44] shadow-[0_4px_0_rgba(0,0,0,.25)]">3</span>
          <Chip op="×" size={48} />
          <span className="grid h-16 w-12 place-items-center rounded-xl bg-white text-2xl font-black text-[#1f2a44] shadow-[0_4px_0_rgba(0,0,0,.25)]">8</span>
          <span className="text-2xl font-black text-white">=</span>
          <Shield n={24} size={76} />
        </div>
        <LevelPicker theme={T} levels={(Object.keys(MN_LEVELS) as MNLevel[]).map((l) => [l, MN_LEVELS[l].label] as [MNLevel, string])} value={level} onChange={setLevel} />
        {best != null ? <p className="text-center text-sm text-muted">Your fastest: {secs(best * 1000)}</p> : null}
        <BigButton theme={T} onClick={start}>
          ▶ Start
        </BigButton>
      </div>
    );

  if (phase === "done")
    return (
      <ResultCard
        theme={T}
        art={null}
        label={`${BOSSES[boss].name} is beaten! All ${PUZZLES} shields smashed in`}
        big={secs(took)}
        newBest={newBest}
        bestText={`Your fastest: ${best != null ? secs(best * 1000) : "—"}`}
        onAgain={start}
        onChange={() => setPhase("setup")}
      >
        <div className="flex items-end justify-center gap-3" aria-hidden>
          <Pic src={`${ART}/heroes/femaleAdventurer_cheer0.png`} className="h-24 w-20 animate-[gk-cheer_.9s_ease-in-out_infinite]" />
          <Pic src={`${ART}/heroes/${BOSSES[boss].key}_hurt.png`} className="h-20 w-16 rotate-[80deg] opacity-80" />
        </div>
      </ResultCard>
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
      <Duel boss={boss} shields={PUZZLES} broken={solvedCount} target={puzzle.target} hit={!!note?.ok} laugh={laugh} />
      <div className="rounded-3xl p-3 shadow-inner" style={{ background: "radial-gradient(120% 90% at 50% 0%, #2b6b4f 0%, #1d4d39 70%)", boxShadow: "inset 0 0 0 4px #b8892a, inset 0 0 0 6px #5e420f" }}>
        <p className="mb-1 text-center text-xs font-bold tracking-[0.25em] text-white/70">YOUR CARDS</p>
        <div key={deal} className="flex min-h-32 flex-wrap items-center justify-center gap-3">
          {cards.map((c, i) => (
            <span key={c.id} className="inline-block" style={c.made ? undefined : { animation: `mn-deal .45s ease-out ${i * 0.08}s both` }}>
              <NumberCard v={c.v} made={c.made} picked={pickA === c.id} done={!!note?.ok} onClick={() => tapCard(c)} />
            </span>
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
              className={`mx-auto grid place-items-center rounded-full transition active:scale-90 disabled:opacity-35 ${op === o ? "-translate-y-1.5 shadow-[0_0_0_4px_#ffd84d,0_8px_14px_rgba(0,0,0,.35)]" : ""}`}
            >
              <Chip op={o} size={64} />
            </button>
          );
        })}
      </div>
      <p className={`pz-anim min-h-12 rounded-2xl p-3 text-center font-medium ${note ? (note.ok ? "animate-[tt-pop_.4s_ease-out] bg-ok-soft text-ok" : "bg-accent-soft text-accent") : "bg-surface-2 text-ink"}`} role="status">
        {note?.text ?? (pickA == null ? "Step 1: tap a card." : op == null ? "Step 2: tap a chip: + − × or ÷" : "Step 3: tap another card to join them.")}
      </p>
      <div className="grid grid-cols-3 gap-2">
        <button type="button" className="btn-secondary" onClick={undo} disabled={!history.length || !!note?.ok}>
          Undo
        </button>
        <button type="button" className="btn-secondary" onClick={reset} disabled={!history.length || !!note?.ok}>
          Restart
        </button>
        <button type="button" className="btn-secondary" onClick={hint} disabled={!!note?.ok}>
          Hint
        </button>
      </div>
    </div>
  );
}

/** A poker chip with a maths sign on it. */
function Chip({ op, size }: { op: Op; size: number }) {
  return (
    <span className="relative grid place-items-center" style={{ width: size, height: size }}>
      <Pic src={`${ART}/cards/${CHIP[op]}.png`} className="absolute inset-0 h-full w-full drop-shadow-[0_3px_2px_rgba(0,0,0,.35)]" />
      <span className="relative grid place-items-center rounded-full bg-white font-black leading-none text-[#1f2a44] shadow-inner" style={{ width: size * 0.5, height: size * 0.5, fontSize: size * 0.36 }}>
        {op}
      </span>
    </span>
  );
}

/**
 * The duel: you on the left, the boss on the right behind a shield with today's number.
 * A right answer throws a card that smashes the shield; a wrong total makes the boss laugh.
 */
function Duel({ boss, shields, broken, target, hit, laugh }: { boss: number; shields: number; broken: number; target: number; hit: boolean; laugh: number }) {
  const b = BOSSES[boss];
  const last = hit && broken + 1 >= shields;
  const pose = last ? "hurt" : hit ? "hurt" : laugh ? "cheer0" : "idle";
  return (
    <div className="relative h-52 overflow-hidden rounded-3xl shadow-[0_6px_18px_rgba(0,0,0,.25)] sm:h-56" style={{ background: "radial-gradient(120% 100% at 50% 0%, #3b2a6b 0%, #1a1233 80%)" }}>
      <style>{`@keyframes mn-deal{from{transform:translateY(-40px) rotate(-12deg) scale(.6);opacity:0}to{transform:none;opacity:1}}@keyframes mn-throw{0%{transform:translate(0,0) rotate(0);opacity:1}100%{transform:translate(var(--dx),-10px) rotate(540deg);opacity:1}}@keyframes mn-boom{0%{transform:scale(.2);opacity:0}30%{transform:scale(1.2);opacity:1}100%{transform:scale(1.5);opacity:0}}@keyframes mn-laugh{0%,100%{transform:none}25%{transform:translateY(-6px) rotate(-4deg)}50%{transform:none}75%{transform:translateY(-6px) rotate(4deg)}}@keyframes mn-fall{0%{transform:none}100%{transform:translateX(20px) rotate(85deg);opacity:.6}}@keyframes mn-hp{0%{transform:scale(1.4)}100%{transform:none}}`}</style>
      {/* table edge */}
      <div className="absolute inset-x-0 bottom-0 h-10" style={{ background: "linear-gradient(#2b6b4f,#1d4d39)", boxShadow: "inset 0 4px 0 #b8892a" }} />
      {/* name and shields left */}
      <div className="absolute right-2 top-2 flex flex-col items-end gap-1">
        <span className="rounded-full bg-black/40 px-2 py-0.5 text-xs font-bold text-white">{b.name}</span>
        <div className="flex gap-0.5" aria-label={`${shields - broken} shields left`}>
          {Array.from({ length: shields }, (_, i) => (
            <span key={i} style={i === broken - 1 ? { animation: "mn-hp .4s ease-out" } : undefined}>
              <Shield n={null} size={22} broken={i < broken} />
            </span>
          ))}
        </div>
      </div>
      {/* you */}
      <div className="absolute bottom-3 left-[6%] w-20 sm:w-24">
        <Pic src={`${ART}/heroes/femaleAdventurer_${hit ? "attack1" : "idle"}.png`} className="h-36 w-full sm:h-40" />
      </div>
      {/* the thrown card */}
      {hit ? (
        <Pic
          src={`${ART}/cards/cardBack_red2.png`}
          className="absolute bottom-24 left-[22%] h-12 w-9"
          style={{ ["--dx" as string]: "min(42vw, 330px)", animation: "mn-throw .45s ease-in forwards" } as React.CSSProperties}
        />
      ) : null}
      {/* the boss and the shield */}
      <div className="absolute bottom-3 right-[6%] w-24 sm:w-28">
        <div key={`${laugh}-${hit}`} style={{ animation: last ? "mn-fall .7s ease-in .45s forwards" : laugh && !hit ? "mn-laugh .7s ease" : undefined }}>
          <Pic src={`${ART}/heroes/${b.key}_${pose}.png`} className="h-36 w-full -scale-x-100 sm:h-40" />
        </div>
        {!hit && laugh ? (
          <span key={laugh} className="absolute -left-16 top-0 whitespace-nowrap rounded-xl bg-white px-2 py-1 text-xs font-bold text-[#7a1f1f] shadow" style={{ animation: "mn-deal .3s ease-out" }}>
            Ha ha! Wrong number!
          </span>
        ) : null}
      </div>
      <div className="absolute bottom-6 right-[calc(6%+5.5rem)] sm:right-[calc(6%+6.5rem)]">
        <span key={target} className="block" style={{ animation: "mn-deal .4s ease-out" }}>
          <Shield n={hit ? null : target} broken={hit} size={96} />
        </span>
        {hit ? <Pic src={`${ART}/robots/boom.png`} className="absolute inset-0 h-full w-full" style={{ animation: "mn-boom .6s ease-out .4s both" }} /> : null}
      </div>
    </div>
  );
}
