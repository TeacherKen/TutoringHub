"use client";
import { useEffect, useState } from "react";
import { changeHint, face, fewest, fmt, shopHint, shopQ, SHOP_LEVELS, sum, wallet, type Currency, type Money, type ShopLevel, type ShopQ } from "@/lib/moneyShop";
import { useBest } from "./useBest";
import { BigButton, GameHero, LevelPicker, ResultCard, Runner, THEMES } from "./GameKit";

const T = THEMES.shop;

// 🛒 Money Shop: pay the exact price, give the change, and add up a basket — with Thai baht or US dollars.
// Children tap coins and notes into the tray (tap one in the tray to take it back), then press Pay.
// 10 shoppers, beat your fastest time. The coins and notes are simple drawings, not copies of real money.

const COUNT = 10;
const secs = (tenths: number) => `${(tenths / 10).toFixed(1)}s`;

const THB_COLOURS: Record<number, [string, string]> = {
  1: ["#d9dde2", "#8d949c"],
  2: ["#f0cf62", "#a8862a"],
  5: ["#d9dde2", "#8d949c"],
  10: ["#f0cf62", "#9aa1a8"],
  20: ["#3f8f4f", "#ffffff"],
  50: ["#3d6fb6", "#ffffff"],
  100: ["#c8423a", "#ffffff"],
  500: ["#7a4fa0", "#ffffff"],
  1000: ["#7a6150", "#ffffff"],
};
const USD_COLOURS: Record<number, [string, string]> = {
  1: ["#d08a5a", "#8a5233"],
  5: ["#d9dde2", "#8d949c"],
  10: ["#d9dde2", "#8d949c"],
  25: ["#d9dde2", "#8d949c"],
};

/** One coin or note. Coins get bigger with their value (as real ones mostly do). */
export function Cash({ m, c, small = false }: { m: Money; c: Currency; small?: boolean }) {
  const label = face(m, c);
  if (m.kind === "note") {
    const bg = c === "THB" ? (THB_COLOURS[m.value]?.[0] ?? "#888") : "#5f8a64";
    return (
      <span
        className={`grid place-items-center rounded-md font-bold text-white shadow ${small ? "h-9 w-[4.2rem] text-sm" : "h-12 w-[5.6rem] text-lg"}`}
        style={{ background: `linear-gradient(135deg, ${bg}, color-mix(in srgb, ${bg}, #000 22%))`, boxShadow: "inset 0 0 0 3px rgba(255,255,255,.35), 0 2px 4px rgba(0,0,0,.25)" }}
      >
        {label}
      </span>
    );
  }
  const [fill, ring] = (c === "THB" ? THB_COLOURS : USD_COLOURS)[m.value] ?? ["#ddd", "#999"];
  const order = c === "THB" ? [1, 2, 5, 10] : [10, 1, 5, 25];
  const d = (small ? 30 : 42) + order.indexOf(m.value) * (small ? 3 : 5);
  // Thai 10 baht: gold middle, silver ring.
  const bg = c === "THB" && m.value === 10 ? `radial-gradient(circle, ${fill} 55%, ${ring} 57%)` : `radial-gradient(circle at 35% 30%, color-mix(in srgb, ${fill}, #fff 35%), ${fill} 60%)`;
  return (
    <span
      className="grid place-items-center rounded-full font-bold text-[#1f2a36]"
      style={{ width: d, height: d, background: bg, boxShadow: `inset 0 0 0 2px ${ring}, 0 2px 3px rgba(0,0,0,.25)`, fontSize: small ? 12 : 15 }}
    >
      {label}
    </span>
  );
}

