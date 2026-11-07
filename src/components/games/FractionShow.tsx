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

export function FractionShow({ onBack }: { onBack: () => void }) {
  const [parts, setParts] = useState(2);
  const [on, setOn] = useState<number[]>([0]);
  const [shape, setShape] = useState<"pizza" | "bar">("pizza");
  const [hidden, setHidden] = useState(false);

  const n = on.length;
  const tap = (i: number) => setOn((s) => (s.includes(i) ? s.filter((x) => x !== i) : [...s, i]));
  const choose = (p: number) => {
    setParts(p);
    setOn([]);
  };
  const words = n === parts ? `${NUMBER_WORDS[n]} ${fracWords({ n, d: parts }).split(" ").slice(1).join(" ")} = 1 whole` : fracWords({ n, d: parts });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <button type="button" className="btn-quiet min-h-10 px-0 text-sm text-muted" onClick={onBack}>
          ‹ Back
        </button>
        <p className="font-semibold">Show a fraction</p>
        <span className="w-12" />
      </div>

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
            ["pizza", "🍕 Pizza"],
            ["bar", "🍫 Chocolate bar"],
          ] as const
        ).map(([k, label]) => (
          <button key={k} type="button" aria-pressed={shape === k} onClick={() => setShape(k)} className={`min-h-11 flex-1 rounded-xl border-2 font-semibold ${shape === k ? "border-accent bg-accent-soft text-accent" : "border-line bg-surface"}`}>
            {label}
          </button>
        ))}
      </div>

      <div className="flex flex-col items-center gap-5 rounded-2xl bg-surface-2/60 p-4 sm:flex-row sm:justify-center">
        <div className="w-full max-w-[300px]">
          {shape === "pizza" ? (
            <Pie parts={parts} shaded={on} onTap={tap} size={300} label={`Pizza cut into ${parts} equal slices. Tap a slice to colour it.`} />
          ) : (
            <Bar parts={parts} shaded={on} onTap={tap} label={`Chocolate bar with ${parts} equal pieces. Tap a piece to colour it.`} />
          )}
          <p className="mt-1 text-center text-sm text-muted">Tap a slice to colour it</p>
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

      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-secondary" onClick={() => setOn([])}>
          Clear
        </button>
        <button type="button" className="btn-secondary" onClick={() => setOn(Array.from({ length: parts }, (_, i) => i))}>
          Colour all
        </button>
        <button type="button" className={hidden ? "btn-primary flex-1" : "btn-secondary flex-1"} onClick={() => setHidden((h) => !h)}>
          {hidden ? "Show the fraction" : "Hide the number (ask first)"}
        </button>
      </div>
    </div>
  );
}
