"use client";
import { useState } from "react";
import { fewest, fmt, MONEY, sum, type Currency } from "@/lib/moneyShop";
import { cost, newShop, nextOrder, PER_DAY, price, STOCK, starsFor, tipFor, UPGRADES, type Order, type ShopSave } from "@/lib/games/littleShop";
import { Cash } from "./MoneyShop";
import { useSaves } from "./useSaves";

// 🏪 My Little Shop (P3–P5): run your own shop. Animal customers buy things and pay with a note;
// you give the right change. Earn money, then spend it on upgrades: new shelves make the maths harder,
// decorations just make the shop yours. Each player's shop is saved on this device.

type Save = ShopSave & { shopName: string };

const WOOD = "linear-gradient(#c98b4a, #8f5a28)";

/** The goods on wooden shelves, each with a hanging price tag. One shelf per kind (snacks, drinks, toys). */
function PriceList({ s }: { s: Save }) {
  const shelves = (["snacks", "drinks", "toys"] as const).filter((sh) => sh === "snacks" || s.owned.includes(sh));
  return (
    <div className="space-y-3">
      {shelves.map((sh) => (
        <div key={sh}>
          <div className="flex flex-wrap items-end justify-center gap-x-2 gap-y-1 px-2">
            {STOCK.filter((it) => it.shelf === sh).map((it) => (
              <span key={it.id} className="flex flex-col items-center">
                <span className="text-3xl leading-none drop-shadow-[0_2px_1px_rgba(0,0,0,.25)] sm:text-4xl" aria-hidden>
                  {it.emoji}
                </span>
                <span className="sr-only">{it.name}</span>
              </span>
            ))}
          </div>
          <div className="mx-1 h-3 rounded-sm shadow-[0_3px_0_#6b3f17]" style={{ background: WOOD }} aria-hidden />
          <div className="flex flex-wrap justify-center gap-x-2 gap-y-1 px-2">
            {STOCK.filter((it) => it.shelf === sh).map((it) => (
              <span key={it.id} className="relative -mt-px rounded-b-md rounded-t-sm bg-[#fff8dc] px-1.5 pb-0.5 pt-1 text-xs font-bold tabular-nums text-[#5a3a12] shadow-sm ring-1 ring-[#e6cf8f] sm:text-sm">
                {fmt(price(it, s.currency), s.currency)}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Red-and-cream stripes with a scalloped edge. */
function Awning({ lights }: { lights: boolean }) {
  return (
    <div className="relative" aria-hidden>
      <div className="h-9" style={{ background: "repeating-linear-gradient(90deg,#e0504a 0 32px,#fbf3e4 32px 64px)" }} />
      <div className="flex h-4 overflow-hidden">
        {Array.from({ length: 40 }, (_, i) => (
          <span key={i} className="h-8 w-8 shrink-0 -translate-y-4 rounded-full" style={{ background: i % 2 ? "#fbf3e4" : "#e0504a", boxShadow: "0 2px 2px rgba(0,0,0,.15)" }} />
        ))}
      </div>
      {lights ? (
        <div className="absolute inset-x-2 top-[46px] flex justify-between">
          {Array.from({ length: 14 }, (_, i) => (
            <span key={i} className="h-2.5 w-2.5 rounded-full" style={{ background: ["#ffd84d", "#ff7ab0", "#7ad7ff", "#9dff8a"][i % 4], boxShadow: `0 0 8px ${["#ffd84d", "#ff7ab0", "#7ad7ff", "#9dff8a"][i % 4]}`, animation: `ls-blink ${1.2 + (i % 3) * 0.4}s ease-in-out infinite` }} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ShopFront({ s, children, night = false }: { s: Save; children?: React.ReactNode; night?: boolean }) {
  const has = (id: string) => s.owned.includes(id);
  return (
    <div className="relative overflow-hidden rounded-3xl shadow-[0_8px_24px_rgba(0,0,0,.18)] ring-1 ring-black/10">
      <style>{`@keyframes ls-blink{0%,100%{opacity:1}50%{opacity:.45}}@keyframes ls-note{0%{transform:translateY(0);opacity:0}30%{opacity:1}100%{transform:translateY(-30px);opacity:0}}@keyframes ls-swim{0%,100%{transform:translateX(0) scaleX(1)}45%{transform:translateX(18px) scaleX(1)}50%{transform:translateX(18px) scaleX(-1)}95%{transform:translateX(0) scaleX(-1)}}`}</style>
      {/* sign board */}
      <div className="flex items-center justify-between gap-2 px-3 py-2" style={{ background: WOOD }}>
        <span
          className={`rounded-xl px-3 py-1 font-sport text-xl font-bold tracking-wide ${has("sign") ? "bg-[#1a1033] text-[#ff7ad9] [text-shadow:0_0_6px_#ff4fd0,0_0_14px_#ff4fd0]" : "bg-[#fdf3dc] text-[#6b3f17] shadow-inner"}`}
        >
          {s.shopName}
        </span>
        <span className="flex items-center gap-1.5 rounded-xl bg-black/35 px-2.5 py-1 text-sm font-semibold tabular-nums text-white">
          <span>Day {s.day}</span>
          <span className="rounded-full bg-[#ffd84d] px-2 text-[#4a2a00]">{fmt(s.money, s.currency)}</span>
        </span>
      </div>
      <Awning lights={has("lights")} />
      {/* inside the shop */}
      <div
        className="relative space-y-3 px-3 pb-4 pt-4"
        style={{
          background: night
            ? "linear-gradient(#1c2340, #2c3560)"
            : has("lights")
              ? "radial-gradient(circle at 50% 0, #fff4c8, transparent 65%), linear-gradient(#fbf1dc, #f3e2c0)"
              : "linear-gradient(#fbf1dc, #f3e2c0)",
        }}
      >
        {has("fish") ? (
          <span className="absolute right-2 top-2 grid h-12 w-16 place-items-center overflow-hidden rounded-lg border-2 border-white/80 bg-gradient-to-b from-[#9be7ff] to-[#3aa0d8] text-xl shadow" aria-label="Fish tank">
            <span style={{ animation: "ls-swim 5s ease-in-out infinite" }}>🐠</span>
          </span>
        ) : null}
        {has("music") ? (
          <span className={`pointer-events-none absolute top-3 text-lg text-[#8b5cf6] ${has("fish") ? "right-20" : "right-3"}`} aria-label="Music">
            <span className="inline-block" style={{ animation: "ls-note 2.4s ease-out infinite" }}>
              ♪
            </span>
            <span className="ml-1 inline-block" style={{ animation: "ls-note 2.4s ease-out 1.1s infinite" }}>
              ♫
            </span>
          </span>
        ) : null}
        {children}
        {/* counter */}
        <div className="relative -mx-3 -mb-4 mt-2 h-8 shadow-[0_-2px_0_rgba(0,0,0,.08)]" style={{ background: "linear-gradient(#e6b77a, #b98446)" }} aria-hidden>
          {has("plant") ? <span className="absolute -top-8 left-2 text-4xl">🪴</span> : null}
          {has("cat") ? <span className="absolute -top-6 right-3 text-3xl">🐈</span> : null}
        </div>
      </div>
    </div>
  );
}

export function LittleShop() {
  const { all, save, remove } = useSaves<Save>("little-shop");
  const [player, setPlayer] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newCur, setNewCur] = useState<Currency>("THB");
  const [mode, setMode] = useState<"home" | "serve" | "dayEnd">("home");
  const [order, setOrder] = useState<Order | null>(null);
  const [served, setServed] = useState(0);
  const [dayTake, setDayTake] = useState({ money: 0, stars: 0 });
  const [tray, setTray] = useState<number[]>([]);
  const [tries, setTries] = useState(0);
  const [hint, setHint] = useState<string | null>(null);
  const [thanks, setThanks] = useState<string | null>(null);
  const [since, setSince] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const s = player ? all[player] : null;

  // ---- Who's playing? ----
  if (!player || !s) {
    const names = Object.keys(all);
    return (
      <div className="space-y-4">
        <ShopFront s={{ ...newShop(newCur), shopName: newName.trim() ? `${newName.trim().slice(0, 14)}'s Shop` : "My Little Shop", owned: ["lights", "plant", "cat"] }}>
          <PriceList s={{ ...newShop(newCur), shopName: "", owned: [] }} />
        </ShopFront>
        <p className="text-muted">Run your own shop! Serve customers, give the right change, earn money and make your shop bigger.</p>
        {names.length ? (
          <div className="grid gap-2">
            {names.map((n) => (
              <div key={n} className="flex items-center gap-2">
                <button type="button" className="flex min-h-16 flex-1 items-center justify-between rounded-2xl border-2 border-[#e6b77a] bg-gradient-to-r from-[#fff8ec] to-[#fde9c8] px-4 text-left text-[#5a3a12] shadow-sm transition hover:-translate-y-0.5 hover:shadow-md" onClick={() => (setPlayer(n), setMode("home"))}>
                  <span className="font-semibold">🏪 {all[n].shopName}</span>
                  <span className="text-sm text-muted tabular-nums">
                    Day {all[n].day} · {fmt(all[n].money, all[n].currency)}
                  </span>
                </button>
                {confirmDelete === n ? (
                  <button type="button" className="btn-danger h-14 px-3 text-sm" onClick={() => (remove(n), setConfirmDelete(null))}>
                    Delete?
                  </button>
                ) : (
                  <button type="button" className="h-14 px-2 text-sm text-muted" aria-label={`Delete ${all[n].shopName}`} onClick={() => setConfirmDelete(n)}>
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : null}
        <form
          className="space-y-2 rounded-2xl border border-dashed border-line p-3"
          onSubmit={(e) => {
            e.preventDefault();
            const name = newName.trim().slice(0, 14);
            if (!name) return;
            const key = `${name}-${newCur}`;
            if (!all[key]) save(key, { ...newShop(newCur), shopName: `${name}'s Shop` });
            setPlayer(key);
            setMode("home");
            setNewName("");
          }}
        >
          <p className="text-sm font-semibold">Open a new shop</p>
          <input className="input w-full" placeholder="Your name" value={newName} maxLength={14} onChange={(e) => setNewName(e.target.value)} aria-label="Your name" />
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                ["THB", "🇹🇭 Baht"],
                ["USD", "🇺🇸 Dollars"],
              ] as const
            ).map(([c, label]) => (
              <button key={c} type="button" aria-pressed={newCur === c} onClick={() => setNewCur(c)} className={`min-h-11 rounded-xl border-2 font-semibold ${newCur === c ? "border-accent bg-accent-soft text-accent" : "border-line bg-surface"}`}>
                {label}
              </button>
            ))}
          </div>
          <button className="btn-primary w-full" disabled={!newName.trim()}>
            Open my shop
          </button>
        </form>
      </div>
    );
  }

  const c = s.currency;
  const update = (patch: Partial<Save>) => save(player, { ...s, ...patch });

  function nextCustomer() {
    setOrder(nextOrder(s!));
    setTray([]);
    setTries(0);
    setHint(null);
    setThanks(null);
    setSince(Date.now());
  }

  function openShop() {
    setServed(0);
    setDayTake({ money: 0, stars: 0 });
    setMode("serve");
    nextCustomer();
  }

  function give() {
    if (!order || !tray.length) return;
    const change = order.paid - order.total;
    const given = sum(tray);
    if (given === change) {
      const t = tries + 1;
      const stars = starsFor(t, (Date.now() - since) / 1000);
      const tip = tipFor(stars, order.total, c);
      const earned = order.total + tip;
      setThanks(`${order.who[1]}: "Thank you!"${tip ? ` +${fmt(tip, c)} tip for great service!` : ""}`);
      setDayTake((d) => ({ money: d.money + earned, stars: d.stars + stars }));
      update({ money: s!.money + earned, served: s!.served + 1, stars: s!.stars + stars });
      const done = served + 1;
      setServed(done);
      setTimeout(() => (done >= PER_DAY ? (update({ money: s!.money + earned, served: s!.served + 1, stars: s!.stars + stars, day: s!.day + 1 }), setMode("dayEnd")) : nextCustomer()), 1300);
      return;
    }
    const t = tries + 1;
    setTries(t);
    const msg = given > change ? `"Hmm, that's too much change!"` : `"Hmm, I think I need more change."`;
    const extra =
      t === 2
        ? ` The total is ${fmt(order.total, c)}. Count up from ${fmt(order.total, c)} to ${fmt(order.paid, c)}.`
        : t >= 3
          ? ` The change is ${fmt(change, c)}${fewest(change, c).length > 1 ? `: ${fewest(change, c).map((v) => fmt(v, c)).join(" + ")}` : ""}.`
          : "";
    setHint(`${order.who[1]}: ${msg}${extra}`);
  }

  // ---- End of the day ----
  if (mode === "dayEnd") {
    return (
      <div className="space-y-4">
        <ShopFront s={s} night>
          <div className="space-y-2 py-4 text-center text-white">
            <p className="text-5xl" aria-hidden>
              🌙
            </p>
            <p className="mx-auto w-max rotate-[-3deg] rounded-md border-2 border-[#6b3f17] bg-[#fdf3dc] px-3 py-1 font-sport text-xl font-bold text-[#6b3f17] shadow">CLOSED</p>
            <p className="text-xl font-bold">Shop closed for the day!</p>
            <p className="text-lg">
              You earned <strong>{fmt(dayTake.money, c)}</strong> today
            </p>
            <p className="text-2xl">
              {"⭐".repeat(dayTake.stars)} <span className="text-sm text-white/70">({dayTake.stars} of {PER_DAY * 3} stars)</span>
            </p>
          </div>
        </ShopFront>
        <button type="button" className="btn-primary w-full" onClick={() => setMode("home")}>
          Back to my shop
        </button>
      </div>
    );
  }

  // ---- Serving a customer ----
  if (mode === "serve" && order) {
    const purse = MONEY[c].filter((m) => m.value < order.paid);
    return (
      <div className="space-y-3">
        <style>{`@keyframes ls-in{from{transform:translateX(60px);opacity:0}to{transform:none;opacity:1}}`}</style>
        <ShopFront s={s}>
          <div className="flex items-center gap-1.5 text-sm text-[#6b3f17]">
            <span className="font-semibold">Customer {served + 1} of {PER_DAY}</span>
            <span className="flex flex-1 gap-1">
              {Array.from({ length: PER_DAY }, (_, i) => (
                <span key={i} className={`h-2 flex-1 rounded-full ${i < served ? "bg-[#e0504a]" : i === served ? "bg-[#ffd84d]" : "bg-black/10"}`} />
              ))}
            </span>
          </div>
          <PriceList s={s} />
          <div key={served} className="flex items-start gap-3" style={{ animation: "ls-in .4s ease" }}>
            <span className="text-7xl leading-none drop-shadow-[0_3px_2px_rgba(0,0,0,.25)]" aria-hidden>
              {order.who[0]}
            </span>
            <div className="relative flex-1 rounded-2xl bg-white p-3 text-[#2b2b2b] shadow-md">
              <span className="absolute -left-2 top-5 h-4 w-4 rotate-45 bg-white" aria-hidden />
              <p className="text-sm text-[#7a6a55]">{order.who[1]} wants:</p>
              <p className="text-lg font-semibold">
                {order.lines.map((l, i) => (
                  <span key={l.item.id} className="whitespace-nowrap">
                    {i ? " + " : ""}
                    {l.qty > 1 ? `${l.qty} × ` : ""}
                    <span aria-hidden>{l.item.emoji}</span> {l.item.name}
                  </span>
                ))}
              </p>
              <p className="mt-1 flex flex-wrap items-center gap-2 text-sm">
                &quot;Here you go!&quot; <Cash m={{ value: order.paid, kind: "note" }} c={c} small />
              </p>
            </div>
          </div>
        </ShopFront>

        {thanks ? <p className="rounded-2xl bg-ok-soft p-3 text-center font-semibold text-ok" style={{ animation: "tt-pop .4s ease-out" }}>💖 {thanks}</p> : null}
        {hint && !thanks ? <p className="rounded-2xl bg-danger-soft p-3 text-center font-medium text-danger" style={{ animation: "pz-shake .35s" }}>🤔 {hint}</p> : null}

        <div>
          <p className="mb-1.5 text-sm font-medium text-muted">Change to give (tap to take back)</p>
          <div className="flex min-h-[4.5rem] flex-wrap items-center gap-2 rounded-2xl p-2.5 shadow-inner ring-4 ring-[#b98446]" style={{ background: "linear-gradient(#5b3a1c, #3f2812)" }}>
            {tray.length ? (
              tray.map((v, i) => (
                <button key={`${i}-${v}`} type="button" aria-label={`Take back ${fmt(v, c)}`} onClick={() => (setTray((t) => t.filter((_, j) => j !== i)), setHint(null))}>
                  <Cash m={purse.find((m) => m.value === v) ?? { value: v, kind: "coin" }} c={c} small />
                </button>
              ))
            ) : (
              <span className="px-2 text-sm text-white/60">The change tray is empty — tap money below</span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2.5 rounded-2xl p-3 shadow-inner" style={{ background: "radial-gradient(circle at 50% 30%, #2f7d4f, #1d5235)" }}>
          {purse.map((m) => (
            <button key={m.value} type="button" aria-label={`Add ${fmt(m.value, c)}`} className="transition active:scale-90" onClick={() => (setTray((t) => (t.length < 30 ? [...t, m.value].sort((a, b) => b - a) : t)), setHint(null))}>
              <Cash m={m} c={c} />
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn-secondary" disabled={!tray.length} onClick={() => setTray([])}>
            Clear
          </button>
          <button type="button" className="btn-primary flex-1" disabled={!tray.length || !!thanks} onClick={give}>
            Give change
          </button>
        </div>
      </div>
    );
  }

  // ---- The shop between days: upgrades, then open ----
  return (
    <div className="space-y-4">
      <ShopFront s={s}>
        <PriceList s={s} />
        <p className="text-center text-sm font-medium text-[#6b3f17]">
          {s.served} customers served · {s.stars} ⭐
        </p>
      </ShopFront>
      <button type="button" className="w-full rounded-2xl bg-gradient-to-b from-[#ff6b5e] to-[#d9342b] py-4 text-lg font-bold text-white shadow-[0_5px_0_#9c2018] transition active:translate-y-1 active:shadow-[0_1px_0_#9c2018]" onClick={openShop}>
        🔔 Open the shop ({PER_DAY} customers)
      </button>
      <div className="space-y-2">
        <p className="text-lg font-bold">🛠️ Upgrades</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {UPGRADES.map((u) => {
            const owned = s.owned.includes(u.id);
            const price = cost(u, c);
            return (
              <div key={u.id} className={`relative flex items-center gap-3 overflow-hidden rounded-2xl border-2 p-2.5 ${owned ? "border-[#9be0b0] bg-[#effbf2]" : "border-[#f0dfc0] bg-[#fffaf1]"}`}>
                <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl text-3xl shadow-inner ${owned ? "bg-white" : "bg-[#fdebc8]"}`} aria-hidden>
                  {u.emoji}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{u.name}</span>
                  <span className="block text-xs text-muted">{u.what}</span>
                </span>
                {owned ? (
                  <span className="rounded-full bg-[#30a46c] px-2.5 py-1 text-xs font-bold text-white">✓ Yours</span>
                ) : (
                  <button
                    type="button"
                    className="h-10 rounded-full bg-gradient-to-b from-[#ffe27a] to-[#e0a526] px-3 text-sm font-bold tabular-nums text-[#4a2a00] shadow-[0_3px_0_#a8770f] transition active:translate-y-0.5 disabled:from-[#e8e3d8] disabled:to-[#d6cfbf] disabled:text-[#8a8170] disabled:shadow-none"
                    disabled={s.money < price}
                    onClick={() => update({ money: s.money - price, owned: [...s.owned, u.id] })}
                  >
                    {fmt(price, c)}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <button type="button" className="text-sm text-muted underline" onClick={() => setPlayer(null)}>
        ‹ Change player
      </button>
    </div>
  );
}

