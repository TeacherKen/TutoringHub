"use client";
import { useState } from "react";
import { play } from "@/lib/sounds";

// The To do card's button: what's waiting and how many, then Show / Hide for the full list.
// Closed at first, like the design, so Home stays calm; the count says when something is waiting.

export function TodoToggle({ summary, count, children }: { summary: string; count: number; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => {
          play("tap");
          setOpen((o) => !o);
        }}
        aria-expanded={open}
        className="glass press flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-left"
      >
        <span className="min-w-0 flex-1 font-medium">{summary}</span>
        <span className="grid h-7 min-w-7 place-items-center rounded-full px-2 text-sm font-bold tabular-nums" style={{ background: "rgba(251,191,36,0.18)", color: "var(--th-todo-text)" }}>
          {count}
        </span>
        <span className="font-semibold text-accent">{open ? "Hide" : "Show"}</span>
      </button>
      {open ? <div className="page-enter">{children}</div> : null}
    </>
  );
}
