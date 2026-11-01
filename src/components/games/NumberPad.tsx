"use client";
import { useEffect, useRef } from "react";

/**
 * A big number pad for iPads and phones (the on-screen keyboard would cover the question).
 * A computer keyboard works too: numbers, Backspace and Enter.
 */
export function NumberPad({ value, onChange, onSubmit, max = 3, wrong = false }: { value: string; onChange: (v: string) => void; onSubmit: () => void; max?: number; wrong?: boolean }) {
  const latest = useRef({ value, onChange, onSubmit, max });
  useEffect(() => {
    latest.current = { value, onChange, onSubmit, max };
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const { value: v, onChange: set, onSubmit: ok, max: m } = latest.current;
      if (/^\d$/.test(e.key)) {
        e.preventDefault();
        if (v.length < m) set(v + e.key);
      } else if (e.key === "Backspace") {
        e.preventDefault();
        set(v.slice(0, -1));
      } else if (e.key === "Enter") {
        e.preventDefault();
        ok();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const key = "flex h-16 items-center justify-center rounded-2xl text-3xl font-semibold tabular-nums transition active:scale-95 select-none";
  return (
    <div className="mx-auto w-full max-w-sm space-y-3">
      <div
        aria-live="polite"
        aria-label="Your answer"
        className={`flex h-20 items-center justify-center rounded-2xl border-2 text-5xl font-semibold tabular-nums ${wrong ? "border-danger text-danger" : "border-line"}`}
      >
        {value || <span className="text-muted/50">?</span>}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <button key={d} type="button" className={`${key} bg-surface-2 hover:bg-line`} onClick={() => value.length < max && onChange(value + d)}>
            {d}
          </button>
        ))}
        <button type="button" aria-label="Delete" className={`${key} bg-surface-2 text-2xl text-muted hover:bg-line`} onClick={() => onChange(value.slice(0, -1))}>
          ⌫
        </button>
        <button type="button" className={`${key} bg-surface-2 hover:bg-line`} onClick={() => value.length < max && onChange(value + "0")}>
          0
        </button>
        <button type="button" className={`${key} bg-accent text-2xl text-accent-text disabled:opacity-40`} disabled={!value} onClick={onSubmit}>
          OK
        </button>
      </div>
    </div>
  );
}
