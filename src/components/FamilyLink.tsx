"use client";
import { useState } from "react";
import { ensureFamilyToken, resetFamilyToken } from "@/app/actions/family";
import { chatLink, type ChatApp } from "@/lib/chat";

/** Tutor: share a family's private progress page. */
export function FamilyLink({
  accountId,
  names,
  parentName,
  contactApp,
  contact,
  initialToken,
}: {
  accountId: string;
  names: string;
  parentName: string | null;
  contactApp: ChatApp;
  contact: string | null;
  initialToken: string | null;
}) {
  const [token, setToken] = useState(initialToken);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const flash = (what: string) => {
    setDone(what);
    setTimeout(() => setDone((d) => (d === what ? null : d)), 2500);
  };
  const url = (t: string) => `${window.location.origin}/family/${t}`;
  const message = (t: string) =>
    `Hi ${parentName?.trim() || "there"}, here is ${names}'s private maths page — lesson times, progress, my messages and pictures of their work: ${url(t)}`;

  async function get(): Promise<string | null> {
    if (token) return token;
    const r = await ensureFamilyToken(accountId);
    if (r.token) {
      setToken(r.token);
      return r.token;
    }
    setError(r.error ?? "Couldn't make the link.");
    return null;
  }

  return (
    <section className="card space-y-3">
      <div>
        <h2 className="h2">Family page</h2>
        <p className="text-sm text-muted">
          A private page for {names}&apos;s parents: next lessons, topic progress, messages you marked as sent, saved work, and hours left. No sign-in.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn-primary min-h-10 px-3 text-sm"
          onClick={async () => {
            const t = await get();
            if (!t) return;
            const link = chatLink(contactApp, contact, message(t));
            if (link) window.open(link.href, "_blank", "noopener");
            else {
              await navigator.clipboard.writeText(message(t)).catch(() => {});
              flash("send");
            }
          }}
        >
          {done === "send" ? "✓ Message copied" : chatLink(contactApp, contact, "x")?.label ?? "Copy message with link"}
        </button>
        <button
          type="button"
          className={`${done === "copy" ? "btn-primary" : "btn-secondary"} min-h-10 px-3 text-sm`}
          onClick={async () => {
            const t = await get();
            if (t && (await navigator.clipboard.writeText(url(t)).then(() => true, () => false))) flash("copy");
          }}
        >
          {done === "copy" ? "✓ Copied" : "Copy link"}
        </button>
        <button
          type="button"
          className="btn-secondary min-h-10 px-3 text-sm"
          onClick={async () => {
            const t = await get();
            if (t) window.open(url(t), "_blank", "noopener");
          }}
        >
          Preview
        </button>
        {token ? (
          <button
            type="button"
            className="text-xs text-muted underline"
            onClick={async () => {
              if (!confirm("Make a new family link? The old one will stop working, and the parent will be asked to confirm again.")) return;
              const r = await resetFamilyToken(accountId);
              if (r.token) {
                setToken(r.token);
                flash("reset");
              }
            }}
          >
            {done === "reset" ? "✓ New link made — send it again" : "New link"}
          </button>
        ) : null}
      </div>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <p className="text-xs text-muted">Only messages you tick as &quot;sent&quot; appear there. The first time a parent opens it, they confirm they are the parent or guardian.</p>
    </section>
  );
}
