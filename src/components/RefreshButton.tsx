"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { postJson } from "@/lib/postJson";

export function RefreshButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok?: boolean; message?: string } | null>(null);
  return (
    <div className="flex flex-col items-end">
      <button
        type="button"
        className="btn-quiet"
        disabled={pending}
        onClick={() =>
          start(async () => {
            // Its own web address (not a Server Action), so other buttons don't wait behind it.
            const r = await postJson<{ ok?: boolean; changed?: boolean; message?: string }>("/api/calendar/catch-up", { force: true });
            setMsg({ ok: r.ok !== false && !r.error, message: r.message ?? r.error });
            if (r.changed) router.refresh();
          })
        }
      >
        <svg viewBox="0 0 24 24" className={`h-5 w-5 ${pending ? "animate-spin" : ""}`} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
          <path d="M20 12a8 8 0 1 1-2.3-5.6M20 4v4h-4" />
        </svg>
        <span className="max-sm:sr-only">{pending ? "Refreshing…" : "Refresh"}</span>
      </button>
      {msg && !pending ? (
        <span role="status" className={`text-xs ${msg.ok ? "text-muted" : "text-danger"}`}>
          {msg.message}
        </span>
      ) : null}
    </div>
  );
}
