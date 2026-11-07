"use client";
import { netFail } from "@/lib/netFail";
import "@fontsource/barlow-condensed/700.css";
import "@fontsource/barlow-condensed/800-italic.css";
import { useEffect, useState, useTransition } from "react";
import QRCode from "qrcode";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MODE_EXAMPLES, MODE_NAMES, MODES, TABLES, type GameMode } from "@/lib/facts";
import { ensureRoomToken } from "@/app/actions/rooms";
import { startMatch } from "@/app/actions/match";
import { KITS } from "./Stadium";
import { GAMES, type GameInfo } from "@/lib/games";
import { Glyph } from "./Arcade";
import { play } from "@/lib/sounds";

type Kid = { id: string; name: string; token: string | null; tables: number[]; mode: GameMode; onsite: boolean };
export const SEAT_KITS = ["red", "blue", "yellow", "purple"].map((id) => KITS.find((k) => k.id === id)!);

/** Mr Ken's Play page: tap a child to practise on this device, or set up a match between children. */
export function PlayHub({ students }: { students: Kid[] }) {
  const router = useRouter();
  const [opening, setOpening] = useState<string | null>(null);
  const [picked, setPicked] = useState<{ id: string; tables: number[]; mode: GameMode }[]>([]);
  const [target, setTarget] = useState(10);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const sorted = [...students].sort((a, b) => Number(b.onsite) - Number(a.onsite) || a.name.localeCompare(b.name));

  function practise(k: Kid) {
    setOpening(k.id);
    start(async () => {
      const token = k.token ?? (await ensureRoomToken(k.id).catch(netFail)).token;
      if (token) router.push(`/room/${token}?tab=practice`);
      else {
        setOpening(null);
        setError("Couldn't open the game. Try again.");
      }
    });
  }

  function toggle(k: Kid) {
    setPicked((p) =>
      p.some((x) => x.id === k.id) ? p.filter((x) => x.id !== k.id) : p.length >= 4 ? p : [...p, { id: k.id, tables: k.tables, mode: k.mode }],
    );
  }

  function setTables(id: string, t: number) {
    setPicked((p) =>
      p.map((x) => {
        if (x.id !== id) return x;
        const on = x.tables.includes(t);
        const next = on ? x.tables.filter((y) => y !== t) : [...x.tables, t].sort((a, b) => a - b);
        return { ...x, tables: next.length ? next : x.tables };
      }),
    );
  }

  function setMode(id: string, mode: GameMode) {
    setPicked((p) => p.map((x) => (x.id === id ? { ...x, mode } : x)));
  }

  function create() {
    setError(null);
    start(async () => {
      const r = await startMatch(
        picked.map((p) => ({ studentId: p.id, tables: p.tables, mode: p.mode })),
        target,
      ).catch(netFail);
      if (r.token) router.push(`/match/${r.token}`);
      else setError(r.error ?? "Couldn't start the match.");
    });
  }

  return (
    <div className="flex flex-col gap-[22px]">
      <header className="px-1.5 pt-1">
        <h1 className="font-display text-[36px] font-semibold leading-tight sm:text-[44px]">Play</h1>
        <p className="mt-1.5 text-base text-[var(--th-text-3)]">
          Games for lessons: the games corner on the iPad, Football Times Tables, or a match between two to four children.
        </p>
      </header>

      <GamesCorner />

      <section id="whos-playing" className="glass-hi flex scroll-mt-24 flex-col gap-[18px] rounded-[32px] p-5 sm:p-7">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-sport text-[40px] font-extrabold italic leading-none sm:text-[46px]">Who&apos;s playing?</h2>
            <p className="mt-2 text-[var(--th-text-2)]">Tap a name to practise on this device. Their chart and trophies update as they play.</p>
          </div>
          {opening ? <div className="font-semibold text-[var(--th-todo-text)]">Opening {students.find((k) => k.id === opening)?.name}&apos;s game…</div> : null}
        </div>
        <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(min(100%,250px),1fr))]">
          {sorted.map((k) => {
            const on = opening === k.id;
            return (
              <button
                key={k.id}
                type="button"
                onClick={() => {
                  play("pick");
                  practise(k);
                }}
                disabled={pending}
                aria-pressed={on}
                aria-label={`${k.name}: practise ${k.mode === "times" ? "" : `${MODE_NAMES[k.mode]}, `}${k.tables.map((t) => `${t} times`).join(", ")}`}
                className={`glass press flex min-h-[72px] items-center justify-between gap-2.5 rounded-[18px] px-[18px] py-4 text-left disabled:cursor-wait ${on ? "who-on" : ""}`}
              >
                <span className="font-sport min-w-0 truncate text-[32px] font-extrabold italic leading-none text-white">{k.name}</span>
                <span className="flex flex-wrap justify-end gap-1.5">
                  {k.mode !== "times" ? <span className="tt">{MODE_NAMES[k.mode]}</span> : null}
                  {k.tables.map((t) => (
                    <span key={t} className="tt on">
                      {t}×
                    </span>
                  ))}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <IPadSetup students={sorted} />

      <section className="glass flex flex-col gap-4 rounded-[26px] p-5 sm:p-[22px]">
        <div>
          <h2 className="font-display text-[22px] font-semibold">Head-to-head match</h2>
          <p className="mt-1 text-sm text-[var(--th-text-3)]">
            Each child plays on their own device and races to score first. Each child gets their own tables, so a younger brother or sister can still win.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {sorted.map((k) => {
            const seat = picked.findIndex((p) => p.id === k.id);
            return (
              <button
                key={k.id}
                type="button"
                aria-pressed={seat >= 0}
                onClick={() => {
                  play(seat >= 0 ? "undo" : "pick");
                  toggle(k);
                }}
                className={`glass press flex min-h-11 items-center gap-2 rounded-[14px] px-3.5 text-sm font-medium ${seat >= 0 ? "who-on" : ""}`}
              >
                <span className="h-3 w-3 rounded-full" style={{ background: seat >= 0 ? SEAT_KITS[seat].shirt : "rgba(255,255,255,0.18)" }} />
                {k.name}
              </button>
            );
          })}
        </div>

        {picked.length ? (
          <div className="space-y-3">
            {picked.map((p, seat) => {
              const k = students.find((s) => s.id === p.id)!;
              return (
                <div key={p.id} className="flex flex-wrap items-center gap-2 border-b border-white/10 pb-3 last:border-0">
                  <span className="flex w-24 items-center gap-2 font-medium">
                    <span className="h-3 w-3 rounded-full" style={{ background: SEAT_KITS[seat].shirt }} />
                    {k.name}
                  </span>
                  <select
                    value={p.mode}
                    onChange={(e) => setMode(p.id, e.target.value as GameMode)}
                    className="input min-h-9 w-auto py-1 text-sm"
                    aria-label={`Game for ${k.name}`}
                  >
                    {MODES.map((m) => (
                      <option key={m} value={m}>
                        {MODE_NAMES[m]} ({MODE_EXAMPLES[m]})
                      </option>
                    ))}
                  </select>
                  {TABLES.map((t) => {
                    const on = p.tables.includes(t);
                    return (
                      <button
                        key={t}
                        type="button"
                        aria-pressed={on}
                        onClick={() => {
                          play("toggle");
                          setTables(p.id, t);
                        }}
                        className={`tt press ${on ? "on" : ""}`}
                      >
                        {t}×
                      </button>
                    );
                  })}
                </div>
              );
            })}
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-medium">First to</span>
              {[5, 10, 15].map((g) => (
                <button
                  key={g}
                  type="button"
                  aria-pressed={target === g}
                  onClick={() => {
                    play("flip");
                    setTarget(g);
                  }}
                  className={`tt press !px-3 ${target === g ? "on" : ""}`}
                >
                  {g} goals
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <button
          type="button"
          className="btn-primary self-start max-sm:w-full"
          disabled={picked.length < 2 || pending}
          onClick={() => {
            play("launch");
            create();
          }}
        >
          {pending && !opening
            ? "Starting…"
            : picked.length < 2
              ? "Choose 2 to 4 players"
              : `Start match: ${picked.map((p) => students.find((s) => s.id === p.id)?.name).join(" vs ")}`}
        </button>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
      </section>
    </div>
  );
}

const TOPICS: { topic: GameInfo["topic"]; emoji: string }[] = [
  { topic: "Times tables", emoji: "✖️" },
  { topic: "Fractions", emoji: "🍕" },
  { topic: "Time & money", emoji: "⏰" },
  { topic: "Thinking", emoji: "🧠" },
];

/** The games corner on the Play page: the big gold button, then every game as a tinted glass tile, by topic. */
function GamesCorner() {
  return (
    <section className="glass-hi flex flex-col gap-[22px] rounded-[32px] p-5 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div>
          <p className="text-[13px] font-bold tracking-[0.2em] text-[var(--th-gold)]">{GAMES.length} GAMES</p>
          <h2 className="font-sport text-[46px] font-extrabold italic leading-none sm:text-[54px]">Games corner</h2>
          <p className="mt-2 max-w-[560px] text-[var(--th-text-2)]">
            Full screen for children in an onsite lesson, with no TutoringHub menu. To leave, hold Exit for 2 seconds.
          </p>
        </div>
        <Link href="/arcade" onClick={() => play("corner")} className="btn-gold press">
          <svg
            width="26"
            height="26"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M6 11h4M8 9v4M15 12h.01M18 10h.01" />
            <path d="M17.3 5H6.7a4 4 0 0 0-4 3.6L2 15a3 3 0 0 0 5.4 1.8L9 15h6l1.6 1.8A3 3 0 0 0 22 15l-.7-6.4A4 4 0 0 0 17.3 5z" />
          </svg>
          Open games corner
        </Link>
      </div>

      {TOPICS.map(({ topic }) => {
        const games = GAMES.filter((g) => g.topic === topic);
        if (!games.length) return null;
        return (
          <div key={topic} className="flex flex-col gap-3.5">
            <h3 className="flex items-center gap-3 font-semibold text-[var(--th-text-2)]">
              {topic}
              <span className="h-px flex-1 bg-white/12" />
            </h3>
            <ul className="grid gap-3.5 [grid-template-columns:repeat(auto-fill,minmax(min(100%,210px),1fr))]">
              {games.map((g) => (
                <li key={g.id}>
                  <Link
                    href={g.id === "football" ? "#whos-playing" : `/arcade/${g.id}`}
                    onClick={() => play(g.id === "football" ? "tap" : "launch")}
                    title={g.blurb}
                    className="game press"
                    style={{
                      background: `color-mix(in srgb, ${g.bg} 34%, transparent)`,
                      borderColor: `color-mix(in srgb, color-mix(in srgb, ${g.bg}, #ffffff 30%) 55%, transparent)`,
                    }}
                  >
                    <span className="art">
                      {g.id === "wolf-vs-sheep" ? (
                        <WolfBoard />
                      ) : (
                        <span className="origin-center scale-[0.8] whitespace-nowrap text-white">
                          <Glyph id={g.id} />
                        </span>
                      )}
                    </span>
                    <span className="gt">{g.name}</span>
                    <span className="gs">{g.blurb}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </section>
  );
}

/** The small Wolf vs Sheep board (the wolf in dark, three sheep in white), from the design. */
function WolfBoard() {
  const empty = [
    [12, 12],
    [32, 12],
    [52, 12],
    [72, 12],
    [12, 32],
    [52, 32],
    [72, 32],
    [12, 52],
    [32, 52],
    [72, 52],
    [12, 72],
    [52, 72],
  ];
  return (
    <svg width="84" height="84" viewBox="0 0 84 84" aria-hidden>
      <g fill="rgba(255,255,255,0.25)">
        {empty.map(([x, y]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r="5" />
        ))}
      </g>
      <circle cx="32" cy="32" r="9" fill="#1F2937" stroke="#FFFFFF" strokeWidth="2" />
      <g fill="#FFFFFF">
        <circle cx="52" cy="52" r="8" />
        <circle cx="32" cy="72" r="8" />
        <circle cx="72" cy="72" r="8" />
      </g>
    </svg>
  );
}

/** Open TutoringHub (or one child's game) on the iPad by scanning a QR code, then add it to the home screen. */
function IPadSetup({ students }: { students: Kid[] }) {
  const [who, setWho] = useState("me"); // "me", "arcade" or a student's id
  const [tokens, setTokens] = useState<Record<string, string>>(() => Object.fromEntries(students.filter((k) => k.token).map((k) => [k.id, k.token!])));
  const [qr, setQr] = useState<{ url: string; src: string } | null>(null);
  const [busy, start] = useTransition();
  const kid = students.find((k) => k.id === who);
  const path = who === "me" ? "/play" : who === "arcade" ? "/arcade" : tokens[who] ? `/room/${tokens[who]}?tab=practice` : null;

  useEffect(() => {
    if (!path) return;
    const url = `${window.location.origin}${path}`;
    let alive = true;
    QRCode.toDataURL(url, { width: 400, margin: 1 }).then((src) => alive && setQr({ url, src }));
    return () => {
      alive = false;
    };
  }, [path]);

  function choose(id: string) {
    play("flip");
    setWho(id);
    if (id !== "me" && id !== "arcade" && !tokens[id]) {
      start(async () => {
        const t = (await ensureRoomToken(id).catch(netFail)).token;
        if (t) setTokens((m) => ({ ...m, [id]: t }));
      });
    }
  }

  const shown = qr && path && qr.url.endsWith(path) ? qr : null;
  return (
    <section className="glass flex flex-col gap-3.5 rounded-[26px] p-5 sm:p-[22px]">
      <div>
        <h2 className="font-display text-[22px] font-semibold">📱 Put it on the iPad</h2>
        <p className="mt-1 text-sm text-[var(--th-text-3)]">
          Scan the code with the iPad camera. It opens in Safari, then you add it to the home screen like an app.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          aria-pressed={who === "me"}
          onClick={() => choose("me")}
          className={`seg press !h-10 !rounded-[13px] glass text-sm ${who === "me" ? "is-on" : ""}`}
        >
          TutoringHub (you)
        </button>
        <button
          type="button"
          aria-pressed={who === "arcade"}
          onClick={() => choose("arcade")}
          className={`seg press !h-10 !rounded-[13px] glass text-sm ${who === "arcade" ? "is-on" : ""}`}
        >
          Games corner
        </button>
        {students.map((k) => (
          <button
            key={k.id}
            type="button"
            aria-pressed={who === k.id}
            onClick={() => choose(k.id)}
            className={`seg press !h-10 !rounded-[13px] glass text-sm ${who === k.id ? "is-on" : ""}`}
          >
            {k.name}&apos;s game
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-4">
        {shown ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={shown.src}
            alt={`QR code to open ${who === "me" ? "TutoringHub" : who === "arcade" ? "the games corner" : `${kid?.name}'s game`} on the iPad`}
            className="h-40 w-40 rounded-2xl bg-white p-1.5"
          />
        ) : (
          <div className="flex h-40 w-40 items-center justify-center rounded-2xl bg-white/5 text-xs text-muted">{busy ? "Making link…" : ""}</div>
        )}
        <ol className="min-w-[14rem] flex-1 list-decimal space-y-1 pl-5 text-sm">
          <li>
            Open the iPad <b>Camera</b> and point it at the code. Tap the yellow link.
          </li>
          <li>
            In Safari, tap <b>Share</b> (the square with an arrow), then <b>Add to Home Screen</b>, then <b>Add</b>.
          </li>
          <li>
            {who === "me"
              ? "Open TutoringHub from the new icon and sign in once. The app keeps its own sign-in, separate from Safari."
              : who === "arcade"
                ? 'A "Games" icon appears. It opens straight into the games corner. Sign in once (as you), then hand the iPad to the children.'
                : `A football icon called "${kid?.name}" appears. It opens straight into ${kid?.name}'s game, with no sign-in needed.`}
          </li>
        </ol>
      </div>
      {shown ? (
        <button type="button" className="min-h-11 self-start text-sm text-accent underline" onClick={() => void navigator.clipboard?.writeText(shown.url)}>
          Copy link instead (to AirDrop or send it)
        </button>
      ) : null}
    </section>
  );
}
