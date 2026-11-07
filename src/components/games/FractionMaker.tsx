"use client";
import { useState } from "react";
import { compareFrac, compareWorking, fracText, mixed, sameBottoms, sumWorking, type Frac } from "@/lib/fractions";
import { Bar, FracText, Pie } from "./FractionShapes";

// 🧑‍🏫 Teacher fraction maker (inside Pizza Fractions): Mr Ken types two fractions to show the class,
// e.g. 1/2 and 7/9. They appear as pizzas and as bars lined up underneath, so the children can see them.
// Then: "Which is bigger?", "Add them" or "Take away", with the working revealed one step at a time.

const MAX_D = 12;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const range = (n: number) => Array.from({ length: n }, (_, i) => i);

/** The pizzas for a fraction: one pizza per whole (5/4 = one full pizza and a quarter of another). */
function Pizzas({ f, size = 120 }: { f: Frac; size?: number }) {
  const count = Math.max(1, Math.ceil(f.n / f.d));
  return (
    <div className="flex flex-wrap justify-center gap-2">
      {range(Math.min(count, 4)).map((k) => (
        <Pie key={k} parts={f.d} shaded={range(clamp(f.n - k * f.d, 0, f.d))} size={size} label={`Pizza ${k + 1}`} />
      ))}
    </div>
  );
}

/** Bars for a fraction, lined up so two fractions can be compared by eye (one bar per whole). */
function Bars({ f, label }: { f: Frac; label: string }) {
  const count = Math.max(1, Math.ceil(f.n / f.d));
  return (
    <div className="flex items-center gap-2">
      <span className="w-12 shrink-0 text-right">
        <FracText f={f} className="text-xl" />
      </span>
      <div className="grid flex-1 gap-1" style={{ gridTemplateColumns: `repeat(${Math.min(count, 3)}, minmax(0, 1fr))` }}>
        {range(Math.min(count, 3)).map((k) => (
          <Bar key={k} parts={f.d} shaded={range(clamp(f.n - k * f.d, 0, f.d))} label={`${label}, bar ${k + 1}`} plain />
        ))}
      </div>
    </div>
  );
}

function NumBox({ value, onChange, min, max, label }: { value: number; onChange: (v: number) => void; min: number; max: number; label: string }) {
  const btn = "grid h-11 w-11 place-items-center rounded-xl bg-surface-2 text-xl font-bold hover:bg-line active:scale-95 disabled:opacity-30";
  return (
    <div className="flex items-center gap-1.5">
      <button type="button" className={btn} aria-label={`${label} down`} disabled={value <= min} onClick={() => onChange(clamp(value - 1, min, max))}>
        −
      </button>
      <input
        type="number"
        inputMode="numeric"
        aria-label={label}
        min={min}
        max={max}
        value={value}
        onChange={(e) => {
          const v = parseInt(e.target.value, 10);
          if (!Number.isNaN(v)) onChange(clamp(v, min, max));
        }}
        className="input h-12 w-16 text-center text-2xl font-bold tabular-nums"
      />
      <button type="button" className={btn} aria-label={`${label} up`} disabled={value >= max} onClick={() => onChange(clamp(value + 1, min, max))}>
        +
      </button>
    </div>
  );
}

function FracInput({ name, f, onChange }: { name: string; f: Frac; onChange: (f: Frac) => void }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl bg-surface-2/60 p-3">
      <p className="text-sm font-semibold uppercase tracking-wide text-muted">Fraction {name}</p>
      <NumBox label={`Fraction ${name} top number`} value={f.n} min={0} max={f.d * 3} onChange={(n) => onChange({ ...f, n })} />
      <span aria-hidden className="h-1 w-24 rounded-full bg-current" />
      <NumBox label={`Fraction ${name} bottom number`} value={f.d} min={1} max={MAX_D} onChange={(d) => onChange({ n: Math.min(f.n, d * 3), d })} />
      <Pizzas f={f} />
    </div>
  );
}

type Show = null | "compare" | "+" | "-";

