"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { fmt, type Currency } from "@/lib/moneyShop";
import { nextDrop, piggyMoney, piggyTarget, PIGGY_LEVELS, type PiggyLevel } from "@/lib/games/piggy";
import { Cash } from "./MoneyShop";
import { useBest } from "./useBest";

// 🐷 Piggy Bank Rain (P1–P3): coins and notes float down; tap the right ones to fill the piggy to exactly
// the amount. Too much? The coin bounces off. Fill 6 piggies as fast as you can.

const PIGGIES = 6;

/** A pink piggy bank. The gold inside rises as it fills up (pct 0–100). */
function PiggyBank({ pct, happy, size = 150 }: { pct: number; happy: boolean; size?: number }) {
  const level = 112 - (Math.min(100, pct) / 100) * 80; // y of the gold's top, inside the body
  return (
    <svg viewBox="0 0 180 140" width={size} height={size * (140 / 180)} aria-hidden style={{ filter: "drop-shadow(0 6px 6px rgba(0,0,0,.2))" }}>
      <defs>
        <radialGradient id="pb-body" cx="40%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#ffd3e2" />
          <stop offset="60%" stopColor="#f9a3c0" />
          <stop offset="100%" stopColor="#e27a9e" />
        </radialGradient>
        <linearGradient id="pb-gold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffe48a" />
          <stop offset="100%" stopColor="#e0a526" />
        </linearGradient>
        <clipPath id="pb-clip">
          <ellipse cx="88" cy="74" rx="62" ry="44" />
        </clipPath>
      </defs>
      {/* legs and tail */}
      <rect x="48" y="100" width="16" height="26" rx="6" fill="#e27a9e" />
      <rect x="108" y="100" width="16" height="26" rx="6" fill="#e27a9e" />
      <path d="M26 66 q-14 -4 -10 -14 q4 -8 10 0" fill="none" stroke="#e27a9e" strokeWidth="4" strokeLinecap="round" />
      {/* body */}
      <ellipse cx="88" cy="74" rx="62" ry="44" fill="url(#pb-body)" />
      {/* gold rising inside (seen through a window in the body) */}
      <g clipPath="url(#pb-clip)" opacity=".9">
        <rect x="20" y={level} width="140" height="80" fill="url(#pb-gold)" style={{ transition: "y .5s ease" }} />
        <path d={`M20 ${level} q17 -6 35 0 t35 0 t35 0 t35 0`} fill="#fff3b8" opacity=".7" style={{ transition: "d .5s ease" }} />
      </g>
      <ellipse cx="88" cy="74" rx="62" ry="44" fill="none" stroke="#d96b92" strokeWidth="2" />
      <ellipse cx="70" cy="50" rx="18" ry="8" fill="#fff" opacity=".35" />
      {/* coin slot */}
      <rect x="74" y="32" width="30" height="6" rx="3" fill="#8a3456" />
      {/* ear */}
      <path d="M118 38 l10 -20 l8 24 z" fill="#f48fb1" stroke="#d96b92" strokeWidth="2" strokeLinejoin="round" />
      {/* snout */}
      <ellipse cx="150" cy="78" rx="16" ry="13" fill="#f48fb1" stroke="#d96b92" strokeWidth="2" />
      <ellipse cx="145" cy="78" rx="2.6" ry="3.6" fill="#a83c66" />
      <ellipse cx="155" cy="78" rx="2.6" ry="3.6" fill="#a83c66" />
      {/* eye */}
      {happy ? <path d="M124 56 q5 -6 10 0" stroke="#3b1f2b" strokeWidth="3" fill="none" strokeLinecap="round" /> : <circle cx="129" cy="57" r="4" fill="#3b1f2b" />}
      <ellipse cx="134" cy="70" rx="6" ry="3.5" fill="#ff7aa5" opacity=".6" />
    </svg>
  );
}

/** A soft cloud. */
function Cloud({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 120 50" className={`absolute ${className}`} aria-hidden>
      <path d="M20 45 Q2 45 6 32 Q8 20 24 22 Q30 6 50 10 Q64 0 78 12 Q98 8 100 26 Q118 28 112 42 Q110 46 100 45Z" fill="#fff" opacity=".85" />
    </svg>
  );
}
const secs = (tenths: number) => `${(tenths / 10).toFixed(1)}s`;
type Drop = { id: number; v: number; left: number; dur: number };

