"use client";
import "@fontsource/barlow-condensed/700.css";
import "@fontsource/barlow-condensed/800-italic.css";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MODE_EXAMPLES, MODE_NAMES, MODES, TABLES, type GameMode } from "@/lib/facts";
import { ensureRoomToken } from "@/app/actions/rooms";
import { startMatch } from "@/app/actions/match";
import { GLASS, PANEL } from "./Controls";
import { KITS } from "./Stadium";

type Kid = { id: string; name: string; token: string | null; tables: number[]; mode: GameMode; onsite: boolean };
export const SEAT_KITS = ["red", "blue", "yellow", "purple"].map((id) => KITS.find((k) => k.id === id)!);

/** Mr Ken's Play page: tap a child to practise on this device, or set up a match between children. */
export function PlayHub({ students }: { students: Kid[] }) {
  const router = useRouter();
  const [opening, setOpening] = useState<string | null>(null);
  const [picked, setPicked] = useState<{ id: string; tables: number[]; mode: GameMode }[]>([]);
  const [target, setTarget] = useState(10);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const sorted = [...students].sort((a, b) => Number(b.onsite) - Number(a.onsite) || a.name.localeCompare(b.name));

  function practise(k: Kid) {
    setOpening(k.id);
    start(async () => {
      const token = k.token ?? (await ensureRoomToken(k.id)).token;
      if (token) router.push(`/room/${token}?tab=practice`);
      else {
        setOpening(null);
        setError("Couldn't open the game. Try again.");
      }
    });
  }

  function toggle(k: Kid) {
    setPicked((p) => (p.some((x) => x.id === k.id) ? p.filter((x) => x.id !== k.id) : p.length >= 4 ? p : [...p, { id: k.id, tables: k.tables, mode: k.mode }]));
  }

  function setTables(id: string, t: number) {
    setPicked((p) =>
      p.map((x) => {
        if (x.id !== id) return x;
        const on = x.tables.includes(t);
        const next = on ? x.tables.filter((y) => y !== t) : [...x.tables, t].sort((a, b) => a - b);
        return { ...x, tables: next.length ? next : x.tables };
      }),
    );
  }

  function setMode(id: string, mode: GameMode) {
    setPicked((p) => p.map((x) => (x.id === id ? { ...x, mode } : x)));
  }

  function create() {
    setError(null);
    start(async () => {
      const r = await startMatch(
        picked.map((p) => ({ studentId: p.id, tables: p.tables, mode: p.mode })),
        target,
      );
      if (r.token) router.push(`/match/${r.token}`);
      else setError(r.error ?? "Couldn't start the match.");
    });
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="h1">Play</h1>
        <p className="mt-1 text-muted">Football Times Tables on this device, or a match between two to four children.</p>
      </header>

      <section className={`${PANEL} space-y-3 px-4 py-5 sm:px-6`}>
        <h2 className="font-sport text-3xl font-extrabold italic">Who&apos;s playing?</h2>
        <p className="text-sm text-white/70">Tap a name to practise on this device. Their chart and trophies update as they play.</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {sorted.map((k) => (
            <button
              key={k.id}
              type="button"
              onClick={() => practise(k)}
              disabled={pending}
              className={`font-sport flex min-h-16 items-center justify-between gap-2 rounded-xl px-4 text-left text-2xl font-bold transition active:scale-95 ${GLASS} hover:bg-white/15 disabled:opacity-60`}
            >
              <span className="truncate">{k.name}</span>
              <span className="text-right text-base font-semibold leading-tight text-white/60">
                {opening === k.id ? "Opening…" : `${k.mode === "times" ? "" : `${MODE_NAMES[k.mode]} · `}${k.tables.map((t) => `${t}×`).join(" ")}`}
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="card space-y-4">
        <div>
          <h2 className="h2">Head-to-head match</h2>
          <p className="mt-1 text-sm text-muted">
            Each child plays on their own device and races to score first. Each child gets their own tables, so a younger brother or sister can still win.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {sorted.map((k) => {
            const seat = picked.findIndex((p) => p.id === k.id);
            return (
              <button
                key={k.id}
                type="button"
                aria-pressed={seat >= 0}
                onClick={() => toggle(k)}
                className={`flex min-h-11 items-center gap-2 rounded-xl border px-3 text-sm font-medium transition active:scale-95 ${seat >= 0 ? "border-ink bg-surface-2" : "border-line bg-surface"}`}
              >
                <span className="h-3 w-3 rounded-full" style={{ background: seat >= 0 ? SEAT_KITS[seat].shirt : "var(--border)" }} />
                {k.name}
              </button>
            );
          })}
        </div>

        {picked.length ? (
          <div className="space-y-3">
            {picked.map((p, seat) => {
              const k = students.find((s) => s.id === p.id)!;
              return (
                <div key={p.id} className="flex flex-wrap items-center gap-2 border-b border-line pb-3 last:border-0">
                  <span className="flex w-24 items-center gap-2 font-medium">
                    <span className="h-3 w-3 rounded-full" style={{ background: SEAT_KITS[seat].shirt }} />
                    {k.name}
                  </span>
                  <select
                    value={p.mode}
                    onChange={(e) => setMode(p.id, e.target.value as GameMode)}
                    className="input min-h-9 w-auto py-1 text-sm"
                    aria-label={`Game for ${k.name}`}
                  >
                    {MODES.map((m) => (
                      <option key={m} value={m}>
                        {MODE_NAMES[m]} ({MODE_EXAMPLES[m]})
                      </option>
                    ))}
                  </select>
                  {TABLES.map((t) => {
                    const on = p.tables.includes(t);
                    return (
                      <button
                        key={t}
                        type="button"
                        aria-pressed={on}
                        onClick={() => setTables(p.id, t)}
                        className={`min-h-9 min-w-10 rounded-lg border px-1.5 text-sm font-semibold transition active:scale-95 ${on ? "border-green-600 bg-green-600 text-white" : "border-line bg-surface"}`}
                      >
                        {t}×
                      </button>
                    );
                  })}
                </div>
              );
            })}
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-medium">First to</span>
              {[5, 10, 15].map((g) => (
                <button
                  key={g}
                  type="button"
                  aria-pressed={target === g}
                  onClick={() => setTarget(g)}
                  className={`min-h-9 rounded-lg border px-3 font-semibold ${target === g ? "border-ink bg-surface-2" : "border-line bg-surface"}`}
                >
                  {g} goals
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <button type="button" className="btn-primary w-full sm:w-auto" disabled={picked.length < 2 || pending} onClick={create}>
          {pending && !opening ? "Starting…" : picked.length < 2 ? "Choose 2 to 4 players" : `Start match: ${picked.map((p) => students.find((s) => s.id === p.id)?.name).join(" vs ")}`}
        </button>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
      </section>
    </div>
  );
}
