"use client";
import Link from "next/link";
import { useState } from "react";
import { NoteForm } from "@/components/FamilyNotes";
import { markFamilyNotesRead } from "@/app/actions/family";
import { netFail } from "@/lib/netFail";

// 💬 New messages from families, right on Home: who wrote, about which child, what they said,
// and a box to answer without leaving the page. Answering (or "Mark as read") clears the card.

export type InboxFamily = {
  accountId: string;
  who: string;
  kids: string;
  href: string;
  notes: { id: string; body: string; when: string; lesson: string | null }[];
};

export function FamilyInbox({ families }: { families: InboxFamily[] }) {
  if (!families.length) return null;
  const total = families.reduce((n, f) => n + f.notes.length, 0);
  return (
    <section aria-label="Messages from families" className="glass rounded-[22px] p-4 sm:p-5" style={{ borderColor: "var(--th-accent-line)" }}>
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <span aria-hidden>💬</span> Messages from families
        <span className="rounded-full bg-accent px-2 py-0.5 text-sm tabular-nums text-white">{total}</span>
      </h2>
      <div className="mt-3 flex flex-col gap-3">
        {families.map((f) => (
          <FamilyCard key={f.accountId} f={f} />
        ))}
      </div>
    </section>
  );
}

function FamilyCard({ f }: { f: InboxFamily }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="font-semibold">
          {f.who} <span className="font-normal text-[var(--th-text-3)]">· {f.kids}</span>
        </p>
        <Link href={f.href} className="text-sm text-accent underline-offset-2 hover:underline">
          Open all messages ›
        </Link>
      </div>
      <ul className="mt-2 space-y-2">
        {f.notes.map((n) => (
          <li key={n.id} className="rounded-2xl rounded-bl-md px-3.5 py-2.5 text-[15px]" style={{ background: "color-mix(in srgb, currentColor 7%, transparent)", border: "1px solid color-mix(in srgb, currentColor 14%, transparent)" }}>
            <p className="mb-0.5 text-xs opacity-70">
              {n.when}
              {n.lesson ? ` · about the ${n.lesson} lesson` : ""}
            </p>
            <p className="whitespace-pre-wrap break-words">{n.body}</p>
          </li>
        ))}
      </ul>
      <div className="mt-3">
        <NoteForm who="tutor" accountId={f.accountId} placeholder={`Reply to ${f.who}…`} />
      </div>
      <button
        type="button"
        className="btn-quiet mt-1 min-h-9 px-0 text-sm text-muted"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setErr(null);
          const r = await markFamilyNotesRead(f.accountId).catch(netFail);
          if (r?.error) setErr(r.error);
          setBusy(false);
        }}
      >
        {busy ? "…" : "Mark as read (no reply needed)"}
      </button>
      {err ? <p className="text-sm text-danger">{err}</p> : null}
    </div>
  );
}
