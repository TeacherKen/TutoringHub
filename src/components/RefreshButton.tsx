"use client";
import { useState, useTransition } from "react";
import { refreshCalendar } from "@/app/actions/calendar";

export function RefreshButton() {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok?: boolean; message?: string } | null>(null);
  return (
    <div className="flex flex-col items-end">
      <button
        type="button"
        className="btn-quiet"
        disabled={pending}
        onClick={() => start(async () => setMsg(await refreshCalendar()))}
      >
        <svg viewBox="0 0 24 24" className={`h-5 w-5 ${pending ? "animate-spin" : ""}`} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
          <path d="M20 12a8 8 0 1 1-2.3-5.6M20 4v4h-4" />
        </svg>
        {pending ? "Refreshing…" : "Refresh"}
      </button>
      {msg && !pending ? (
        <span role="status" className={`text-xs ${msg.ok ? "text-muted" : "text-danger"}`}>
          {msg.message}
        </span>
      ) : null}
    </div>
  );
}
