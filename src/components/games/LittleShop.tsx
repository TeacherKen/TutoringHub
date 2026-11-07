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

function PriceList({ s }: { s: Save }) {
  const shelves = new Set(["snacks", ...(s.owned.includes("drinks") ? ["drinks"] : []), ...(s.owned.includes("toys") ? ["toys"] : [])]);
  return (
    <div className="flex flex-wrap justify-center gap-1.5">
      {STOCK.filter((it) => shelves.has(it.shelf)).map((it) => (
        <span key={it.id} className="flex items-center gap-1 rounded-xl bg-surface px-2 py-1 shadow-sm">
          <span className="text-2xl" aria-hidden>
            {it.emoji}
          </span>
          <span className="rounded-full bg-[#ffc629] px-1.5 text-sm font-bold tabular-nums text-[#2b1a08]">{fmt(price(it, s.currency), s.currency)}</span>
          <span className="sr-only">{it.name}</span>
        </span>
      ))}
    </div>
  );
}

function ShopFront({ s, children }: { s: Save; children?: React.ReactNode }) {
  const decor = UPGRADES.filter((u) => !["drinks", "basket", "toys"].includes(u.id) && s.owned.includes(u.id));
  return (
    <div className="overflow-hidden rounded-2xl border border-line">
      <div className="flex items-center justify-between gap-2 px-4 py-2.5 text-white" style={{ background: "repeating-linear-gradient(90deg,#d9534f 0 28px,#f5f0e6 28px 56px)" }}>
        <span className="rounded-lg bg-black/55 px-2.5 py-1 font-bold">
          {s.owned.includes("sign") ? "🌟 " : "🏪 "}
          {s.shopName}
        </span>
        <span className="rounded-lg bg-black/55 px-2.5 py-1 text-sm tabular-nums">
          Day {s.day} · 💰 {fmt(s.money, s.currency)}
        </span>
      </div>
      <div className="space-y-3 p-3" style={{ background: s.owned.includes("lights") ? "radial-gradient(circle at 50% 0,#fff7d6,transparent 70%), var(--surface-2, #f3efe7)" : "var(--surface-2, #f3efe7)" }}>
        {decor.length ? (
          <p className="text-center text-2xl" aria-label="Decorations">
            {decor.map((d) => d.emoji).join("  ")}
          </p>
        ) : null}
        {children}
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
        <p className="text-center text-6xl" aria-hidden>
          🏪
        </p>
        <p className="text-muted">Run your own shop! Serve customers, give the right change, earn money and make your shop bigger.</p>
        {names.length ? (
          <div className="grid gap-2">
            {names.map((n) => (
              <div key={n} className="flex items-center gap-2">
                <button type="button" className="flex min-h-14 flex-1 items-center justify-between rounded-xl border border-line bg-surface px-4 text-left hover:border-accent" onClick={() => (setPlayer(n), setMode("home"))}>
                  <span className="font-semibold">{all[n].shopName}</span>
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
        <ShopFront s={s}>
          <div className="space-y-2 py-4 text-center">
            <p className="text-5xl" aria-hidden>
              🌙
            </p>
            <p className="text-xl font-bold">Shop closed for the day!</p>
            <p className="text-lg">
              You earned <strong>{fmt(dayTake.money, c)}</strong> today
            </p>
            <p className="text-2xl">
              {"⭐".repeat(dayTake.stars)} <span className="text-sm text-muted">({dayTake.stars} of {PER_DAY * 3} stars)</span>
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
          <div className="flex items-center justify-between text-sm text-muted">
            <span>
              Customer <strong className="text-ink">{served + 1}</strong> of {PER_DAY}
            </span>
            <span>Price list</span>
          </div>
          <PriceList s={s} />
          <div key={served} className="flex items-start gap-3" style={{ animation: "ls-in .4s ease" }}>
            <span className="text-6xl leading-none" aria-hidden>
              {order.who[0]}
            </span>
            <div className="flex-1 rounded-2xl rounded-tl-md bg-surface p-3 shadow-sm">
              <p className="text-sm text-muted">{order.who[1]} wants:</p>
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

        {thanks ? <p className="rounded-2xl bg-accent-soft p-3 text-center font-semibold text-accent">{thanks} ✓</p> : null}
        {hint && !thanks ? <p className="rounded-2xl bg-surface-2 p-3 text-center text-danger">{hint}</p> : null}

        <div>
          <p className="mb-1.5 text-sm font-medium text-muted">Change to give (tap to take back)</p>
          <div className="flex min-h-[4.5rem] flex-wrap items-center gap-2 rounded-2xl border-2 border-dashed border-line p-2.5">
            {tray.length ? (
              tray.map((v, i) => (
                <button key={`${i}-${v}`} type="button" aria-label={`Take back ${fmt(v, c)}`} onClick={() => (setTray((t) => t.filter((_, j) => j !== i)), setHint(null))}>
                  <Cash m={purse.find((m) => m.value === v) ?? { value: v, kind: "coin" }} c={c} small />
                </button>
              ))
            ) : (
              <span className="px-2 text-muted">Empty</span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2.5">
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
        <p className="text-center text-sm text-muted">Today&apos;s price list</p>
        <PriceList s={s} />
        <p className="text-center text-sm">
          {s.served} customers served · {s.stars} ⭐
        </p>
      </ShopFront>
      <button type="button" className="btn-primary w-full text-lg" onClick={openShop}>
        🔔 Open the shop ({PER_DAY} customers)
      </button>
      <div className="space-y-2">
        <p className="font-semibold">Upgrades</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {UPGRADES.map((u) => {
            const owned = s.owned.includes(u.id);
            const price = cost(u, c);
            return (
              <div key={u.id} className={`flex items-center gap-3 rounded-xl border p-2.5 ${owned ? "border-accent/40 bg-accent-soft" : "border-line bg-surface"}`}>
                <span className="text-3xl" aria-hidden>
                  {u.emoji}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{u.name}</span>
                  <span className="block text-xs text-muted">{u.what}</span>
                </span>
                {owned ? (
                  <span className="text-sm font-semibold text-accent">Yours ✓</span>
                ) : (
                  <button type="button" className="btn-secondary h-10 px-3 text-sm tabular-nums" disabled={s.money < price} onClick={() => update({ money: s.money - price, owned: [...s.owned, u.id] })}>
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

