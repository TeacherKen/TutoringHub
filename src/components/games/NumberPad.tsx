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

  // Chunky keys that press down, like real buttons.
  const key = "flex h-16 items-center justify-center rounded-2xl text-3xl font-bold tabular-nums transition-[transform,box-shadow] duration-75 select-none active:translate-y-1";
  const digit = `${key} bg-surface text-ink shadow-[0_4px_0_var(--color-line),inset_0_0_0_1.5px_var(--color-line)] hover:brightness-[.97] active:shadow-[0_0_0_var(--color-line),inset_0_0_0_1.5px_var(--color-line)]`;
  return (
    <div className="mx-auto w-full max-w-sm space-y-3">
      <div
        aria-live="polite"
        aria-label="Your answer"
        className={`flex h-20 items-center justify-center rounded-2xl border-[3px] bg-surface text-5xl font-black tabular-nums shadow-[inset_0_3px_8px_rgba(0,0,0,.08)] ${wrong ? "pz-anim animate-[pz-shake_.35s] border-danger text-danger" : "border-line text-ink"}`}
      >
        {value || <span className="text-muted/40">?</span>}
      </div>
      <div className="grid grid-cols-3 gap-2.5">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <button key={d} type="button" className={digit} onClick={() => value.length < max && onChange(value + d)}>
            {d}
          </button>
        ))}
        <button type="button" aria-label="Delete" className={`${digit} !text-2xl !text-muted`} onClick={() => onChange(value.slice(0, -1))}>
          ⌫
        </button>
        <button type="button" className={digit} onClick={() => value.length < max && onChange(value + "0")}>
          0
        </button>
        <button
          type="button"
          className={`${key} bg-[linear-gradient(#3cbf6e,#2a9d57)] text-2xl text-white shadow-[0_4px_0_#1d7a41] active:shadow-none disabled:translate-y-0 disabled:opacity-40 disabled:shadow-[0_4px_0_#1d7a41]`}
          disabled={!value}
          onClick={onSubmit}
        >
          ✓ OK
        </button>
      </div>
    </div>
  );
}
