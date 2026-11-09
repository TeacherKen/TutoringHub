"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { cleanTeach, teachChannel, type FractionDemo, type TeachMsg } from "@/lib/teach";
import { FractionShow } from "./games/FractionShow";

// 🧑‍🏫 Teach together. Mr Ken's side (on the lesson page): open it, tap the pizza, and the child's room
// shows the same pizza at the same moment. The child's side (in Room.tsx) uses useTeachListener.

function useTeachChannel(token: string | null, onMsg: (m: TeachMsg | { kind: "need" }) => void) {
  const ch = useRef<RealtimeChannel | null>(null);
  const handler = useRef(onMsg);
  useEffect(() => {
    handler.current = onMsg;
  });
  useEffect(() => {
    if (!token) return;
    let sb: ReturnType<typeof createClient>;
    try {
      sb = createClient();
    } catch {
      return;
    }
    const c = sb.channel(teachChannel(token), { config: { broadcast: { self: false, ack: false } } });
    c.on("broadcast", { event: "teach" }, ({ payload }) => {
      if ((payload as { kind?: string })?.kind === "need") return handler.current({ kind: "need" });
      const m = cleanTeach(payload);
      if (m) handler.current(m);
    }).subscribe((status) => {
      if (status === "SUBSCRIBED") void c.send({ type: "broadcast", event: "teach", payload: { kind: "need" } });
    });
    ch.current = c;
    return () => {
      ch.current = null;
      void sb.removeChannel(c);
    };
  }, [token]);
  return useCallback((payload: TeachMsg) => void ch.current?.send({ type: "broadcast", event: "teach", payload }), []);
}

const START: FractionDemo = { kind: "fraction", parts: 2, on: [0], shape: "pizza", hidden: false };

/** Mr Ken's side: a button, then the pizza he controls. */
export function TeachTogetherTutor({ token, name }: { token: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [demo, setDemo] = useState<FractionDemo>(START);
  const demoRef = useRef(demo);
  useEffect(() => {
    demoRef.current = demo;
  });
  // The child's room opened (or reloaded) late and asks what's showing: answer straight away.
  const [asked, setAsked] = useState(0);
  const send = useTeachChannel(open ? token : null, (m) => {
    if (m.kind === "need") setAsked((n) => n + 1);
  });

  // Every change goes straight over; and every few seconds again, in case the room missed one.
  useEffect(() => {
    if (!open) return;
    send(demo);
  }, [open, demo, send, asked]);
  useEffect(() => {
    if (!open) return;
    const id = setInterval(() => send(demoRef.current), 4000);
    return () => clearInterval(id);
  }, [open, send]);

  function stop() {
    send({ kind: "off" });
    setOpen(false);
  }

  if (!open) {
    return (
      <button type="button" className="btn-secondary min-h-10 w-full text-sm" onClick={() => setOpen(true)}>
        🧑‍🏫 Teach together: show {name} a fraction on their screen
      </button>
    );
  }
  return (
    <div className="space-y-2 rounded-2xl border-2 border-accent bg-surface p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-accent">🔴 Live on {name}&apos;s screen</p>
        <button type="button" className="btn-secondary min-h-11 px-3 text-sm" onClick={stop}>
          Stop showing
        </button>
      </div>
      <FractionShow onBack={stop} value={demo} onChange={setDemo} />
    </div>
  );
}

/** The child's side: what Mr Ken is showing right now (null when nothing). */
export function useTeachListener(token: string | null): FractionDemo | null {
  const [demo, setDemo] = useState<FractionDemo | null>(null);
  const lastSeen = useRef(0);
  useTeachChannel(token, (m) => {
    if (m.kind === "fraction") {
      lastSeen.current = Date.now();
      setDemo(m);
    } else if (m.kind === "off") setDemo(null);
  });
  // If Mr Ken's page closes without saying so, stop showing after a little while.
  useEffect(() => {
    if (!demo) return;
    const id = setInterval(() => Date.now() - lastSeen.current > 15_000 && setDemo(null), 3000);
    return () => clearInterval(id);
  }, [demo]);
  return demo;
}