export function FractionMaker({ onBack }: { onBack: () => void }) {
  const [a, setA] = useState<Frac>({ n: 1, d: 2 });
  const [b, setB] = useState<Frac>({ n: 7, d: 9 });
  const [show, setShow] = useState<Show>(null);
  const [steps, setSteps] = useState(0);

  const edit = (set: (f: Frac) => void) => (f: Frac) => {
    set(f);
    setShow(null);
    setSteps(0);
  };
  const open = (s: Show) => {
    setShow(s);
    setSteps(1);
  };

  // Take away: always bigger − smaller, so the answer is never below zero.
  const bigFirst = compareFrac(a, b) >= 0;
  const [x, y] = show === "-" && !bigFirst ? [b, a] : [a, b];
  const lines = show === "compare" ? compareWorking(a, b) : show ? sumWorking(x, y, show).lines : [];
  const done = show != null && steps >= lines.length;
  const c = compareFrac(a, b);
  const w = sameBottoms(a, b);
  const sum = show === "+" || show === "-" ? sumWorking(x, y, show).simple : null;

  const pick = (s: Exclude<Show, null>, label: string) => (
    <button type="button" className={show === s ? "btn-primary flex-1" : "btn-secondary flex-1"} onClick={() => open(s)}>
      {label}
    </button>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <button type="button" className="btn-quiet min-h-10 px-0 text-sm text-muted" onClick={onBack}>
          ‹ Back
        </button>
        <p className="font-semibold">Teacher fraction maker</p>
        <span className="w-12" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <FracInput name="A" f={a} onChange={edit(setA)} />
        <FracInput name="B" f={b} onChange={edit(setB)} />
      </div>

      <div className="space-y-1.5 rounded-2xl border border-line p-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">Line them up</p>
        <Bars f={a} label="Fraction A" />
        <Bars f={b} label="Fraction B" />
      </div>

      <div className="flex flex-wrap gap-2">
        {pick("compare", "Which is bigger?")}
        {pick("+", "Add them +")}
        {pick("-", "Take away −")}
      </div>

      {show ? (
        <div className="space-y-2">
          <ol className="space-y-2">
            {lines.slice(0, steps).map((l, i) => (
              <li key={i} className="rounded-2xl bg-surface-2 px-3.5 py-2.5 text-lg">
                {l}
              </li>
            ))}
          </ol>

          {show === "compare" && steps >= 2 && a.d !== b.d && w.common <= 36 && !(a.n === b.n && a.n > 0) ? (
            <div className="space-y-1.5 rounded-2xl border border-line p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted">Same size slices ({w.common} parts)</p>
              <Bars f={w.a2} label={`${fracText(a)} as ${fracText(w.a2)}`} />
              <Bars f={w.b2} label={`${fracText(b)} as ${fracText(w.b2)}`} />
            </div>
          ) : null}

          {done ? (
            <div className="flex flex-wrap items-center justify-center gap-4 rounded-2xl border-2 border-accent bg-accent-soft p-4 text-accent">
              {show === "compare" ? (
                <span className="flex items-center gap-4">
                  <FracText f={a} className="text-5xl" />
                  <span className="text-5xl font-bold">{c > 0 ? ">" : c < 0 ? "<" : "="}</span>
                  <FracText f={b} className="text-5xl" />
                </span>
              ) : sum ? (
                <>
                  <span className="flex items-center gap-3">
                    <FracText f={x} className="text-4xl" />
                    <span className="text-4xl font-bold">{show === "+" ? "+" : "−"}</span>
                    <FracText f={y} className="text-4xl" />
                    <span className="text-4xl font-bold">=</span>
                    {sum.d === 1 ? (
                      <span className="text-5xl font-bold">{sum.n}</span>
                    ) : sum.n > sum.d ? (
                      <span className="flex items-center gap-1.5">
                        <span className="text-5xl font-bold">{mixed(sum).whole}</span>
                        <FracText f={mixed(sum).part} className="text-4xl" />
                      </span>
                    ) : (
                      <FracText f={sum} className="text-5xl" />
                    )}
                  </span>
                  {sum.n > 0 && sum.d <= 24 ? (
                    <div className="w-full">
                      <Pizzas f={sum} size={110} />
                    </div>
                  ) : null}
                </>
              ) : null}
            </div>
          ) : null}

          <div className="flex gap-2">
            <button type="button" className="btn-secondary" onClick={() => (setShow(null), setSteps(0))}>
              Hide
            </button>
            {!done ? (
              <button type="button" className="btn-primary flex-1" onClick={() => setSteps((s) => s + 1)}>
                {steps < lines.length - 1 ? "Next step" : "Show the answer"}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
