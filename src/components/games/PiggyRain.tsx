"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { fmt, type Currency } from "@/lib/moneyShop";
import { nextDrop, piggyMoney, piggyTarget, PIGGY_LEVELS, type PiggyLevel } from "@/lib/games/piggy";
import { Cash } from "./MoneyShop";
import { useBest } from "./useBest";

// 🐷 Piggy Bank Rain (P1–P3): coins and notes float down; tap the right ones to fill the piggy to exactly
// the amount. Too much? The coin bounces off. Fill 6 piggies as fast as you can.

const PIGGIES = 6;
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
  const { best, offer } = useBest(`pb-${currency}-${level}`, (a, b) => a < b);
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
        <p className="text-center text-6xl" aria-hidden>
          🐷
        </p>
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
        <p className="text-6xl" aria-hidden>
          🐷🎉
        </p>
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
      <style>{`@keyframes pb-fall{from{transform:translateY(-70px)}to{transform:translateY(430px)}}@keyframes pb-jump{0%,100%{transform:translateY(0)}40%{transform:translateY(-14px) scale(1.08)}}`}</style>
      <div className="flex items-center justify-between text-sm text-muted">
        <span>
          Piggy <strong className="text-ink tabular-nums">{Math.min(filled + 1, PIGGIES)}</strong> of {PIGGIES}
        </span>
        <span className="tabular-nums">{secs(Math.round(elapsed / 100))}</span>
      </div>
      <div className="relative h-[430px] overflow-hidden rounded-2xl" style={{ background: "linear-gradient(#bfe6ff, #eaf7ff 70%, #c8f0c0 70%, #a8dc9c)" }}>
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
          {bounce ? <p className="mb-1 rounded-full bg-white px-3 py-1 text-sm font-semibold text-danger shadow">{bounce}</p> : null}
          {happy ? <p className="mb-1 rounded-full bg-white px-3 py-1 text-sm font-semibold text-ok shadow">Full! 🎉</p> : null}
          <span className="text-7xl leading-none drop-shadow" style={happy ? { animation: "pb-jump .5s ease 2" } : undefined} aria-hidden>
            🐷
          </span>
          <div className="mt-1 rounded-2xl bg-white/90 px-4 py-1.5 text-center text-[#1f2a36] shadow">
            <p className="text-sm font-semibold">
              Fill me with <span className="text-lg text-[#c2410c]">{fmt(target, currency)}</span>
            </p>
            <div className="mt-1 h-2.5 w-44 overflow-hidden rounded-full bg-black/10">
              <div className="h-full rounded-full bg-[#f472b6] transition-all" style={{ width: `${pct}%` }} />
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