function Shelf({ q, c, level }: { q: ShopQ; c: Currency; level: ShopLevel }) {
  return (
    <div className="overflow-hidden rounded-3xl shadow-[0_6px_18px_rgba(0,0,0,.15)] ring-1 ring-black/10">
      <div className="h-6" style={{ background: "repeating-linear-gradient(90deg,#e0504a 0 26px,#fbf3e4 26px 52px)" }} aria-hidden />
      <div className="space-y-3 p-4 text-[#3b2a12]" style={{ background: "linear-gradient(#fbf1dc, #f3e2c0)" }}>
      <div className="flex flex-wrap justify-center gap-3">
        {q.items.map((it) => (
          <div key={it.name} className="pz-anim flex min-w-[6.5rem] animate-[tt-pop_.3s_ease-out] flex-col items-center rounded-2xl bg-white px-3 py-2 shadow-[0_4px_0_#e2c99a]">
            <span className="text-5xl leading-tight" aria-hidden>
              {it.emoji}
            </span>
            <span className="text-sm text-[#7a6a55]">{it.name}</span>
            <span className="mt-1 rounded-full bg-[#ffc629] px-2.5 py-0.5 text-lg font-bold tabular-nums text-[#2b1a08]">{fmt(it.price, c)}</span>
          </div>
        ))}
      </div>
      <p className="text-center text-lg font-semibold">
        {q.paid == null ? (
          <>
            Pay exactly <span className="rounded-full bg-[#ffd84d] px-2.5 py-0.5 text-[#3b2a00]">{fmt(q.total, c)}</span>
          </>
        ) : (
          <span className="inline-flex flex-wrap items-center justify-center gap-2">
            {level === "basket" ? "Buy them all." : "Buy it."} You pay with <Cash m={{ value: q.paid, kind: "note" }} c={c} small /> Give the change.
          </span>
        )}
      </p>
      </div>
      <div className="h-4" style={{ background: "linear-gradient(#e6b77a, #b98446)" }} aria-hidden />
    </div>
  );
}

