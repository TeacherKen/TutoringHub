"use client";
import { useEffect, useState } from "react";
import { PIZZA_LEVELS, pizzaQ, pizzaRight, type PizzaLevel, type PizzaQ } from "@/lib/fractions";
import { Bar, FracText, Pie } from "./FractionShapes";
import { useBest } from "./useBest";
import { BigButton, GameHero, LevelPicker, ResultCard, Runner, THEMES } from "./GameKit";

const T = THEMES.pizza;
// A red-and-white checked tablecloth, like a pizzeria.
const CLOTH = {
  backgroundColor: "#fff7ed",
  backgroundImage: "linear-gradient(90deg, rgba(220,38,38,.18) 50%, transparent 50%), linear-gradient(rgba(220,38,38,.18) 50%, transparent 50%)",
  backgroundSize: "36px 36px",
};
import { FractionMaker } from "./FractionMaker";
import { FractionShow } from "./FractionShow";

// 🍕 Pizza Fractions (youngest children): shade slices to make a fraction, name a shaded picture,
// and make the same amount on a bar cut into more pieces (3/4 = 6/8). 10 questions, beat your time.

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
  }
  function start() {
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
    }, 900);
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
            Yes! That&apos;s <FracText f={q.target} className="text-xl" />
          </>
        ) : (
          <>
            Yes! <FracText f={q.from} className="text-xl" /> = <FracText f={{ n: (q.from.n * q.to) / q.from.d, d: q.to }} className="text-xl" />
          </>
        ),
      );
      return;
    }
    if (q.kind === "make") setMsg({ ok: false, text: `You shaded ${shaded.length} of ${q.target.d}. Shade ${q.target.n} of ${q.target.d}.` });
    else {
      const need = (q.from.n * q.to) / q.from.d;
      setMsg({ ok: false, text: shaded.length > need ? "Too much! Make the brown part as long as the one on top." : "Not enough yet. Make the brown part as long as the one on top." });
    }
  }

  function choose(o: { n: number; d: number }) {
    if (!q || q.kind !== "name" || busy) return;
    if (o.n === q.shown.n && o.d === q.shown.d) right(`Yes! ${q.shown.n} out of ${q.shown.d} ${q.shape === "pie" ? "slices" : "pieces"} are shaded.`);
    else {
      setTried((t) => [...t, `${o.n}/${o.d}`]);
      setMsg({ ok: false, text: "Not that one. Top number: how many are shaded. Bottom number: how many altogether." });
    }
  }

  if (phase === "setup") {
    return (
      <div className="space-y-4">
        <GameHero theme={T} art={<Pie parts={8} shaded={[0, 1, 2]} size={70} label="" />} title="PIZZA FRACTIONS">
          {COUNT} questions. Get them all right as fast as you can!
        </GameHero>
        <LevelPicker theme={T} levels={Object.entries(PIZZA_LEVELS) as [PizzaLevel, string][]} value={level} onChange={setLevel} />
        {best != null ? <p className="text-center text-sm text-muted">⏱️ Your fastest: {secs(best)}</p> : null}
        <BigButton theme={T} onClick={start}>
          ▶ Start
        </BigButton>
        <p className="pt-1 text-center text-xs font-semibold uppercase tracking-[0.2em] text-muted">For teaching</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <button type="button" className="btn-secondary min-h-14 w-full" onClick={() => setPhase("show")}>
            🍕 Show a fraction
          </button>
          <button type="button" className="btn-secondary min-h-14 w-full" onClick={() => setPhase("maker")}>
            🧑‍🏫 Compare and add two
          </button>
        </div>
      </div>
    );
  }

  if (phase === "maker") return <FractionMaker onBack={() => setPhase("setup")} />;
  if (phase === "show") return <FractionShow onBack={() => setPhase("setup")} />;

  if (phase === "done") {
    return (
      <ResultCard theme={T} art="🍕" label={`All ${COUNT} done in`} big={secs(Math.round(elapsed / 100))} newBest={newBest} bestText={`Your fastest: ${best != null ? secs(best) : "—"}`} onAgain={start} onChange={() => setPhase("setup")} />
    );
  }

  if (!q) return null;
  const thing = (s: "pie" | "bar") => (s === "pie" ? "pizza" : "chocolate bar");
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm text-muted">
        <span>
          Question <strong className="text-ink tabular-nums">{n + 1}</strong> of {COUNT}
        </span>
        <span className="tabular-nums">{secs(Math.round(elapsed / 100))}</span>
      </div>
      <Runner theme={T} value={n} max={COUNT} icon="🍕" />

      <div className="space-y-3 rounded-3xl p-4 text-[#3b1a0a] shadow-[0_6px_18px_rgba(0,0,0,.15)] ring-4 ring-[#c2412d]/20" style={CLOTH}>
      <h3 className="mx-auto flex min-h-16 w-fit flex-wrap items-center justify-center gap-x-3 rounded-2xl bg-white/90 px-4 py-2 text-center text-2xl font-semibold shadow-sm">
        {q.kind === "make" ? (
          <>
            Shade <FracText f={q.target} className="text-4xl" /> of the {thing(q.shape)}
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
              <FracText f={{ n: 0, d: q.to }} top="?" className="w-10 shrink-0 text-2xl text-muted" />
            </div>
          </div>
        )}
      </div>
      </div>

      <p aria-live="polite" className={`flex min-h-7 flex-wrap items-center justify-center gap-x-2 text-center ${msg ? (msg.ok ? "font-semibold text-ok" : "text-danger") : ""}`}>
        {msg?.text}
      </p>

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
                className={`flex min-h-24 items-center justify-center rounded-2xl border-2 bg-white text-[#3b1a0a] shadow-[0_4px_0_#e7c9a9] transition hover:-translate-y-0.5 active:translate-y-1 active:shadow-none ${no ? "border-danger/40 opacity-40" : "border-[#f3d9bf]"}`}
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
              ✓ Check
            </BigButton>
          </div>
        </div>
      )}
    </div>
  );
}
