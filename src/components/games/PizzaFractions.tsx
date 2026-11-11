"use client";
import { useEffect, useState } from "react";
import { PIZZA_LEVELS, pizzaQ, pizzaRight, type PizzaLevel, type PizzaQ } from "@/lib/fractions";
import { Bar, FracText, Pie } from "./FractionShapes";
import { useBest } from "./useBest";
import { BigButton, GameHero, HowToPlay, LevelPicker, ResultCard, THEMES } from "./GameKit";

const T = THEMES.bakery;
// A red-and-white checked tablecloth, like a pizzeria.
const CLOTH = {
  backgroundColor: "#fff7ed",
  backgroundImage: "linear-gradient(90deg, rgba(220,38,38,.18) 50%, transparent 50%), linear-gradient(rgba(220,38,38,.18) 50%, transparent 50%)",
  backgroundSize: "36px 36px",
};
import { FractionMaker } from "./FractionMaker";
import { FractionShow } from "./FractionShow";

// Pizza Fractions (youngest children): run the Monster Pizza Stall! 10 hungry monsters come to the
// counter, one at a time, and each one orders a fraction: shade slices to make it, name a shaded
// picture, or make the same amount on a bar cut into more pieces (3/4 = 6/8). Serve them all, fast.
// (Monsters: Kenney "Monster Builder Pack"; donuts: Kenney "Donuts"; desert: "Platformer Pack Remastered". All CC0.)

const ART = "/games/art/pizza";
const MON = (i: number, happy = false) => `/games/art/monsters/pizza/m${i}${happy ? "_happy" : ""}.png`;
const NAMES = ["Blob", "Zig", "Rumble", "Sunny", "Frost", "Gloomy", "Pip", "Bubba", "Tango", "Mango"];

const COUNT = 10;
const secs = (tenths: number) => `${(tenths / 10).toFixed(1)}s`;
type Msg = { ok: boolean; text: React.ReactNode } | null;