export function MoneyShop() {
  const [currency, setCurrency] = useState<Currency>("THB");
  const [level, setLevel] = useState<ShopLevel>("exact");
  const [phase, setPhase] = useState<"setup" | "play" | "done">("setup");
  const [q, setQ] = useState<ShopQ | null>(null);
  const [n, setN] = useState(0);
  const [tray, setTray] = useState<number[]>([]);
  const [hint, setHint] = useState<string | null>(null);
  const [tries, setTries] = useState(0);
  const [startedAt, setStartedAt] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [newBest, setNewBest] = useState(false);
  const { best, offer } = useBest(`ms-${currency}-${level}`, (a, b) => a < b);

  useEffect(() => {
    if (phase !== "play") return;
    const id = setInterval(() => setElapsed(Date.now() - startedAt), 100);
    return () => clearInterval(id);
  }, [phase, startedAt]);

  function fresh(next: ShopQ) {
    setQ(next);
    setTray([]);
    setHint(null);
    setTries(0);
  }

  function start() {
    setN(0);
    fresh(shopQ(currency, level));
    setStartedAt(Date.now());
    setElapsed(0);
    setNewBest(false);
    setPhase("play");
  }

  function pay() {
    if (!q || !tray.length) return;
    const given = sum(tray);
    if (given === q.target) {
      const next = n + 1;
      setN(next);
      if (next >= COUNT) {
        const time = Math.round((Date.now() - startedAt) / 100);
        setElapsed(time * 100);
        setNewBest(offer(time));
        setPhase("done");
      } else fresh(shopQ(currency, level, Math.random, q));
      return;
    }
    const t = tries + 1;
    setTries(t);
    // First try: just say too much / not enough. Second: how to count it. Third: show one way to pay.
    const extra = t >= 3 ? ` One way: ${fewest(q.target, currency).map((v) => fmt(v, currency)).join(" + ")}.` : t === 2 && q.paid != null ? ` ${changeHint(q, currency)}` : "";
    setHint(`${shopHint(q, given, currency)}${extra}`);
  }

  if (phase === "setup") {
    return (
      <div className="space-y-4">
        <GameHero theme={T} art="🛒" title="MONEY SHOP">
          {COUNT} shoppers. Tap coins and notes to pay, then press Pay. Wrong? You get a hint.
        </GameHero>
        <div className="grid grid-cols-2 gap-2" role="group" aria-label="Money">
          {(
            [
              ["THB", "🇹🇭 Thai baht", "฿"],
              ["USD", "🇺🇸 US dollars", "$"],
            ] as const
          ).map(([c, label]) => (
            <button
              key={c}
              type="button"
              aria-pressed={currency === c}
              onClick={() => setCurrency(c)}
              className={`min-h-14 rounded-2xl border-2 px-3 text-lg font-semibold transition ${currency === c ? "-translate-y-0.5 border-transparent text-white shadow-[0_4px_0_#1d5235]" : "border-line bg-surface"}`}
              style={currency === c ? { background: `linear-gradient(${T.from}, ${T.to})` } : undefined}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2 rounded-2xl p-3 shadow-inner" style={{ background: "radial-gradient(circle at 50% 30%, #2f7d4f, #1d5235)" }} aria-hidden>
          {wallet(currency, { items: [], total: 0, paid: Infinity, target: 0 }).map((m) => (
            <Cash key={m.value} m={m} c={currency} small />
          ))}
        </div>
        <LevelPicker theme={T} levels={Object.entries(SHOP_LEVELS) as [ShopLevel, string][]} value={level} onChange={setLevel} />
        {best != null ? <p className="text-center text-sm text-muted">⏱️ Your fastest: {secs(best)}</p> : null}
        <BigButton theme={T} onClick={start}>
          🔔 Open the shop
        </BigButton>
      </div>
    );
  }

  if (phase === "done") {
    return (
      <ResultCard theme={T} art="🛒" label={`All ${COUNT} shoppers served in`} big={secs(Math.round(elapsed / 100))} newBest={newBest} bestText={`Your fastest: ${best != null ? secs(best) : "—"}`} onAgain={start} onChange={() => setPhase("setup")} />
    );
  }

  if (!q) return null;
  const purse = wallet(currency, q);
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm text-muted">
        <span>
          Shopper <strong className="text-ink tabular-nums">{n + 1}</strong> of {COUNT}
        </span>
        <span className="tabular-nums">{secs(Math.round(elapsed / 100))}</span>
      </div>
      <Runner theme={T} value={n} max={COUNT} icon="🛒" />

      <Shelf q={q} c={currency} level={level} />

      <div>
        <p className="mb-1.5 text-sm font-medium text-muted">{q.paid == null ? "Your tray (tap to take back)" : "Change to give (tap to take back)"}</p>
        <div className={`flex min-h-[4.5rem] flex-wrap items-center gap-2 rounded-2xl p-2.5 shadow-inner ring-4 ${hint ? "ring-danger/60" : "ring-[#b98446]"}`} style={{ background: "linear-gradient(#5b3a1c, #3f2812)" }}>
          {tray.length ? (
            tray.map((v, i) => (
              <button
                key={`${i}-${v}`}
                type="button"
                aria-label={`Take back ${fmt(v, currency)}`}
                className="transition active:scale-90"
                onClick={() => {
                  setTray((t) => t.filter((_, j) => j !== i));
                  setHint(null);
                }}
              >
                <Cash m={purse.find((m) => m.value === v) ?? { value: v, kind: "coin" }} c={currency} small />
              </button>
            ))
          ) : (
            <span className="px-2 text-sm text-white/60">Empty — tap money below</span>
          )}
        </div>
      </div>

      <div>
        <p className="mb-1.5 text-sm font-medium text-muted">Tap to add</p>
        <div className="flex flex-wrap items-center justify-center gap-2.5 rounded-2xl p-3 shadow-inner" style={{ background: "radial-gradient(circle at 50% 30%, #2f7d4f, #1d5235)" }}>
          {purse.map((m) => (
            <button
              key={m.value}
              type="button"
              aria-label={`Add ${fmt(m.value, currency)}`}
              className="transition hover:-translate-y-0.5 active:scale-90"
              onClick={() => {
                setTray((t) => (t.length < 30 ? [...t, m.value].sort((a, b) => b - a) : t));
                setHint(null);
              }}
            >
              <Cash m={m} c={currency} />
            </button>
          ))}
        </div>
      </div>

      {hint ? <p className="pz-anim animate-[pz-shake_.35s] rounded-2xl bg-danger-soft p-3 text-center font-medium text-danger">🤔 Not quite. {hint}</p> : null}

      <div className="flex gap-2">
        <button type="button" className="btn-secondary" disabled={!tray.length} onClick={() => (setTray([]), setHint(null))}>
          Clear
        </button>
        <div className="flex-1">
          <BigButton theme={T} onClick={pay} disabled={!tray.length}>
            {q.paid == null ? "💳 Pay" : "🪙 Give change"}
          </BigButton>
        </div>
      </div>
    </div>
  );
}
