"use client";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { cleanWvs, otherSide, SIDE_NAME, wvsChannel, type Peer, type Side, type WvsMove, type WvsMsg } from "@/lib/wvs";

export const WVS_SRC = "/games/wolf-vs-sheep/index.html?online=1";

/**
 * Connects this screen's Wolf vs Sheep (in an iframe) to the other screen: moves made here go
 * over the live connection, moves from there go into the game. `onMessage` hears everything else.
 */
export type WvsApi = { send: (m: WvsMsg) => void; toGame: (m: Record<string, unknown>) => void; moves: { current: WvsMove[] } };

export function useWolfLink(token: string | null, me: Peer, onMessage: (m: WvsMsg, api: WvsApi) => void) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const chRef = useRef<RealtimeChannel | null>(null);
  const moves = useRef<WvsMove[]>([]);
  const handler = useRef(onMessage);
  useLayoutEffect(() => {
    handler.current = onMessage;
  });

  const send = useCallback(
    (m: WvsMsg) => {
      void chRef.current?.send({ type: "broadcast", event: "wvs", payload: { ...m, from: me } });
    },
    [me],
  );
  const toGame = useCallback((m: Record<string, unknown>) => {
    frameRef.current?.contentWindow?.postMessage({ source: "tutoringhub", ...m }, location.origin);
  }, []);

  // The other screen.
  useEffect(() => {
    if (!token) return;
    let sb: ReturnType<typeof createClient>;
    try {
      sb = createClient();
    } catch {
      return;
    }
    moves.current = [];
    const ch = sb.channel(wvsChannel(token), { config: { broadcast: { self: false, ack: false } } });
    ch.on("broadcast", { event: "wvs" }, ({ payload }) => {
      const m = cleanWvs(payload);
      if (!m || !m.from || m.from === me) return;
      if (m.type === "move") toGame({ type: "move", n: m.n, move: m.move });
      else if (m.type === "restart") toGame({ type: "restart" });
      else if (m.type === "need-sync") send({ type: "sync", moves: moves.current });
      else if (m.type === "sync" && (m.moves?.length ?? 0) >= moves.current.length) toGame({ type: "sync", moves: m.moves });
      handler.current(m, { send, toGame, moves });
    }).subscribe();
    chRef.current = ch;
    return () => {
      chRef.current = null;
      void sb.removeChannel(ch);
    };
  }, [token, me, send, toGame]);

  // This screen's game.
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== location.origin || !frameRef.current || e.source !== frameRef.current.contentWindow) return;
      if ((e.data as { source?: string })?.source !== "wvs") return;
      const m = cleanWvs(e.data);
      if (!m) return;
      if (m.type === "state") moves.current = m.moves ?? [];
      else if (m.type === "move") send({ type: "move", n: m.n, move: m.move });
      else if (m.type === "restart") send({ type: "restart" });
      else if (m.type === "need-sync") send({ type: "need-sync" });
      handler.current({ ...m, local: true }, { send, toGame, moves });
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [send, toGame]);

  return { frameRef, send, toGame, moves };
}

/** Mr Ken's side: invite the student to a game and play it here. */
export function WolfOnlineTutor({ token, name }: { token: string; name: string }) {
  const [side, setSide] = useState<Side | null>(null);
  const [status, setStatus] = useState<"waiting" | "playing" | "left">("waiting");
  const sideRef = useRef<Side | null>(null);
  const statusRef = useRef(status);
  const lastHere = useRef(0);
  useLayoutEffect(() => {
    sideRef.current = side;
    statusRef.current = status;
  }, [side, status]);

  const { frameRef, send, moves } = useWolfLink(side ? token : null, "tutor", (m, api) => {
    const mine = sideRef.current;
    if (!mine) return;
    if (m.local) {
      if (m.type === "loaded") api.toGame({ type: "start", side: mine, moves: api.moves.current, opponent: name });
      return;
    }
    if (m.type === "here") {
      lastHere.current = Date.now();
      if (statusRef.current !== "playing") api.send({ type: "sync", moves: api.moves.current }); // just joined
      setStatus("playing");
    } else if (m.type === "left") setStatus("left");
  });

  // Keep inviting every few seconds (until they choose to leave): their room may open late, or
  // reload in the middle of a game — then it rejoins with every move so far.
  useEffect(() => {
    if (!side || status === "left") return;
    const invite = () => send({ type: "invite", studentSide: otherSide(side), moves: moves.current });
    invite();
    const id = setInterval(() => {
      invite();
      // Their room answers every invite; no answer for a while means they closed it.
      if (statusRef.current === "playing" && Date.now() - lastHere.current > 10_000) setStatus("waiting");
    }, 3000);
    return () => clearInterval(id);
  }, [side, status, send, moves]);

  // Closing the page ends the game on the student's screen too.
  useEffect(() => {
    if (!side) return;
    const end = () => send({ type: "end" });
    window.addEventListener("pagehide", end);
    return () => window.removeEventListener("pagehide", end);
  }, [side, send]);

  function stop() {
    send({ type: "end" });
    setSide(null);
    setStatus("waiting");
  }

  if (!side) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm">🐺🐑 Play Wolf vs Sheep with {name}. You are:</span>
        <button type="button" className="btn-secondary min-h-10 px-3 text-sm" onClick={() => setSide("wolf")}>
          {SIDE_NAME.wolf}
        </button>
        <button type="button" className="btn-secondary min-h-10 px-3 text-sm" onClick={() => setSide("sheep")}>
          {SIDE_NAME.sheep}
        </button>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm" role="status">
          You are the <strong>{SIDE_NAME[side]}</strong>, {name} is the <strong>{SIDE_NAME[otherSide(side)]}</strong> ·{" "}
          {status === "playing" ? (
            <span className="text-ok">{name} has joined ✓</span>
          ) : status === "left" ? (
            <>
              <span className="text-warn">{name} left the game.</span>{" "}
              <button type="button" className="text-accent underline" onClick={() => setStatus("waiting")}>
                Invite again
              </button>
            </>
          ) : (
            <span className="text-muted">Waiting for {name}… (their room link needs to be open)</span>
          )}
        </p>
        <button type="button" className="btn-secondary min-h-10 px-3 text-sm" onClick={stop}>
          End game
        </button>
      </div>
      <iframe ref={frameRef} src={WVS_SRC} title={`Wolf vs Sheep with ${name}`} className="w-full rounded-xl border border-line bg-surface" style={{ height: "75dvh" }} />
    </div>
  );
}
