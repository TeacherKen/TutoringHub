"use client";
import { useState } from "react";
import { fracWords } from "@/lib/fractions";
import { Bar, FracText, Pie } from "./FractionShapes";

// 🧑‍🏫 "Show a fraction" (inside Pizza Fractions): for a child's very first fractions lesson.
// One big pizza (or chocolate bar). Pick how many equal slices, tap slices to colour them, and the
// fraction appears next to it straight away: 1/2, "1 half", "1 out of 2 equal slices".
// "Hide the number" lets Mr Ken ask "What fraction is this?" before showing it.

const SLICES = [2, 3, 4, 5, 6, 8, 10, 12];
const NUMBER_WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];

export type FractionView = { kind: "fraction"; parts: number; on: number[]; shape: "pizza" | "bar"; hidden: boolean };

/**
 * On its own it keeps its own state. With `value` + `onChange`, Mr Ken's taps are sent to the child's
 * screen (teach together). With `readOnly`, it just shows what Mr Ken is showing.
 */
export function FractionShow({ onBack, value, onChange, readOnly = false }: { onBack?: () => void; value?: FractionView; onChange?: (v: FractionView) => void; readOnly?: boolean }) {
  const [own, setOwn] = useState<FractionView>({ kind: "fraction", parts: 2, on: [0], shape: "pizza", hidden: false });
  const v = value ?? own;
  const set = (patch: Partial<FractionView>) => {
    if (readOnly) return;
    const next = { ...v, ...patch };
    if (onChange) onChange(next);
    else setOwn(next);
  };
  const { parts, on, shape, hidden } = v;
  const n = on.length;
  const tap = (i: number) => set({ on: on.includes(i) ? on.filter((x) => x !== i) : [...on, i] });
  const choose = (p: number) => set({ parts: p, on: [] });
  const words = n === parts ? `${NUMBER_WORDS[n]} ${fracWords({ n, d: parts }).split(" ").slice(1).join(" ")} = 1 whole` : fracWords({ n, d: parts });

  return (
    <div className="space-y-4">
      {onBack && !value ? (
        <div className="flex items-center justify-between gap-2">
          <button type="button" className="btn-quiet min-h-10 px-0 text-sm text-muted" onClick={onBack}>
            ‹ Back
          </button>
          <p className="font-semibold">Show a fraction</p>
          <span className="w-12" />
        </div>
      ) : null}

      {readOnly ? null : (
      <>
      <div className="space-y-1.5">
        <p className="text-sm font-medium text-muted">How many equal slices?</p>
        <div className="flex flex-wrap gap-1.5">
          {SLICES.map((p) => (
            <button key={p} type="button" aria-pressed={parts === p} onClick={() => choose(p)} className={`h-12 min-w-12 rounded-xl border-2 px-3 text-lg font-bold tabular-nums ${parts === p ? "border-accent bg-accent-soft text-accent" : "border-line bg-surface"}`}>
              {p}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        {(
          [
            ["pizza", "Pizza"],
            ["bar", "Chocolate bar"],
          ] as const
        ).map(([k, label]) => (
          <button key={k} type="button" aria-pressed={shape === k} onClick={() => set({ shape: k })} className={`min-h-11 flex-1 rounded-xl border-2 font-semibold ${shape === k ? "border-accent bg-accent-soft text-accent" : "border-line bg-surface"}`}>
            {label}
          </button>
        ))}
      </div>
      </>
      )}

      <div className="flex flex-col items-center gap-5 rounded-2xl bg-surface-2/60 p-4 sm:flex-row sm:justify-center">
        <div className="w-full max-w-[300px]">
          {shape === "pizza" ? (
            <Pie parts={parts} shaded={on} onTap={readOnly ? undefined : tap} size={300} label={`Pizza cut into ${parts} equal slices. Tap a slice to colour it.`} />
          ) : (
            <Bar parts={parts} shaded={on} onTap={readOnly ? undefined : tap} label={`Chocolate bar with ${parts} equal pieces. Tap a piece to colour it.`} />
          )}
          {readOnly ? null : <p className="mt-1 text-center text-sm text-muted">Tap a slice to colour it</p>}
        </div>

        <div className="flex min-w-[11rem] flex-col items-center gap-2 text-center">
          {hidden ? (
            <span className="grid h-40 w-32 place-items-center rounded-2xl border-4 border-dashed border-accent text-7xl font-bold text-accent">?</span>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <FracText f={{ n, d: parts }} className="text-8xl text-accent" />
                <span className="flex flex-col justify-between gap-6 text-left text-xs leading-tight text-muted">
                  <span>
                    ← coloured
                    <br />
                    slices
                  </span>
                  <span>
                    ← equal slices
                    <br />
                    altogether
                  </span>
                </span>
              </div>
              <p className="text-xl font-semibold">{words}</p>
              <p className="text-sm text-muted">
                {n} out of {parts} equal slices
              </p>
            </>
          )}
        </div>
      </div>

      {readOnly ? null : (
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-secondary" onClick={() => set({ on: [] })}>
          Clear
        </button>
        <button type="button" className="btn-secondary" onClick={() => set({ on: Array.from({ length: parts }, (_, i) => i) })}>
          Colour all
        </button>
        <button type="button" className={hidden ? "btn-primary flex-1" : "btn-secondary flex-1"} onClick={() => set({ hidden: !hidden })}>
          {hidden ? "Show the fraction" : "Hide the number (ask first)"}
        </button>
      </div>
      )}
    </div>
  );
}
