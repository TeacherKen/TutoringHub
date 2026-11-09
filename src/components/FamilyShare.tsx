"use client";
import { useState } from "react";
import { ensureFamilyToken } from "@/app/actions/family";
import { chatLink, type ChatApp } from "@/lib/chat";
import { play } from "@/lib/sounds";
import { toast } from "./glass/Toast";

// 🏠 On each Students card: has this family got their private page yet? One tap sends it.

export function FamilyShare({
  accountId,
  names,
  parentName,
  contactApp,
  contact,
  initialToken,
  opened,
}: {
  accountId: string;
  names: string;
  parentName: string | null;
  contactApp: ChatApp;
  contact: string | null;
  initialToken: string | null;
  /** The parent has opened it and confirmed they're the parent. */
  opened: boolean;
}) {
  const [token, setToken] = useState(initialToken);
  const [busy, setBusy] = useState(false);
  const status = opened ? { cls: "ok", text: "parents have it" } : token ? { cls: "", text: "link made, not opened yet" } : { cls: "", text: "not shared yet" };

  async function send() {
    play("tap");
    setBusy(true);
    let t = token;
    if (!t) {
      const r = await ensureFamilyToken(accountId);
      t = r.token ?? null;
      if (t) setToken(t);
    }
    setBusy(false);
    if (!t) return toast("Couldn't make the link. Try again.");
    // Weekly (or any time): the family page always has the latest lesson update, progress, hours and next lessons.
    const msg = opened || token
      ? `Hi ${parentName?.trim() || "there"}, here's ${names}'s maths update — my latest feedback, what we worked on, progress and the next lessons: ${window.location.origin}/family/${t}`
      : `Hi ${parentName?.trim() || "there"}, here is ${names}'s private maths page — lesson updates after each lesson, progress, hours left and the next lessons: ${window.location.origin}/family/${t}`;
    const link = chatLink(contactApp, contact, msg);
    if (link) window.open(link.href, "_blank", "noopener");
    else {
      await navigator.clipboard.writeText(msg).catch(() => {});
      toast("Message with the family link copied");
    }
  }

  return (
    <div className="pointer-events-auto relative flex items-center justify-between gap-2 border-t border-white/10 pt-3 text-sm">
      <span className="flex items-center gap-2 text-[var(--th-text-3)]">
        Family page
        <span className={`pill !py-0.5 !text-xs ${status.cls}`}>{status.text}</span>
      </span>
      <button type="button" onClick={send} disabled={busy} className="press min-h-11 rounded-full px-3 font-semibold text-accent hover:bg-white/5">
        {busy ? "Making…" : `${chatLink(contactApp, contact, "x") ? "Send" : "Copy"} ${token ? "update" : "link"}`}
      </button>
    </div>
  );
}