export function PiggyRain() {
  const [currency, setCurrency] = useState<Currency>("THB");
  const [level, setLevel] = useState<PiggyLevel>("small");
  const [phase, setPhase] = useState<"setup" | "play" | "done">("setup");
  const [target, setTarget] = useState(0);
  const [inPig, setInPig] = useState(0);
  const [filled, setFilled] = useState(0);
  const [drops, setDrops] = useState<Drop[]>([]);
  const [bounce, setBounce] = useState<string | null>(null);
  const [happy, setHappy] = useState(false);
  const [startedAt, setStartedAt] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [newBest, setNewBest] = useState(false);
  const nextId = useRef(1);
  const left = useRef(0);
  const { best, offer } = useBest(`pb-${currency}-${level}`, (a, b) => a < b, "ds");
  const money = piggyMoney(currency, level);

  useEffect(() => {
    left.current = target - inPig;
  }, [target, inPig]);

  // New coins float down while playing (fewer at once for little ones).
  useEffect(() => {
    if (phase !== "play" || happy) return;
    const id = setInterval(() => {
      setDrops((d) =>
        d.length >= 8
          ? d
          : [...d, { id: nextId.current++, v: nextDrop(currency, level, Math.max(1, left.current)), left: 4 + Math.random() * 82, dur: 5 + Math.random() * 2.5 }],
      );
    }, 750);
    return () => clearInterval(id);
  }, [phase, happy, currency, level]);

  useEffect(() => {
    if (phase !== "play") return;
    const id = setInterval(() => setElapsed(Date.now() - startedAt), 100);
    return () => clearInterval(id);
  }, [phase, startedAt]);

  function start() {
    setTarget(piggyTarget(currency, level));
    setInPig(0);
    setFilled(0);
    setDrops([]);
    setHappy(false);
    setStartedAt(Date.now());
    setElapsed(0);
    setNewBest(false);
    setPhase("play");
  }

  const tap = useCallback(
    (d: Drop) => {
      if (happy) return;
      if (inPig + d.v > target) {
        setBounce(`Too much! ${fmt(d.v, currency)} won't fit.`);
        setTimeout(() => setBounce(null), 1100);
        setDrops((all) => all.filter((x) => x.id !== d.id));
        return;
      }
      setDrops((all) => all.filter((x) => x.id !== d.id));
      const now = inPig + d.v;
      setInPig(now);
      if (now === target) {
        setHappy(true);
        const done = filled + 1;
        setFilled(done);
        setTimeout(() => {
          if (done >= PIGGIES) {
            const t = Math.round((Date.now() - startedAt) / 100);
            setElapsed(t * 100);
            setNewBest(offer(t));
            setPhase("done");
            return;
          }
          setTarget((t) => piggyTarget(currency, level, Math.random, t));
          setInPig(0);
          setDrops([]);
          setHappy(false);
        }, 1100);
      }
    },
    [happy, inPig, target, currency, filled, startedAt, offer, level],
  );

  if (phase === "setup") {
    return (
      <div className="space-y-4">
        <div className="flex justify-center">
          <PiggyBank pct={45} happy={false} size={170} />
        </div>
        <p className="text-muted">Coins fall from the sky. Tap the right ones to fill the piggy bank with exactly the right amount. Fill {PIGGIES} piggies!</p>
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              ["THB", "🇹🇭 Thai baht"],
              ["USD", "🇺🇸 US dollars"],
            ] as const
          ).map(([c, label]) => (
            <button key={c} type="button" aria-pressed={currency === c} onClick={() => setCurrency(c)} className={`min-h-14 rounded-xl border-2 px-3 text-lg font-semibold ${currency === c ? "border-accent bg-accent-soft text-accent" : "border-line bg-surface"}`}>
              {label}
            </button>
          ))}
        </div>
        <div className="grid gap-2">
          {(Object.keys(PIGGY_LEVELS) as PiggyLevel[]).map((l) => (
            <button key={l} type="button" aria-pressed={level === l} onClick={() => setLevel(l)} className={`min-h-12 rounded-xl border px-4 text-left ${level === l ? "border-accent bg-accent-soft font-medium text-accent" : "border-line bg-surface"}`}>
              {PIGGY_LEVELS[l]}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2" aria-hidden>
          {money.map((m) => (
            <Cash key={m.value} m={m} c={currency} small />
          ))}
        </div>
        {best != null ? <p className="text-sm text-muted">Your fastest: {secs(best)}</p> : null}
        <button type="button" className="btn-primary w-full" onClick={start}>
          Start
        </button>
      </div>
    );
  }

  if (phase === "done") {
    return (
      <div className="space-y-4 text-center">
        <div className="flex justify-center">
          <span className="cq-m inline-block" style={{ animation: "pb-jump .6s ease 3" }}>
            <PiggyBank pct={100} happy size={170} />
          </span>
        </div>
        <style>{`@keyframes pb-jump{0%,100%{transform:translateY(0)}40%{transform:translateY(-16px) scale(1.05)}}`}</style>
        <p className="text-sm text-muted">All {PIGGIES} piggies are full!</p>
        <p className="text-5xl font-semibold tabular-nums">{secs(Math.round(elapsed / 100))}</p>
        <p className={newBest ? "font-medium text-ok" : "text-muted"}>{newBest ? "New fastest time! 🏆" : `Your fastest: ${best != null ? secs(best) : "—"}`}</p>
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

  const pct = Math.min(100, (inPig / target) * 100);
  return (
    <div className="space-y-3">
      <style>{`@keyframes pb-fall{from{transform:translateY(-70px)}to{transform:translateY(430px)}}@keyframes pb-jump{0%,100%{transform:translateY(0)}40%{transform:translateY(-14px) scale(1.08)}}@keyframes pb-shake{0%,100%{transform:none}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}`}</style>
      <div className="flex items-center justify-between text-sm text-muted">
        <span>
          Piggy <strong className="text-ink tabular-nums">{Math.min(filled + 1, PIGGIES)}</strong> of {PIGGIES}
        </span>
        <span className="tabular-nums">{secs(Math.round(elapsed / 100))}</span>
      </div>
      <div className="relative h-[430px] overflow-hidden rounded-3xl shadow-[0_8px_24px_rgba(0,0,0,.18)]" style={{ background: "linear-gradient(#7cc8f5, #c9ecff 72%)" }}>
        <Cloud className="left-[6%] top-[8%] w-28 opacity-90" />
        <Cloud className="right-[8%] top-[22%] w-20 opacity-70" />
        <Cloud className="left-[42%] top-[3%] w-16 opacity-60" />
        <div className="absolute inset-x-0 bottom-0 h-[30%]" style={{ background: "linear-gradient(#8ad46f, #5fae4c)" }} aria-hidden>
          <span className="absolute left-[8%] top-1 text-2xl">🌷</span>
          <span className="absolute right-[10%] top-3 text-2xl">🌼</span>
          <span className="absolute left-[30%] top-6 text-lg">🌱</span>
          <span className="absolute right-[32%] top-7 text-lg">🌱</span>
        </div>
        {drops.map((d) => (
          <button
            key={d.id}
            type="button"
            aria-label={`Catch ${fmt(d.v, currency)}`}
            onClick={() => tap(d)}
            onAnimationEnd={() => setDrops((all) => all.filter((x) => x.id !== d.id))}
            className="absolute top-0 p-1.5"
            style={{ left: `${d.left}%`, animation: `pb-fall ${d.dur}s linear forwards`, translate: "-50% 0" }}
          >
            <Cash m={money.find((m) => m.value === d.v) ?? { value: d.v, kind: "coin" }} c={currency} />
          </button>
        ))}
        <div className="pointer-events-none absolute inset-x-0 bottom-3 flex flex-col items-center">
          {bounce ? <p className="mb-1 rounded-full bg-white px-3 py-1 text-sm font-semibold text-danger shadow" style={{ animation: "pb-shake .35s" }}>{bounce}</p> : null}
          {happy ? <p className="mb-1 rounded-full bg-white px-3 py-1 text-sm font-semibold text-ok shadow">Full! 🎉</p> : null}
          <span className="leading-none" style={happy ? { animation: "pb-jump .5s ease 2" } : undefined}>
            <PiggyBank pct={pct} happy={happy} size={160} />
          </span>
          <div className="mt-1 rounded-2xl bg-white/95 px-4 py-1.5 text-center text-[#1f2a36] shadow-lg">
            <p className="text-sm font-semibold">
              Fill me with <span className="text-lg text-[#c2410c]">{fmt(target, currency)}</span>
            </p>
            <div className="mt-1 h-2.5 w-44 overflow-hidden rounded-full bg-black/10">
              <div className="h-full rounded-full bg-gradient-to-r from-[#ffd84d] to-[#e0a526] transition-all" style={{ width: `${pct}%` }} />
            </div>
            <p className="mt-0.5 text-xs tabular-nums">
              {fmt(inPig, currency)} in the piggy · {fmt(target - inPig, currency)} to go
            </p>
          </div>
        </div>
      </div>
      <button type="button" className="btn-secondary w-full text-sm" onClick={() => (setInPig(0), setBounce(null))}>
        Shake the piggy empty and start again
      </button>
    </div>
  );
}
