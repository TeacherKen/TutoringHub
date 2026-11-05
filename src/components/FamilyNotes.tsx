"use client";
import { useActionState, useEffect, useRef } from "react";
import { addFamilyNote, replyFamilyNote, type NoteState } from "@/app/actions/family";
import type { FamilyNote } from "@/lib/family";

// 💬 Messages between a family and Mr Ken: the bubbles, and the box to write in.
// The same pieces are used on the family page (parent writes) and on Mr Ken's student page (he replies).

const when = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Bangkok", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));

/** The conversation: the family's messages on one side, Mr Ken's on the other. `me` is whoever is reading. */
export function NoteThread({ notes, me, tutor, family }: { notes: FamilyNote[]; me: "parent" | "tutor"; tutor: string; family: string }) {
  if (!notes.length) return null;
  return (
    <ul className="space-y-2">
      {notes.map((n) => {
        const mine = n.author === me;
        return (
          <li key={n.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[15px] ${mine ? "rounded-br-md" : "rounded-bl-md"}`}
              style={
                n.author === "tutor"
                  ? { background: "color-mix(in srgb, var(--accent, #2f8f83) 16%, transparent)", border: "1px solid color-mix(in srgb, var(--accent, #2f8f83) 35%, transparent)" }
                  : { background: "color-mix(in srgb, currentColor 7%, transparent)", border: "1px solid color-mix(in srgb, currentColor 14%, transparent)" }
              }
            >
              <p className="mb-0.5 text-xs opacity-70">
                {n.author === "tutor" ? tutor : family} · {when(n.created_at)}
              </p>
              <p className="whitespace-pre-wrap break-words">{n.body}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** The write box. Parent: sends with the family link. Tutor: replies to that family. */
export function NoteForm({
  who,
  token,
  accountId,
  lessonId,
  placeholder,
}: {
  who: "parent" | "tutor";
  token?: string;
  accountId?: string;
  lessonId?: string | null;
  placeholder: string;
}) {
  const [state, action, pending] = useActionState<NoteState, FormData>(who === "parent" ? addFamilyNote : replyFamilyNote, null);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) form.current?.reset();
  }, [state]);
  return (
    <form ref={form} action={action} className="space-y-2">
      {token ? <input type="hidden" name="token" value={token} /> : null}
      {accountId ? <input type="hidden" name="account_id" value={accountId} /> : null}
      {lessonId ? <input type="hidden" name="lesson_id" value={lessonId} /> : null}
      <textarea name="body" required maxLength={1000} rows={2} placeholder={placeholder} className="input min-h-[72px] w-full resize-y py-2.5" />
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn-primary min-h-10 text-sm" disabled={pending}>
          {pending ? "Sending…" : "Send"}
        </button>
        {state?.ok ? <span className="text-sm text-ok">Sent ✓</span> : null}
        {state?.error ? <span className="text-sm text-danger">{state.error}</span> : null}
      </div>
    </form>
  );
}
