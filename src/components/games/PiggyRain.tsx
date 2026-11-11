"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { fmt, type Currency } from "@/lib/moneyShop";
import { nextDrop, piggyMoney, piggyTarget, PIGGY_LEVELS, type PiggyLevel } from "@/lib/games/piggy";
import { Cash } from "./MoneyShop";
import { useBest } from "./useBest";
import { BigButton, GameHero, HowToPlay, LevelPicker, ResultCard, THEMES, Toggle } from "./GameKit";

const T = THEMES.piggy;

// Piggy Bank Rain (P1–P3): Pinky the pig is saving up for toys. Coins and notes float down; tap the
// right ones to fill the piggy bank to exactly the amount, and Pinky gets the toy. Too much? The coin
// bounces off. Fill 6 piggies as fast as you can.
// (Garden: Kenney "Platformer Pack Remastered"; Pinky: "Animal Pack Remastered"; toys: Kenney packs. All CC0.)

const G = "/games/art/garden";
const PINKY = "/games/art/animals/pig.png";
const WISHES: [string, string][] = [
  ["/games/art/shop/kite.png", "toy UFO"],
  ["/games/art/shop/teddy.png", "teddy bear"],
  ["/games/art/shop/candy.png", "giant lollipop"],
  ["/games/art/shop/car.png", "toy car"],
  ["/games/art/shop/icecream.png", "ice cream"],
  ["/games/art/shop/bubbletea.png", "chocolate sundae"],
];
function Pic({ src, className = "", style }: { src: string; className?: string; style?: React.CSSProperties }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" aria-hidden draggable={false} className={`pointer-events-none select-none object-contain ${className}`} style={style} />;
}

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
  const [wishes, setWishes] = useState<number[]>([0, 1, 2, 3, 4, 5]); // which toy Pinky saves for, piggy by piggy
  const [plus, setPlus] = useState<{ id: number; text: string } | null>(null); // "+฿5" over the piggy
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
    setWishes([0, 1, 2, 3, 4, 5].sort(() => Math.random() - 0.5));
    setPlus(null);
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
      setPlus({ id: d.id, text: `+${fmt(d.v, currency)}` });
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
        }, 1700);
      }
    },
    [happy, inPig, target, currency, filled, startedAt, offer, level],
  );

  if (phase === "setup") {
    return (
      <div className="space-y-4">
        <GameHero theme={T} art={<PiggyBank pct={45} happy={false} size={70} />} title="PIGGY BANK RAIN">
          Pinky the pig is saving up for {PIGGIES} toys! Money is raining from the sky. Catch exactly the right amount for each toy.
        </GameHero>
        <HowToPlay
          theme={T}
          steps={[
            <>Look at the sign: it tells you how much to put in the piggy bank, like <strong>Fill me with ฿12</strong>.</>,
            "Coins and notes fall from the sky. Tap one to drop it into the piggy bank.",
            "Too much? It bounces off! Only exactly the right amount fills the piggy.",
            <>Made a mistake? Tap <strong>Shake the piggy empty</strong> and start that piggy again.</>,
          ]}
        />
        <Toggle
          theme={T}
          options={[
            ["THB", "Thai baht"],
            ["USD", "US dollars"],
          ]}
          value={currency}
          onChange={setCurrency}
        />
        <LevelPicker theme={T} levels={Object.entries(PIGGY_LEVELS) as [PiggyLevel, string][]} value={level} onChange={setLevel} />
        <div className="flex flex-wrap items-center justify-center gap-2 rounded-2xl bg-surface-2 p-3" aria-hidden>
          {money.map((m) => (
            <Cash key={m.value} m={m} c={currency} small />
          ))}
        </div>
        {best != null ? <p className="text-center text-sm text-muted">Your fastest: {secs(best)}</p> : null}
        <BigButton theme={T} onClick={start}>
          ▶ Start
        </BigButton>
      </div>
    );
  }

  if (phase === "done") {
    return (
      <ResultCard
        theme={T}
        art={
          <span className="inline-block" style={{ animation: "pb-jump .6s ease 3" }}>
            <PiggyBank pct={100} happy size={90} />
            <style>{`@keyframes pb-jump{0%,100%{transform:translateY(0)}40%{transform:translateY(-16px) scale(1.05)}}`}</style>
          </span>
        }
        label={`Pinky got all ${PIGGIES} toys in`}
        big={secs(Math.round(elapsed / 100))}
        newBest={newBest}
        bestText={`Your fastest: ${best != null ? secs(best) : "—"}`}
        onAgain={start}
        onChange={() => setPhase("setup")}
      >
        <div className="flex flex-wrap items-end justify-center gap-2" aria-hidden>
          <Pic src={PINKY} className="h-16 w-16 animate-[gk-cheer_.9s_ease-in-out_infinite]" />
          {WISHES.map(([src], i) => (
            <Pic key={src} src={src} className="h-11 w-11 animate-[gk-cheer_.9s_ease-in-out_infinite]" style={{ animationDelay: `${(i + 1) * 110}ms` }} />
          ))}
        </div>
      </ResultCard>
    );
  }

  const pct = Math.min(100, (inPig / target) * 100);
  const [wishImg, wishName] = WISHES[wishes[filled % PIGGIES] ?? 0];
  return (
    <div className="space-y-3">
      <style>{`@keyframes pb-fall{from{transform:translateY(-70px)}to{transform:translateY(470px)}}@keyframes pb-jump{0%,100%{transform:translateY(0)}40%{transform:translateY(-14px) scale(1.08)}}@keyframes pb-shake{0%,100%{transform:none}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}@keyframes pb-plus{0%{transform:translateY(0);opacity:0}20%{opacity:1}100%{transform:translateY(-36px);opacity:0}}@keyframes pb-gift{0%{transform:translateY(30px) scale(.3);opacity:0}60%{transform:translateY(-10px) scale(1.15);opacity:1}100%{transform:none;opacity:1}}`}</style>
      <div className="relative h-[470px] overflow-hidden rounded-3xl shadow-[0_8px_24px_rgba(0,0,0,.18)]" style={{ background: `url(${G}/sky.png) center bottom / cover, #cfe9f7` }}>
        {/* the piggies to fill, and the time */}
        <div className="pointer-events-none absolute inset-x-2 top-2 z-[1] flex items-center justify-between gap-2">
          <div className="flex gap-0.5 rounded-xl bg-white/85 px-1.5 py-1 shadow" aria-label={`${filled} of ${PIGGIES} piggies full`}>
            {Array.from({ length: PIGGIES }, (_, i) => (
              <span key={i} className={i < filled ? "" : i === filled ? "" : "opacity-40 grayscale"}>
                <PiggyBank pct={i < filled ? 100 : 0} happy={i < filled} size={30} />
              </span>
            ))}
          </div>
          <span className="rounded-xl bg-white/85 px-2 py-1 text-sm font-bold tabular-nums text-[#7a2a4b] shadow">{secs(Math.round(elapsed / 100))}</span>
        </div>

        {/* the garden */}
        <div className="absolute inset-x-0 bottom-0 h-[118px]" style={{ background: `url(${G}/grassMid.png) 0 0 / 48px 48px repeat-x, url(${G}/grassCenter.png) 0 48px / 48px 48px repeat` }} aria-hidden />
        <Pic src={`${G}/fence.png`} className="absolute bottom-[112px] left-[2%] h-9 w-12" />
        <Pic src={`${G}/bush.png`} className="absolute bottom-[110px] left-[16%] h-10 w-14" />
        <Pic src={`${G}/plantPurple.png`} className="absolute bottom-[112px] right-[20%] h-9 w-9" />
        <Pic src={`${G}/mushroomRed.png`} className="absolute bottom-[112px] right-[4%] h-8 w-8" />
        <Pic src={`${G}/grass.png`} className="absolute bottom-[112px] right-[34%] h-7 w-7" />

        {drops.map((d) => (
          <button
            key={d.id}
            type="button"
            aria-label={`Catch ${fmt(d.v, currency)}`}
            onClick={() => tap(d)}
            onAnimationEnd={() => setDrops((all) => all.filter((x) => x.id !== d.id))}
            className="absolute top-0 z-[5] p-1.5"
            style={{ left: `${d.left}%`, animation: `pb-fall ${d.dur}s linear forwards`, translate: "-50% 0" }}
          >
            <Cash m={money.find((m) => m.value === d.v) ?? { value: d.v, kind: "coin" }} c={currency} />
          </button>
        ))}

        <div className="pointer-events-none absolute inset-x-0 bottom-2 flex flex-col items-center">
          {bounce ? <p className="mb-1 rounded-full bg-white px-3 py-1 text-sm font-semibold text-[#b42318] shadow" style={{ animation: "pb-shake .35s" }}>{bounce}</p> : null}
          {happy ? (
            <p className="mb-1 flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-sm font-semibold text-[#1d7a41] shadow">
              Full! Pinky bought the {wishName}!
            </p>
          ) : null}
          <div className="relative flex items-end gap-1">
            {/* Pinky, dreaming of the toy */}
            <div className="relative -mr-3 mb-3 w-16 sm:w-20">
              <span className="block" style={happy ? { animation: "pb-jump .5s ease 3" } : undefined}>
                <Pic src={PINKY} className="h-16 w-16 sm:h-20 sm:w-20" />
              </span>
              {!happy ? (
                <span className="absolute -top-14 left-1 grid h-14 w-14 place-items-center rounded-full bg-white shadow-md sm:-top-16" title={`Saving for a ${wishName}`}>
                  <Pic src={wishImg} className="h-9 w-9" />
                  <span className="absolute -bottom-1.5 left-4 h-3 w-3 rounded-full bg-white shadow" />
                </span>
              ) : null}
            </div>
            <span className="relative leading-none" style={happy ? { animation: "pb-jump .5s ease 2" } : undefined}>
              <PiggyBank pct={pct} happy={happy} size={150} />
              {plus && !happy ? (
                <span key={plus.id} className="absolute left-1/2 top-0 -translate-x-1/2 rounded-full bg-white/90 px-2 text-sm font-black text-[#c27c00] shadow" style={{ animation: "pb-plus .9s ease-out forwards" }}>
                  {plus.text}
                </span>
              ) : null}
              {happy ? <Pic src={wishImg} className="absolute -top-12 left-1/2 h-14 w-14 -translate-x-1/2" style={{ animation: "pb-gift .6s ease-out forwards" }} /> : null}
            </span>
          </div>
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
      <button type="button" className="btn-secondary w-full text-sm" onClick={() => (setInPig(0), setBounce(null), setPlus(null))}>
        Shake the piggy empty and start again
      </button>
    </div>
  );
}
