"use client";
import { useState, useTransition } from "react";
import { skipReminders } from "@/app/actions/lessons";

/** "Clear all": these lessons don't need a note (or feedback). Asks once before clearing. */
export function ClearAll({ kind, ids }: { kind: "note" | "feedback"; ids: string[] }) {
  const [ask, setAsk] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (!ids.length) return null;
  const what = kind === "note" ? "notes" : "feedback";
  if (!ask) {
    return (
      <button type="button" className="rounded-full px-3 py-1 text-sm font-medium text-accent hover:bg-accent-soft" onClick={() => setAsk(true)}>
        Clear all
      </button>
    );
  }
  return (
    <span className="flex flex-wrap items-center justify-end gap-1.5 text-sm">
      <span className="text-muted">
        No {what} needed for these {ids.length}?
      </span>
      <button
        type="button"
        disabled={pending}
        className="rounded-full bg-accent px-3 py-1 font-medium text-accent-text disabled:opacity-60"
        onClick={() =>
          start(async () => {
            const r = await skipReminders(kind, ids);
            if (r.error) setError(r.error);
            else setAsk(false);
          })
        }
      >
        {pending ? "Clearing…" : "Yes, clear"}
      </button>
      <button type="button" className="rounded-full px-2 py-1 text-muted hover:bg-surface-2" onClick={() => setAsk(false)}>
        Cancel
      </button>
      {error ? <span className="w-full text-right text-danger">{error}</span> : null}
    </span>
  );
}

/** One lesson: no note (or feedback) needed. */
export function SkipOne({ kind, id }: { kind: "note" | "feedback"; id: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState(false);
  return (
    <button
      type="button"
      disabled={pending}
      title={kind === "note" ? "No note needed for this lesson" : "No feedback needed for this lesson"}
      className={`min-h-10 shrink-0 rounded-full px-3 text-sm font-medium hover:bg-surface-2 disabled:opacity-50 ${error ? "text-danger" : "text-muted"}`}
      onClick={() =>
        start(async () => {
          const r = await skipReminders(kind, [id]);
          setError(!!r.error);
        })
      }
    >
      {pending ? "…" : error ? "Run update 0021" : "Skip"}
    </button>
  );
}
