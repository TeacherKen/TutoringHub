"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { NEXT_COOKIE } from "@/lib/safeNext";

export function GoogleButton({ next }: { next?: string | null }) {
  const [busy, setBusy] = useState(false);
  async function signIn() {
    setBusy(true);
    // Remember where to go after Google (the callback reads this, then clears it).
    document.cookie = next ? `${NEXT_COOKIE}=${encodeURIComponent(next)}; path=/; max-age=600; samesite=lax` : `${NEXT_COOKIE}=; path=/; max-age=0`;
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