export function PizzaFractions() {
  const [level, setLevel] = useState<PizzaLevel>("make");
  const [phase, setPhase] = useState<"setup" | "play" | "done" | "maker" | "show">("setup");
  const [q, setQ] = useState<PizzaQ | null>(null);
  const [n, setN] = useState(0);
  const [shaded, setShaded] = useState<number[]>([]);
  const [tried, setTried] = useState<string[]>([]);
  const [msg, setMsg] = useState<Msg>(null);
  const [busy, setBusy] = useState(false);
  const [startedAt, setStartedAt] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [newBest, setNewBest] = useState(false);
  const [oops, setOops] = useState(0); // wrong tries for this customer (makes them wobble)
  const [line, setLine] = useState<number[]>([]); // the order the monsters come in
  const { best, offer } = useBest(`fp-${level}`, (a, b) => a < b, "ds"); // fastest time, in tenths of a second

  useEffect(() => {
    if (phase !== "play") return;
    const id = setInterval(() => setElapsed(Date.now() - startedAt), 100);
    return () => clearInterval(id);
  }, [phase, startedAt]);

  function ask(prev?: PizzaQ) {
    setQ(pizzaQ(level, Math.random, prev));
    setShaded([]);
    setTried([]);
    setMsg(null);
    setOops(0);
  }
  function start() {
    setLine(Array.from({ length: COUNT }, (_, i) => i).sort(() => Math.random() - 0.5));
    setN(0);
    ask();
    setStartedAt(Date.now());
    setElapsed(0);
    setNewBest(false);
    setBusy(false);
    setPhase("play");
  }
  function right(text: React.ReactNode) {
    setMsg({ ok: true, text });
    setBusy(true);
    setTimeout(() => {
      const done = n + 1;
      setN(done);
      setBusy(false);
      if (done >= COUNT) {
        const time = Math.round((Date.now() - startedAt) / 100);
        setElapsed(time * 100);
        setNewBest(offer(time));
        setPhase("done");
      } else ask(q ?? undefined);
    }, 1300);
  }
  const tap = (i: number) => {
    if (busy) return;
    setMsg(null);
    setShaded((s) => (s.includes(i) ? s.filter((x) => x !== i) : [...s, i]));
  };

  function check() {
    if (!q || busy || q.kind === "name") return;
    if (pizzaRight(q, shaded.length)) {
      right(
        q.kind === "make" ? (
          <>
            Yum! That&apos;s <FracText f={q.target} className="text-xl" />
          </>
        ) : (
          <>
            Yum! <FracText f={q.from} className="text-xl" /> = <FracText f={{ n: (q.from.n * q.to) / q.from.d, d: q.to }} className="text-xl" />
          </>
        ),
      );
      return;
    }
    setOops((o) => o + 1);
    if (q.kind === "make") setMsg({ ok: false, text: `You shaded ${shaded.length} of ${q.target.d}. Shade ${q.target.n} of ${q.target.d}.` });
    else {
      const need = (q.from.n * q.to) / q.from.d;
      setMsg({ ok: false, text: shaded.length > need ? "Too much! Make the brown part as long as the one on top." : "Not enough yet. Make the brown part as long as the one on top." });
    }
  }

  function choose(o: { n: number; d: number }) {
    if (!q || q.kind !== "name" || busy) return;
    if (o.n === q.shown.n && o.d === q.shown.d) right(`Yum! ${q.shown.n} out of ${q.shown.d} ${q.shape === "pie" ? "slices" : "pieces"} are shaded.`);
    else {
      setTried((t) => [...t, `${o.n}/${o.d}`]);
      setOops((x) => x + 1);
      setMsg({ ok: false, text: "Not that one. Top number: how many are shaded. Bottom number: how many altogether." });
    }
  }

  if (phase === "setup") {
    return (
      <div className="space-y-4">
        <GameHero theme={T} art={null} title="PIZZA FRACTIONS">
          The Monster Pizza Stall is open! {COUNT} hungry monsters each want a fraction. Serve them all as fast as you can.
        </GameHero>
        <HowToPlay
          theme={T}
          steps={[
            "A monster comes to the counter and tells you what they want.",
            "Tap the slices or pieces to shade them, or pick the right fraction.",
            <>Press <strong>Serve</strong>. Right answer: the monster is happy and pays you a coin!</>,
            "Wrong answer? The monster gives you a hint. Try again.",
          ]}
        />
        <LevelPicker theme={T} levels={Object.entries(PIZZA_LEVELS) as [PizzaLevel, string][]} value={level} onChange={setLevel} />
        {best != null ? <p className="text-center text-sm text-muted">Your fastest: {secs(best)}</p> : null}
        <BigButton theme={T} onClick={start}>
          ▶ Open the stall
        </BigButton>
        <p className="pt-1 text-center text-xs font-semibold uppercase tracking-[0.2em] text-muted">For teaching</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <button type="button" className="btn-secondary min-h-14 w-full" onClick={() => setPhase("show")}>
            Show a fraction
          </button>
          <button type="button" className="btn-secondary min-h-14 w-full" onClick={() => setPhase("maker")}>
            Compare and add two
          </button>
        </div>
      </div>
    );
  }

  if (phase === "maker") return <FractionMaker onBack={() => setPhase("setup")} />;
  if (phase === "show") return <FractionShow onBack={() => setPhase("setup")} />;

  if (phase === "done") {
    return (
      <ResultCard theme={T} art={null} label={`All ${COUNT} monsters fed in`} big={secs(Math.round(elapsed / 100))} newBest={newBest} bestText={`Your fastest: ${best != null ? secs(best) : "—"}`} onAgain={start} onChange={() => setPhase("setup")}>
        <div className="flex flex-wrap justify-center gap-1" aria-hidden>
          {Array.from({ length: COUNT }, (_, i) => (
            <Pic key={i} src={MON(i, true)} className="h-14 w-12 animate-[gk-cheer_.9s_ease-in-out_infinite]" style={{ animationDelay: `${i * 90}ms` }} />
          ))}
        </div>
      </ResultCard>
    );
  }

  if (!q) return null;
  const thing = (s: "pie" | "bar") => (s === "pie" ? "pizza" : "chocolate bar");
  const who = line[n] ?? n % COUNT;
  const served = busy && msg?.ok;
  const order =
    q.kind === "make" ? (
      <>
        Can I have <FracText f={q.target} className="mx-1 text-3xl" /> of a {thing(q.shape)}, please?
      </>
    ) : q.kind === "name" ? (
      <>How much of my {thing(q.shape)} is shaded? Which fraction is it?</>
    ) : (
      <>I want the same amount as the top bar, but cut into {q.to} pieces!</>
    );
  return (
    <div className="space-y-3">
      <Stall n={n} who={who} served={!!served} oops={oops} time={secs(Math.round(elapsed / 100))} line={line}>
        <span className={msg && !msg.ok ? "text-[#b42318]" : msg?.ok ? "text-[#1d7a41]" : ""}>{msg ? msg.text : order}</span>
      </Stall>

      <div className="space-y-3 rounded-3xl p-4 text-[#3b1a0a] shadow-[0_6px_18px_rgba(0,0,0,.15)] ring-4 ring-[#c2412d]/20" style={CLOTH}>
        <h3 className="mx-auto flex w-fit flex-wrap items-center justify-center gap-x-2 rounded-2xl bg-white/90 px-4 py-1.5 text-center text-lg font-semibold shadow-sm">
          {q.kind === "make" ? (
            <>
              Shade <FracText f={q.target} className="text-2xl" /> of the {thing(q.shape)}
            </>
          ) : q.kind === "name" ? (
            "What fraction is shaded?"
          ) : (
            "Shade the same amount on the bottom bar"
          )}
        </h3>

        <div className="flex flex-col items-center gap-3">
          {q.kind === "make" ? (
            q.shape === "pie" ? (
              <Pie parts={q.target.d} shaded={shaded} onTap={tap} label={`A pizza cut into ${q.target.d} slices. Tap slices to shade them.`} />
            ) : (
              <Bar parts={q.target.d} shaded={shaded} onTap={tap} label={`A chocolate bar in ${q.target.d} pieces. Tap pieces to shade them.`} className="max-w-md" />
            )
          ) : q.kind === "name" ? (
            q.shape === "pie" ? (
              <Pie parts={q.shown.d} shaded={q.shaded} label={`A pizza cut into ${q.shown.d} slices, some shaded`} />
            ) : (
              <Bar parts={q.shown.d} shaded={q.shaded} label={`A chocolate bar in ${q.shown.d} pieces, some shaded`} className="max-w-md" />
            )
          ) : (
            <div className="w-full max-w-md space-y-3">
              <div className="flex items-center gap-3">
                <Bar parts={q.from.d} shaded={Array.from({ length: q.from.n }, (_, i) => i)} label={`A bar with ${q.from.n} of ${q.from.d} pieces shaded`} />
                <FracText f={q.from} className="w-10 shrink-0 text-2xl" />
              </div>
              <div className="flex items-center gap-3">
                <Bar parts={q.to} shaded={shaded} onTap={tap} label={`A bar in ${q.to} pieces. Tap pieces to shade them.`} />
                <FracText f={{ n: 0, d: q.to }} top="?" className="w-10 shrink-0 text-2xl text-[#8a5a3a]" />
              </div>
            </div>
          )}
        </div>
      </div>

      {q.kind === "name" ? (
        <div className="grid grid-cols-2 gap-3">
          {q.options.map((o) => {
            const no = tried.includes(`${o.n}/${o.d}`);
            return (
              <button
                key={`${o.n}/${o.d}`}
                type="button"
                disabled={no || busy}
                onClick={() => choose(o)}
                className={`flex min-h-24 items-center justify-center rounded-2xl border-2 bg-white text-[#3b1a0a] shadow-[0_4px_0_#e7c9a9] transition hover:-translate-y-0.5 active:translate-y-1 active:shadow-none ${no ? "border-[#e5a0a0] opacity-40" : "border-[#f3d9bf]"}`}
              >
                <FracText f={o} className="text-4xl" />
              </button>
            );
          })}
        </div>
      ) : (
        <div className="flex gap-2">
          <button type="button" className="btn-secondary min-h-14" disabled={!shaded.length || busy} onClick={() => setShaded([])}>
            Clear
          </button>
          <div className="flex-1">
            <BigButton theme={T} onClick={check} disabled={!shaded.length || busy}>
              Serve!
            </BigButton>
          </div>
        </div>
      )}
    </div>
  );
}

