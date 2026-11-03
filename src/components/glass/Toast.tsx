"use client";
import { useEffect, useState } from "react";

// 💬 One small message at the bottom of the screen ("Marked ready"), used by any page:
// call toast("…") from a button; <GlassToast/> (in the app layout) shows it for 2 seconds.

export function toast(text: string) {
  window.dispatchEvent(new CustomEvent("th-toast", { detail: text }));
}

export function GlassToast() {
  const [msg, setMsg] = useState<{ text: string; n: number } | null>(null);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const on = (e: Event) => {
      const text = String((e as CustomEvent).detail ?? "");
      setMsg((m) => ({ text, n: (m?.n ?? 0) + 1 }));
      clearTimeout(timer);
      timer = setTimeout(() => setMsg(null), 2000);
    };
    window.addEventListener("th-toast", on);
    return () => {
      window.removeEventListener("th-toast", on);
      clearTimeout(timer);
    };
  }, []);
  return msg ? (
    <div key={msg.n} role="status" className="glass-hi th-toast">
      {msg.text}
    </div>
  ) : (
    <div role="status" className="sr-only" />
  );
}
