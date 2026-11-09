"use client";
import { useEffect, useState } from "react";
import { removePushSubscription, savePushSubscription, sendTestPush } from "@/app/actions/push";
import { netFail } from "@/lib/netFail";

// 🔔 "Turn on notifications on this device". On an iPhone this only works in TutoringHub opened from the
// home-screen icon (Apple's rule), so the card says so when it's opened in Safari or Chrome instead.

type State = "checking" | "unsupported" | "needs-app" | "off" | "on" | "blocked" | "working";
const KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

function keyBytes(b64: string): Uint8Array {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export function PushToggle() {
  const [state, setState] = useState<State>("checking");
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
      const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !KEY) return setState(ios && !standalone ? "needs-app" : "unsupported");
      if (Notification.permission === "denied") return setState("blocked");
      const reg = await navigator.serviceWorker.getRegistration("/");
      const sub = await reg?.pushManager.getSubscription();
      setState(sub ? "on" : "off");
    })().catch(() => setState("unsupported"));
  }, []);

  async function turnOn() {
    setMsg(null);
    setState("working");
    try {
      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      await navigator.serviceWorker.ready;
      const ok = await Notification.requestPermission();
      if (ok !== "granted") return setState(ok === "denied" ? "blocked" : "off");
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(KEY) as BufferSource });
      const r = await savePushSubscription(sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } }).catch(netFail);
      if (r.error) {
        await sub.unsubscribe();
        setMsg(r.error);
        return setState("off");
      }
      setState("on");
      await sendTestPush().catch(netFail);
      setMsg("Done! A test notification is on its way.");
    } catch {
      setMsg("That didn't work on this device. Please try again.");
      setState("off");
    }
  }

  async function turnOff() {
    setState("working");
    try {
      const reg = await navigator.serviceWorker.getRegistration("/");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await removePushSubscription(sub.endpoint).catch(netFail);
        await sub.unsubscribe();
      }
      setMsg(null);
      setState("off");
    } catch {
      setMsg("Couldn't turn them off on this device. Please try again.");
      setState("on");
    }
  }

  return (
    <div className="space-y-2">
      {state === "on" ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="chip-ok">On for this device</span>
          <button type="button" className="btn-secondary min-h-10 text-sm" onClick={() => sendTestPush().catch(netFail).then(() => setMsg("Test sent."))}>
            Send a test
          </button>
          <button type="button" className="text-sm text-muted underline" onClick={turnOff}>
            Turn off
          </button>
        </div>
      ) : state === "off" || state === "working" ? (
        <button type="button" className="btn-primary min-h-11" disabled={state === "working"} onClick={turnOn}>
          {state === "working" ? "Turning on…" : "🔔 Turn on notifications on this device"}
        </button>
      ) : state === "needs-app" ? (
        <p className="text-sm text-[var(--th-text-2)]">
          On iPhone, open TutoringHub from its <strong>home-screen icon</strong> (not Safari or Chrome), then come back here to turn notifications on.
        </p>
      ) : state === "blocked" ? (
        <p className="text-sm text-[var(--th-text-2)]">Notifications are blocked for TutoringHub. Turn them on in your phone&apos;s Settings → Notifications → TutoringHub.</p>
      ) : state === "unsupported" ? (
        <p className="text-sm text-[var(--th-text-2)]">This browser can&apos;t show notifications. On iPhone, use the TutoringHub home-screen icon.</p>
      ) : null}
      {msg ? <p className="text-sm text-[var(--th-text-2)]">{msg}</p> : null}
    </div>
  );
}