function Pic({ src, className = "", style }: { src: string; className?: string; style?: React.CSSProperties }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" aria-hidden draggable={false} className={`pointer-events-none select-none object-contain ${className}`} style={style} />;
}

/**
 * The Monster Pizza Stall: a striped awning, the monster at the counter saying what they want,
 * the rest of the queue waiting on the right, and the coin jar filling up as you serve them.
 */
function Stall({ n, who, served, oops, time, line, children }: { n: number; who: number; served: boolean; oops: number; time: string; line: number[]; children: React.ReactNode }) {
  const waiting = line.slice(n + 1, n + 4);
  return (
    <div className="relative h-56 overflow-hidden rounded-3xl shadow-[0_6px_18px_rgba(0,0,0,.18)] ring-2 ring-black/10 sm:h-60" style={{ background: `url(${ART}/desert.png) center 70% / cover, #f6d9a8` }}>
      <style>{`@keyframes pf-in{from{transform:translateX(-120%)}to{transform:none}}@keyframes pf-out{0%{transform:none}30%{transform:translateY(-18px)}100%{transform:translate(160%,-6px)}}@keyframes pf-oops{0%,100%{transform:none}20%{transform:translateX(-6px) rotate(-6deg)}40%{transform:translateX(6px) rotate(6deg)}60%{transform:translateX(-4px) rotate(-3deg)}80%{transform:translateX(3px)}}@keyframes pf-coin{0%{transform:translate(-140px,40px) scale(.6);opacity:0}25%{opacity:1}70%{transform:translate(-40px,-50px) scale(1.1)}100%{transform:none;opacity:1}}@keyframes pf-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}`}</style>
      {/* awning */}
      <div className="absolute inset-x-0 top-0 h-9" style={{ background: "repeating-linear-gradient(90deg,#d9483b 0 28px,#fff7ed 28px 56px)", boxShadow: "0 3px 6px rgba(0,0,0,.18)" }} />
      <div className="absolute inset-x-0 top-9 h-3" style={{ background: "radial-gradient(circle at 14px 0, #d9483b 13px, transparent 14px) 0 0 / 56px 12px repeat-x, radial-gradient(circle at 14px 0, #fff7ed 13px, transparent 14px) 28px 0 / 56px 12px repeat-x" }} />
      <p className="absolute left-1/2 top-1 -translate-x-1/2 rounded-full bg-[#7f1d1d] px-3 py-0.5 font-sport text-sm font-bold tracking-widest text-[#fff7ed] shadow">MONSTER PIZZA</p>

      {/* the queue */}
      <div className="absolute bottom-7 right-2 flex items-end gap-0.5 sm:right-4" aria-label={`${Math.max(0, COUNT - n - 1)} more monsters waiting`}>
        {waiting.map((m, i) => (
          <Pic key={m} src={MON(m)} className="w-9 opacity-90 sm:w-11" style={{ height: `${56 - i * 8}px`, animation: `pf-bob 1.6s ease-in-out ${i * 0.3}s infinite` }} />
        ))}
      </div>

      {/* the monster at the counter */}
      <div className="absolute bottom-5 left-2 w-24 sm:bottom-1 sm:left-6 sm:w-28">
        <div key={`${n}-${served}`} style={{ animation: served ? "pf-out 1.1s ease-in .15s forwards" : "pf-in .5s ease-out" }}>
          <div key={oops} style={{ animation: oops && !served ? "pf-oops .5s ease" : undefined }}>
            <Pic src={MON(who, served)} className="h-32 w-full sm:h-36" />
          </div>
        </div>
      </div>

      {/* speech bubble */}
      <div aria-live="polite" className="absolute left-[7.5rem] right-3 top-14 flex min-h-16 items-center rounded-2xl bg-white px-3 py-2 text-[15px] font-semibold leading-snug text-[#3b1a0a] shadow-md sm:left-40 sm:right-28 sm:text-base">
        <span className="absolute -left-2 top-6 h-4 w-4 rotate-45 bg-white" aria-hidden />
        <span className="relative">
          <span className="mr-1 font-bold text-[#c2412d]">{NAMES[who]}:</span>
          {children}
        </span>
      </div>

      {/* counter, donuts and coin jar */}
      <div className="absolute inset-x-0 bottom-0 h-12" style={{ background: "linear-gradient(#c98a4b,#9a5f2c)", boxShadow: "inset 0 4px 0 #e0a865, 0 -2px 6px rgba(0,0,0,.2)" }} />
      <Pic src={`${ART}/donut1.png`} className="absolute bottom-7 left-[44%] h-9 w-9" />
      <Pic src={`${ART}/donut3.png`} className="absolute bottom-7 left-[52%] h-8 w-8" />
      <div className="absolute bottom-1.5 right-3 flex items-center gap-1.5 rounded-xl bg-[#5b3415]/80 px-2 py-1 text-sm font-bold text-[#ffe9a8]">
        <span key={n} className="inline-block" style={{ animation: n ? "pf-coin .7s ease-out" : undefined }}>
          <Pic src={`${ART}/coin.png`} className="h-5 w-5" />
        </span>
        <span className="tabular-nums">{n}</span>
        <span className="font-semibold text-[#f6d9a8]">/ {COUNT}</span>
        <span className="ml-1 font-semibold tabular-nums text-[#f6d9a8]">{time}</span>
      </div>
    </div>
  );
}
