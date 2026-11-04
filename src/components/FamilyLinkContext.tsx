"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { ensureFamilyToken } from "@/app/actions/family";

// 🏠 The family's private page link, shared by the parent messages on a page (lesson note, renewal,
// monthly report). One tick box adds the link to the end of the message for Copy and Send alike.

const PREF = "tutoringhub.addFamilyLink";

type Family = {
  names: string;
  token: string | null;
  add: boolean;
  busy: boolean;
  setAdd: (v: boolean) => Promise<void>;
  /** The link's token, making it first if needed. */
  getToken: () => Promise<string | null>;
};
const Ctx = createContext<Family | null>(null);

export function FamilyLinkProvider({ accountId, names, initialToken, children }: { accountId: string; names: string; initialToken: string | null; children: React.ReactNode }) {
  const [token, setToken] = useState(initialToken);
  const [add, setAddState] = useState(false);
  const [busy, setBusy] = useState(false);
  // On by default once the family has a link; the choice is remembered on this device.
  useEffect(() => {
    if (!token) return;
    let on = true;
    try {
      on = localStorage.getItem(PREF) !== "off";
    } catch {
      /* ignore */
    }
    setAddState(on); // eslint-disable-line react-hooks/set-state-in-effect -- reads this device's saved choice once
  }, [token]);

  async function setAdd(next: boolean) {
    try {
      localStorage.setItem(PREF, next ? "on" : "off");
    } catch {
      /* ignore */
    }
    if (next && !token) {
      setBusy(true);
      const r = await ensureFamilyToken(accountId);
      setBusy(false);
      if (!r.token) return;
      setToken(r.token);
    }
    setAddState(next);
  }
  async function getToken() {
    if (token) return token;
    const r = await ensureFamilyToken(accountId);
    if (r.token) setToken(r.token);
    return r.token ?? null;
  }
  return <Ctx.Provider value={{ names, token, add, busy, setAdd, getToken }}>{children}</Ctx.Provider>;
}

/** The message as it will be copied or sent: with the family link at the end when ticked. */
export function useWithFamily(): (text: string) => string {
  const f = useContext(Ctx);
  return (text) => (f?.add && f.token && text.trim() ? `${text.trimEnd()}\n\nYou can see ${f.names}'s lessons and progress anytime here: ${window.location.origin}/family/${f.token}` : text);
}

/** "Add the family page link" tick box (shown only on pages that know the family). */
export function FamilyLinkTick() {
  const f = useContext(Ctx);
  if (!f) return null;
  return (
    <label className="flex min-h-10 cursor-pointer items-center gap-2.5 text-sm text-[var(--th-text-2,inherit)]">
      <input type="checkbox" className="h-5 w-5" checked={f.add} disabled={f.busy} onChange={(e) => void f.setAdd(e.target.checked)} />
      {f.busy ? "Making the family link…" : `Add ${f.names}'s family page link to the message`}
    </label>
  );
}

export const useFamily = () => useContext(Ctx);
