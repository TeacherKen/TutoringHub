"use client";
import "@fontsource/barlow-condensed/700.css";
import "@fontsource/barlow-condensed/700-italic.css";
import "@fontsource/barlow-condensed/800-italic.css";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { pickRound, type FactState } from "@/lib/facts";
import { setSoundOn, sfx, soundOn } from "@/lib/gameSound";
import type { MatchState } from "@/lib/match";
import { Stadium } from "./Stadium";
import { ConfettiBurst, Controls, GLASS, makeConfetti, PANEL, type Confetti } from "./Controls";
import { useKeys, usePenalty } from "./usePenalty";
import { SEAT_KITS } from "./PlayHub";

// ⚔️ Head-to-head: each child on their own device races to score first. The server checks
// every answer; this screen checks for changes every second (and instantly when the other
// device says something happened).

const DEVICE_KEY = "tutoringhub-device";

function deviceId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = crypto.randomUUID().replace(/-/g, "");
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}

export function Match({ token, initial }: { token: string; initial: MatchState }) {
  const [state, setState] = useState(initial);
  const [device] = useState(deviceId);
  const [offset, setOffset] = useState(0); // server clock minus this device's clock
  const [now, setNow] = useState(() => Date.parse(initial.now));
  const [sound, setSound] = useState(() => (typeof window === "undefined" ? true : soundOn()));
  const router = useRouter();
  const [fact, setFact] = useState<string | null>(null);
  const [kickNo, setKickNo] = useState(0);
  const [myGoals, setMyGoals] = useState(0);
  const [confetti, setConfetti] = useState<Confetti[]>([]);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const [link, setLink] = useState("");
  const queue = useRef<string[]>([]);
  const progress = useRef<FactState[] | null>(null);
  const channel = useRef<RealtimeChannel | null>(null);
  const lastStatus = useRef(initial.status);
  const pen = usePenalty({ holdGoal: 950, holdSave: 1800 });

  const me = state.me ? state.players.find((p) => p.id === state.me!.id) : undefined;
  const startsIn = state.startsAt ? Date.parse(state.startsAt) - (now + offset) : 0;
  const live = state.status === "playing" && !!me && startsIn <= 0;

  /** The next question for this device's player (their own tables; weak facts first). */
  const nextFact = useCallback((s: MatchState) => {
    const p = s.me ? s.players.find((x) => x.id === s.me!.id) : undefined;
    if (!p || !s.me) return null;
    if (!queue.current.length) queue.current = pickRound(p.tables, progress.current ?? [], new Date(), 20);
    return queue.current.shift() ?? null;
  }, []);

  const apply = useCallback(
    (s: MatchState, full = false) => {
      setOffset(Date.parse(s.now) - Date.now());
      if (s.me && full) progress.current = s.me.progress;
      if (!s.me) progress.current = null;
      setState(s);
      if (s.status === "done" && lastStatus.current !== "done") {
        const iWon = !!s.me && s.winner === s.me.id;
        if (iWon) {
          sfx.win();
          setConfetti(makeConfetti(["#ffc629", "#ffffff", SEAT_KITS[s.players.find((p) => p.id === s.winner)?.seat ?? 0].shirt], 60));
        } else sfx.whistle();
      }
      if (s.status === "playing" && lastStatus.current === "waiting") sfx.whistle();
      lastStatus.current = s.status;
    },
    [],
  );

  const load = useCallback(async () => {
    const full = !progress.current;
    const res = await fetch(`/api/match/${token}?device=${device ?? ""}${full ? "&progress=1" : ""}`, { cache: "no-store" });
    if (res.ok) apply((await res.json()) as MatchState, full);
  }, [token, device, apply]);

  // Check for changes every second (slower once the match is over).
  useEffect(() => {
    let alive = true;
    const tick = () => void load().catch(() => undefined);
    const first = setTimeout(tick, 0);
    const id = setInterval(() => alive && tick(), state.status === "done" ? 5000 : state.status === "playing" ? 1500 : 2000);
    return () => {
      alive = false;
      clearTimeout(first);
      clearInterval(id);
    };
  }, [load, state.status]);

  // Instant nudges between devices.
  useEffect(() => {
    let sb: ReturnType<typeof createClient>;
    try {
      sb = createClient();
    } catch {
      return;
    }
    const ch = sb.channel(`tutoringhub-match-${token}`, { config: { broadcast: { self: false, ack: false } } });
    ch.on("broadcast", { event: "update" }, () => void load().catch(() => undefined)).subscribe();
    channel.current = ch;
    return () => {
      channel.current = null;
      void sb.removeChannel(ch);
    };
  }, [token, load]);
  const nudge = () => void channel.current?.send({ type: "broadcast", event: "update", payload: {} }).catch(() => undefined);

  // Countdown clock, and the first question when the whistle goes.
  useEffect(() => {
    if (state.status !== "playing") return;
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (state.startsAt && Date.parse(state.startsAt) <= t + offset) setFact((f) => f ?? nextFact(state));
    }, 200);
    return () => clearInterval(id);
  }, [state, offset, nextFact]);

  // Rematch: everyone moves to the new match together.
  useEffect(() => {
    if (state.nextToken) router.push(`/match/${state.nextToken}`);
  }, [state.nextToken, router]);

  // QR code so the other device can open this match.
  useEffect(() => {
    const url = window.location.href.split("?")[0];
    let alive = true;
    QRCode.toDataURL(url, { width: 360, margin: 1 }).then((d) => {
      if (!alive) return;
      setQr(d);
      setLink(url);
    });
    return () => {
      alive = false;
    };
  }, []);

  async function claim(id: string) {
    if (!device) return;
    sfx.tap();
    setClaiming(id);
    try {
      await fetch(`/api/match/${token}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ op: "join", player: id, device }) });
      queue.current = [];
      progress.current = null;
      setFact(null);
      await load();
      nudge();
    } finally {
      setClaiming(null);
      setPicking(false);
    }
  }

  const { kick: takeKick, typed } = pen;
  const shoot = useCallback(
    (aim?: number) => {
      if (!fact || !live || !device) return;
      const r = takeKick(fact, typed, {
        aim,
        onLand: (res) => res.correct && setMyGoals((g) => g + 1),
        onNext: (res) => {
          if (!res.correct) queue.current.splice(2, 0, res.fact); // it comes back soon
          setKickNo((n) => n + 1);
          setFact(nextFact(state));
        },
      });
      if (!r) return;
      fetch(`/api/match/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ op: "answer", device, fact, answer: Number(typed), ms: r.ms }),
      })
        .then(() => {
          nudge();
          return load();
        })
        .catch(() => undefined);
    },
    [fact, live, device, takeKick, typed, token, load, nextFact, state],
  );

  useKeys(live && !pen.shot && state.status === "playing", pen.press, shoot);

  function toggleSound() {
    setSoundOn(!sound);
    setSound(!sound);
  }

  const board = state.players.map((p) => ({
    name: p.name,
    goals: p.id === me?.id ? Math.max(p.goals, myGoals) : p.goals,
    colour: SEAT_KITS[p.seat].shirt,
    me: p.id === me?.id,
  }));

  // ---- Full time -------------------------------------------------------------------------
  if (state.status === "done") {
    const winner = state.players.find((p) => p.id === state.winner);
    const ranked = [...state.players].sort((a, b) => b.goals - a.goals);
    return (
      <section className={`${PANEL} relative space-y-6 overflow-hidden px-5 py-8 text-center`}>
        <ConfettiBurst pieces={confetti} />
        <p className="font-sport text-xl font-bold italic text-white/70">Full time</p>
        <h1 className="font-sport tt-pop text-[clamp(44px,8vw,84px)] font-extrabold italic leading-none text-[#ffc629]">{winner ? `${winner.name} wins!` : "Match over"}</h1>
        <div className="mx-auto max-w-md space-y-2">
          {ranked.map((p, n) => (
            <div key={p.id} className="font-sport flex items-stretch overflow-hidden rounded-lg text-[clamp(22px,4vw,32px)] font-bold leading-none shadow-lg">
              <span className="w-2" style={{ background: SEAT_KITS[p.seat].shirt }} />
              <span className="flex flex-1 items-center gap-3 bg-[#0b1d42] px-4 py-3 text-left uppercase tracking-wide">
                <span className="text-white/50">{n + 1}</span>
                {p.name}
              </span>
              <span className="min-w-[2.2em] bg-white px-3 py-3 font-extrabold tabular-nums text-[#0b1d42]">{p.goals}</span>
            </div>
          ))}
        </div>
        {me ? (
          <p className="text-white/75">{state.winner === me.id ? "Brilliant! 3 stars for the win." : "Good game! 1 star for playing. Rematch?"}</p>
        ) : null}
        <button
          type="button"
          className="font-sport h-16 rounded-2xl bg-[#ffc629] px-8 text-3xl font-extrabold italic text-[#0b1d42] shadow-lg transition hover:bg-[#ffd447] active:scale-95"
          onClick={() => {
            sfx.tap();
            void fetch(`/api/match/${token}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ op: "rematch" }) })
              .then((r) => r.json())
              .then((r: { token?: string }) => {
                nudge();
                if (r.token) router.push(`/match/${r.token}`);
              });
          }}
        >
          Rematch
        </button>
      </section>
    );
  }

  // ---- Who's playing? --------------------------------------------------------------------
  if (!me || picking) {
    return (
      <section className={`${PANEL} space-y-6 px-5 py-7`}>
        <div className="text-center">
          <h1 className="font-sport text-[clamp(38px,7vw,60px)] font-extrabold italic leading-none">Who&apos;s playing?</h1>
          <p className="mt-2 text-white/70">Tap your name. The match starts when everyone is ready.</p>
        </div>
        <div className="mx-auto grid max-w-2xl gap-3 sm:grid-cols-2">
          {state.players.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => claim(p.id)}
              disabled={!!claiming}
              className={`font-sport flex min-h-20 items-center justify-between gap-3 rounded-2xl px-5 text-left transition active:scale-95 ${GLASS} hover:bg-white/15`}
            >
              <span className="flex items-center gap-3">
                <span className="h-8 w-2 rounded-full" style={{ background: SEAT_KITS[p.seat].shirt }} />
                <span className="text-3xl font-bold">{p.name}</span>
              </span>
              <span className="text-right text-sm font-semibold leading-tight text-white/65">
                {claiming === p.id ? "Joining…" : p.joined ? "Playing on another device. Tap to switch here" : p.tables.map((t) => `${t}×`).join(" ")}
              </span>
            </button>
          ))}
        </div>
        <ShareMatch qr={qr} link={link} />
      </section>
    );
  }

  // ---- Waiting and countdown -------------------------------------------------------------
  if (state.status === "waiting" || startsIn > 0) {
    const secs = Math.ceil(startsIn / 1000);
    return (
      <section className={`${PANEL} space-y-6 px-5 py-8 text-center`}>
        {state.status === "playing" ? (
          <>
            <p className="font-sport text-2xl font-bold italic text-white/70">Get ready, {me.name}!</p>
            <p key={secs} className="font-sport tt-pop text-[120px] font-extrabold italic leading-none text-[#ffc629]">
              {secs > 0 ? secs : "Go!"}
            </p>
          </>
        ) : (
          <>
            <h1 className="font-sport text-[clamp(34px,6vw,52px)] font-extrabold italic leading-none">You&apos;re {me.name}</h1>
            <p className="text-white/70">Waiting for everyone to tap their name…</p>
          </>
        )}
        <div className="mx-auto flex max-w-xl flex-wrap justify-center gap-2">
          {state.players.map((p) => (
            <span key={p.id} className={`font-sport flex items-center gap-2 rounded-xl px-4 py-2 text-2xl font-bold ${GLASS}`}>
              <span className="h-5 w-1.5 rounded-full" style={{ background: SEAT_KITS[p.seat].shirt }} />
              {p.name}
              <span className={`text-base ${p.joined ? "text-[#9be15d]" : "text-white/50"}`}>{p.joined ? "ready" : "not yet"}</span>
            </span>
          ))}
        </div>
        {state.status === "waiting" ? (
          <>
            <ShareMatch qr={qr} link={link} />
            <button type="button" className="text-sm text-white/60 underline" onClick={() => setPicking(true)}>
              Wrong name? Choose again
            </button>
          </>
        ) : null}
      </section>
    );
  }

  // ---- The match -------------------------------------------------------------------------
  return (
    <section className={`${PANEL} mx-auto w-full max-w-6xl`}>
      <div className="grid gap-3 lg:grid-cols-[1.55fr_1fr] lg:items-stretch">
        <Stadium
          shot={pen.shot}
          aiming={!!pen.typed && !pen.shot}
          onAim={shoot}
          kit={SEAT_KITS[me.seat]}
          name={me.name}
          cheer={pen.cheer}
          banner={pen.banner}
          goals={[]}
          kicks={0}
          streak={pen.streak}
          sound={sound}
          onToggleSound={toggleSound}
          board={board}
          target={state.target}
        />
        <Controls fact={fact ?? `${me.tables[0]}x1`} typed={pen.typed} shot={pen.shot} clockKey={kickNo} onPress={pen.press} onKick={() => shoot()} locked={!fact} />
      </div>
    </section>
  );
}

function ShareMatch({ qr, link }: { qr: string | null; link: string }) {
  return (
    <div className={`mx-auto flex max-w-md items-center gap-4 rounded-2xl p-3 text-left ${GLASS}`}>
      {qr ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={qr} alt="QR code to open this match on another device" className="h-28 w-28 rounded-lg bg-white p-1" />
      ) : (
        <div className="h-28 w-28 rounded-lg bg-white/10" />
      )}
      <div className="min-w-0 space-y-2 text-sm">
        <p className="font-medium">Playing on another device?</p>
        <p className="text-white/70">Scan this with the iPad camera, or open the same link there.</p>
        <button
          type="button"
          className="rounded-lg bg-white/10 px-3 py-1.5 font-medium hover:bg-white/20"
          onClick={() => {
            void navigator.clipboard?.writeText(link);
          }}
        >
          Copy link
        </button>
      </div>
    </div>
  );
}
