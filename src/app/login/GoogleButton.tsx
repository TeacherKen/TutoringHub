"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function GoogleButton() {
  const [busy, setBusy] = useState(false);
  async function signIn() {
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback`, queryParams: { prompt: "select_account" } },
    });
    if (error) setBusy(false);
  }
  return (
    <button type="button" onClick={signIn} disabled={busy} className="btn-primary w-full">
      {busy ? "Opening Google…" : "Sign in with Google"}
    </button>
  );
}
