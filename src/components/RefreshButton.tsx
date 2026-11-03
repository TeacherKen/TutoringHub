"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { postJson } from "@/lib/postJson";
import { play } from "@/lib/sounds";

/** Fetch new lessons from Google Calendar now. The arrow spins while it works and chimes when done. */
export function RefreshButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok?: boolean; message?: string } | null>(null);
  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        className="glass press flex h-11 items-center gap-2 rounded-[14px] px-4 font-medium"
        disabled={pending}
        aria-busy={pending}
        onClick={() => {
          play("tap");
          start(async () => {
            // Its own web address (not a Server Action), so other buttons don't wait behind it.
            const r = await postJson<{ ok?: boolean; changed?: boolean; message?: string }>("/api/calendar/catch-up", { force: true });
            const ok = r.ok !== false && !r.error;
            setMsg({ ok, message: r.message ?? r.error });
            if (ok) play("refresh");
            if (r.changed) router.refresh();
          });
        }}
      >
        <svg viewBox="0 0 24 24" width="18" height="18" className={pending ? "spin" : ""} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M21 12a9 9 0 1 1-3-6.7L21 8" />
          <path d="M21 3v5h-5" />
        </svg>
        <span className="max-sm:sr-only">{pending ? "Refreshing…" : "Refresh"}</span>
      </button>
      {msg && !pending ? (
        <span role="status" className={`max-w-56 text-right text-xs ${msg.ok ? "text-muted" : "text-danger"}`}>
          {msg.message}
        </span>
      ) : null}
    </div>
  );
}
