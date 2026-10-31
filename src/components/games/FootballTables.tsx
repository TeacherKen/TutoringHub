"use client";
import "@fontsource/barlow-condensed/700.css";
import "@fontsource/barlow-condensed/700-italic.css";
import "@fontsource/barlow-condensed/800-italic.css";
import { useCallback, useEffect, useRef, useState } from "react";
import { FAST_MS, parseFact, pickRound, TABLES, updateFact, type Answer, type FactState } from "@/lib/facts";
import { setSoundOn, sfx, soundOn } from "@/lib/gameSound";
import { MasteryGrid } from "../MasteryGrid";
import { KITS, Stadium, TARGETS, type Confetti, type Kit, type Shot } from "./Stadium";

// ⚽ Football Times Tables: a penalty shootout. Type the answer, tap the goal to aim, score!
// Facts answered wrong or slowly come back sooner (see lib/facts.ts).

type Data = { name: string; tables: number[]; progress: FactState[]; sessions: { score: number; total: number; created_at: string }[]; best?: number | null };
type Kick = { fact: string; second: boolean };
type Banner = { key: number; text: string; tone: "goal" | "saved"; sub?: string };
type Result = { score: number; total: number; newHigh: boolean; first: boolean };

const KICKS = 10;
const PENDING_KEY = "tutoringhub-tt-pending";
const KIT_KEY = "tutoringhub-tt-kit";
const FLY_MS = 700;
const PANEL = "rounded-3xl bg-[radial-gradient(120%_90%_at_50%_0%,#18397a_0%,#0b1d42_55%,#081633_100%)] p-3 text-white shadow-xl sm:p-4";
const GLASS = "bg-white/[.07] ring-1 ring-inset ring-white/12";

const answerOf = (fact: string) => {
  const p = parseFact(fact)!;
  return p[0] * p[1];
};

const makeConfetti = (colours: string[], n = 50, spread = 620): Confetti[] =>
  Array.from({ length: n }, () => ({
    dx: (Math.random() - 0.5) * spread,
    dy: -60 + Math.random() * 320,
    r: Math.random() * 900 - 450,
    c: colours[Math.floor(Math.random() * colours.length)],
    d: Math.random() * 200,
  }));

export function FootballTables({ api }: { api: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tables, setTables] = useState<number[]>([]);
  const [kit, setKit] = useState<Kit>(KITS[1]);
  const [sound, setSound] = useState(true);
  const [stage, setStage] = useState<"setup" | "play" | "done">("setup");
  const [kicks, setKicks] = useState<Kick[]>([]);
  const [i, setI] = useState(0);
  const [typed, setTyped] = useState("");
  const [shot, setShot] = useState<Shot | null>(null);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [goals, setGoals] = useState<boolean[]>([]);
  const [banner, setBanner] = useState<Banner | null>(null);
  const [cheer, setCheer] = useState(0);
  const [confetti, setConfetti] = useState<Confetti[]>([]);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [powers, setPowers] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const started = useRef(0);
  const busy = useRef(false);

  useEffect(() => {
    let alive = true;
    const post = (body: unknown) =>
      fetch(api, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => {
        if (!r.ok) throw new Error("not saved");
      });
    // Rounds that couldn't be saved earlier (no internet) are sent first.
    const pending = readPending(api);
    Promise.all(pending.map(post))
      .then(() => pending.length && writePending(api, []))
      .catch(() => undefined)
      .then(() => fetch(api, { cache: "no-store" }))
      .then(async (res) => {
        if (!res.ok) throw new Error(res.status === 503 ? "Times tables aren't set up yet. Ask Mr Ken." : "Couldn't load. Check the internet and refresh.");
        const d = (await res.json()) as Data;
        if (!alive) return;
        setData(d);
        setTables((t) => (t.length ? t : d.tables));
        setSound(soundOn());
        setKit(readKit(api));
      })
      .catch((e: unknown) => alive && setError(e instanceof Error ? e.message : "Couldn't load."));
    return () => {
      alive = false;
    };
  }, [api]);

  function start() {
    if (!data || !tables.length) return;
    setKicks(pickRound(tables, data.progress, new Date(), KICKS).map((fact) => ({ fact, second: false })));
    setI(0);
    setTyped("");
    setShot(null);
    setBanner(null);
    setConfetti([]);
    setAnswers([]);
    setGoals([]);
    setStreak(0);
    setBestStreak(0);
    setPowers(0);
    setResult(null);
    setStage("play");
    sfx.whistle();
    started.current = Date.now();
  }

  const kick = kicks[i];

  // Full time: show the result, update the chart and save.
  const finish = useCallback(
    (done: Answer[], scored: boolean[]) => {
      const score = scored.filter(Boolean).length;
      const body = { answers: done, tables, score, total: scored.length };
      const best = data?.best ?? null;
      setResult({ score, total: scored.length, newHigh: best != null && score > best, first: best == null });
      setStage("done");
      if (score >= 7) {
        sfx.win();
        setConfetti(makeConfetti(["#ffc629", "#ffffff", kit.shirt]));
      } else sfx.whistle();
      // Update the chart straight away; the server keeps the real copy.
      setData((d) => {
        if (!d) return d;
        const map = new Map(d.progress.map((p) => [p.fact, p]));
        for (const a of done) map.set(a.fact, updateFact(map.get(a.fact), a, new Date()));
        return { ...d, progress: [...map.values()], best: Math.max(d.best ?? 0, score) };
      });
      fetch(api, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
        .then((r) => {
          if (!r.ok) throw new Error();
        })
        .catch(() => writePending(api, [...readPending(api), body])); // no internet: send it next time
    },
    [api, tables, data?.best, kit.shirt],
  );

  const shoot = useCallback(
    (aim?: number) => {
      if (!kick || shot || !typed || busy.current) return;
      busy.current = true;
      const ms = Date.now() - started.current;
      const correct = Number(typed) === answerOf(kick.fact);
      const power = correct && ms < FAST_MS;
      const target = aim ?? Math.floor(Math.random() * TARGETS.length);
      const others = TARGETS.map((_, n) => n).filter((n) => n !== target);
      const keeper = correct ? others[Math.floor(Math.random() * others.length)] : target;
      const nextAnswers = [...answers, { fact: kick.fact, correct, ms }];
      const nextGoals = kick.second ? goals : [...goals, correct];
      // Missed ones get a second chance at the end of the round.
      const nextKicks = !correct && !kick.second ? [...kicks, { fact: kick.fact, second: true }] : kicks;
      const nextStreak = kick.second ? streak : correct ? streak + 1 : 0;
      setAnswers(nextAnswers);
      setGoals(nextGoals);
      setKicks(nextKicks);
      setShot({ target, keeper, result: correct ? "goal" : "saved", power, stage: "fly" });
      if (power) sfx.power();
      else sfx.kick();

      setTimeout(() => {
        setShot((s) => (s ? { ...s, stage: "after" } : s));
        setStreak(nextStreak);
        setBestStreak((b) => Math.max(b, nextStreak));
        if (correct) {
          sfx.goal();
          setCheer((c) => c + 1);
          if (power) setPowers((p) => p + 1);
          const text = kick.second ? "GOAL!" : nextStreak === 3 ? "HAT-TRICK!" : nextStreak >= 4 ? `${nextStreak} IN A ROW!` : "GOAL!";
          setBanner({ key: Date.now(), tone: "goal", text, sub: power ? "⚡ Power shot" : nextStreak === 3 ? "3 goals in a row" : undefined });
        } else {
          sfx.save();
          setBanner({ key: Date.now(), tone: "saved", text: "SAVED" });
        }
        setTimeout(
          () => {
            busy.current = false;
            setShot(null);
            setBanner(null);
            setTyped("");
            started.current = Date.now();
            if (i + 1 >= nextKicks.length) finish(nextAnswers, nextGoals);
            else setI(i + 1);
          },
          correct ? 1350 : 2400,
        );
      }, FLY_MS);
    },
    [kick, shot, typed, answers, goals, kicks, i, streak, finish],
  );

  const press = useCallback((k: string) => {
    sfx.tap();
    if (k === "del") setTyped((t) => t.slice(0, -1));
    else setTyped((t) => (t.length < 3 ? t + k : t));
  }, []);

  // Keyboard on a Mac: numbers, Backspace, Enter.
  useEffect(() => {
    if (stage !== "play") return;
    const onKey = (e: KeyboardEvent) => {
      if (shot) return;
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === "Backspace") press("del");
      else if (e.key === "Enter") shoot();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [stage, shoot, press, shot]);

  function toggleSound() {
    setSoundOn(!sound);
    setSound(!sound);
  }

  function chooseKit(k: Kit) {
    setKit(k);
    sfx.tap();
    try {
      localStorage.setItem(`${KIT_KEY}:${api}`, k.id);
    } catch {
      /* fine */
    }
  }

  if (error) return <p className="card text-center text-muted">{error}</p>;
  if (!data) return <p className="card text-center text-muted">Loading…</p>;

  // ---- Before the match: tables and kit --------------------------------------------------
  if (stage === "setup") {
    return (
      <section className="mx-auto w-full max-w-3xl space-y-4">
        <div className={`${PANEL} space-y-6 px-5 py-6 text-center sm:px-8`}>
          <div>
            <h2 className="font-sport text-[clamp(34px,6vw,52px)] font-extrabold italic leading-none">Football Times Tables</h2>
            <p className="mt-2 text-white/70">Every right answer is a goal. Choose your tables and your kit.</p>
          </div>
          <div className="space-y-2.5">
            <p className="font-sport text-xl font-bold">Tables</p>
            <div className="flex flex-wrap justify-center gap-2">
              {TABLES.map((t) => {
                const on = tables.includes(t);
                return (
                  <button
                    key={t}
                    type="button"
                    aria-pressed={on}
                    onClick={() => {
                      sfx.tap();
                      setTables((x) => (on ? x.filter((y) => y !== t) : [...x, t].sort((a, b) => a - b)));
                    }}
                    className={`font-sport h-14 min-w-14 rounded-xl px-3 text-2xl font-bold transition active:scale-95 ${on ? "bg-[#ffc629] text-[#0b1d42]" : `${GLASS} text-white hover:bg-white/15`}`}
                  >
                    {t}×
                  </button>
                );
              })}
            </div>
          </div>
          <div className="space-y-2.5">
            <p className="font-sport text-xl font-bold">Kit</p>
            <div className="flex flex-wrap justify-center gap-2">
              {KITS.map((k) => {
                const on = kit.id === k.id;
                return (
                  <button
                    key={k.id}
                    type="button"
                    aria-label={`${k.id} shirt`}
                    aria-pressed={on}
                    onClick={() => chooseKit(k)}
                    className={`flex h-16 w-16 items-center justify-center rounded-xl transition active:scale-95 ${on ? "bg-white/20 ring-2 ring-[#ffc629]" : `${GLASS} hover:bg-white/15`}`}
                  >
                    <Shirt colour={k.shirt} text={k.text} />
                  </button>
                );
              })}
            </div>
          </div>
          <div className="space-y-2">
            <button
              type="button"
              className="font-sport h-16 w-full max-w-xs rounded-2xl bg-[#ffc629] text-3xl font-extrabold italic text-[#0b1d42] shadow-lg transition hover:bg-[#ffd447] active:scale-95 disabled:opacity-40"
              disabled={!tables.length}
              onClick={start}
            >
              Kick off
            </button>
            {data.best != null ? <p className="text-sm text-white/65">High score: {data.best} out of 10</p> : null}
          </div>
        </div>
        <div className="card space-y-2">
          <h3 className="font-medium">{data.name}&apos;s times tables</h3>
          <MasteryGrid progress={data.progress} />
        </div>
      </section>
    );
  }

  // ---- Full time -------------------------------------------------------------------------
  if (stage === "done" && result) {
    const { score } = result;
    const stars = score >= 9 ? 3 : score >= 7 ? 2 : score >= 5 ? 1 : 0;
    const missed = [...new Set(answers.filter((a) => !a.correct).map((a) => a.fact))];
    const keeperKit = kit.id === "yellow" ? "#ff5fa2" : "#c6ef3a";
    return (
      <section className="mx-auto w-full max-w-3xl space-y-4">
        <div className={`${PANEL} relative space-y-5 overflow-hidden px-5 py-7 text-center sm:px-8`}>
          {confetti.length ? (
            <div className="pointer-events-none absolute left-1/2 top-24">
              {confetti.map((c, n) => (
                <span
                  key={n}
                  className="tt-confetti absolute block h-3 w-1.5 rounded-sm"
                  style={{ background: c.c, animationDelay: `${c.d}ms`, ["--dx" as string]: `${c.dx}px`, ["--dy" as string]: `${c.dy}px`, ["--r" as string]: `${c.r}deg` }}
                />
              ))}
            </div>
          ) : null}
          <p className="font-sport text-xl font-bold italic text-white/70">Full time</p>
          <div className="font-sport tt-pop mx-auto inline-flex items-stretch overflow-hidden rounded-lg text-[clamp(26px,5vw,44px)] font-bold leading-none shadow-[0_10px_30px_rgba(0,0,0,.4)]">
            <span className="w-2" style={{ background: kit.shirt }} />
            <span className="bg-[#0b1d42] px-4 py-3 uppercase tracking-wide">{data.name}</span>
            <span className="min-w-[1.5em] bg-white px-3 py-3 font-extrabold tabular-nums text-[#0b1d42]">{score}</span>
            <span className="min-w-[1.5em] border-l border-[#0b1d42]/15 bg-white px-3 py-3 font-extrabold tabular-nums text-[#0b1d42]">{result.total - score}</span>
            <span className="bg-[#0b1d42] px-4 py-3 uppercase tracking-wide">Keeper</span>
            <span className="w-2" style={{ background: keeperKit }} />
          </div>
          <div className="flex justify-center gap-2" aria-label={`${stars} out of 3 stars`}>
            {[0, 1, 2].map((n) => (
              <svg key={n} viewBox="0 0 24 24" className={`h-12 w-12 ${n < stars ? "tt-pop" : ""}`} style={{ animationDelay: `${350 + n * 220}ms` }} aria-hidden>
                <path
                  d="M12 2.5l2.9 6 6.6.8-4.9 4.5 1.3 6.5L12 17l-5.9 3.3 1.3-6.5L2.5 9.3l6.6-.8z"
                  fill={n < stars ? "#ffc629" : "rgba(255,255,255,.12)"}
                  stroke={n < stars ? "#e0a800" : "rgba(255,255,255,.2)"}
                  strokeWidth="1"
                  strokeLinejoin="round"
                />
              </svg>
            ))}
          </div>
          <div className="flex flex-wrap justify-center gap-2 text-sm font-semibold">
            {result.newHigh ? <span className="tt-pop rounded-full bg-[#ffc629] px-3 py-1 text-[#0b1d42]">New high score</span> : null}
            {result.first ? <span className={`${GLASS} rounded-full px-3 py-1`}>First match played</span> : null}
            {powers ? (
              <span className={`${GLASS} rounded-full px-3 py-1`}>
                ⚡ {powers} power {powers === 1 ? "shot" : "shots"}
              </span>
            ) : null}
            {bestStreak >= 2 ? <span className={`${GLASS} rounded-full px-3 py-1`}>{bestStreak} goals in a row</span> : null}
          </div>
          {missed.length ? (
            <div className="space-y-1.5">
              <p className="text-white/70">Practise these for next time</p>
              <div className="flex flex-wrap justify-center gap-2">
                {missed.map((f) => (
                  <span key={f} className="font-sport rounded-lg bg-white px-3 py-1 text-2xl font-bold text-[#0b1d42]">
                    {f.replace("x", " × ")} = {answerOf(f)}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <p className="font-sport text-2xl font-bold italic text-[#ffc629]">A perfect match, no misses</p>
          )}
          <div className="flex flex-wrap justify-center gap-2">
            <button
              type="button"
              className="font-sport h-14 rounded-2xl bg-[#ffc629] px-7 text-2xl font-extrabold italic text-[#0b1d42] shadow-lg transition hover:bg-[#ffd447] active:scale-95"
              onClick={start}
            >
              Play again
            </button>
            <button type="button" className={`font-sport h-14 rounded-2xl px-6 text-xl font-bold ${GLASS} transition hover:bg-white/15 active:scale-95`} onClick={() => setStage("setup")}>
              Change tables
            </button>
          </div>
        </div>
        <div className="card">
          <MasteryGrid progress={data.progress} tables={tables} />
        </div>
      </section>
    );
  }

  // ---- The match -------------------------------------------------------------------------
  const [a, b] = parseFact(kick?.fact ?? "2x2")!;
  const savedNow = shot?.result === "saved" && shot.stage === "after";
  return (
    <section className={`${PANEL} mx-auto w-full max-w-6xl`}>
      <div className="grid gap-3 lg:grid-cols-[1.55fr_1fr] lg:items-stretch">
        <Stadium
          shot={shot}
          aiming={!!typed && !shot}
          onAim={shoot}
          kit={kit}
          name={data.name}
          cheer={cheer}
          banner={banner}
          goals={goals}
          kicks={KICKS}
          streak={streak}
          sound={sound}
          onToggleSound={toggleSound}
        />

        <div className="flex flex-col gap-3">
          {/* The question */}
          <div className={`${GLASS} flex flex-1 flex-col justify-center gap-3 rounded-2xl px-4 py-4 text-center`}>
            {kick?.second ? <p className="font-sport text-lg font-bold italic text-[#ffc629]">Second chance</p> : null}
            <p className="font-sport text-[clamp(52px,8vw,88px)] font-extrabold italic leading-none tabular-nums">
              {a} × {b} = <span className={savedNow ? "text-[#ff6b70]" : typed ? "text-[#ffc629]" : "text-white/35"}>{savedNow ? a * b : typed || "?"}</span>
            </p>
            <div className="mx-auto w-full max-w-sm">
              <div className="h-2 overflow-hidden rounded-full bg-white/10">
                <div key={i} className="tt-drain h-full rounded-full" style={{ animationPlayState: shot ? "paused" : "running" }} />
              </div>
              <p className="mt-1.5 text-xs text-white/60">Answer while the bar is gold for a power shot</p>
            </div>
            <p className={`min-h-6 text-[15px] font-medium ${savedNow ? "text-[#ff8a8e]" : "text-white/85"}`}>
              {savedNow ? `It's ${a * b}. You'll get it next time!` : shot ? "" : typed ? "Tap the goal to aim, or press Kick" : "Type your answer"}
            </p>
          </div>

          {/* Number pad, big for small fingers */}
          <div className="grid grid-cols-3 gap-2">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9", "del", "0", "kick"].map((k) => (
              <button
                key={k}
                type="button"
                disabled={!!shot || (k === "kick" && !typed)}
                onClick={() => (k === "kick" ? shoot() : press(k))}
                className={`font-sport flex h-14 items-center justify-center gap-2 rounded-xl transition active:scale-95 disabled:opacity-35 lg:h-[60px] ${
                  k === "kick" ? "bg-[#ffc629] text-2xl font-extrabold italic text-[#0b1d42] hover:bg-[#ffd447]" : `${GLASS} text-[32px] font-bold text-white hover:bg-white/15 active:bg-white/25`
                }`}
                aria-label={k === "kick" ? "Kick" : k === "del" ? "Delete" : k}
              >
                {k === "kick" ? (
                  <>
                    <BallIcon /> Kick
                  </>
                ) : k === "del" ? (
                  <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M9 5h11a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H9l-6-7z" />
                    <path d="M12.5 9.5l5 5M17.5 9.5l-5 5" />
                  </svg>
                ) : (
                  k
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function Shirt({ colour, text }: { colour: string; text: string }) {
  return (
    <svg viewBox="0 0 40 36" className="h-11 w-11" aria-hidden>
      <path d="M13 2 L4 6.5 L1 15 L8 16.5 L9 34 L31 34 L32 16.5 L39 15 L36 6.5 L27 2 Q20 6 13 2Z" fill={colour} />
      <path d="M13 2 Q20 6 27 2" stroke="rgba(0,0,0,.25)" strokeWidth="1.5" fill="none" />
      <text x="20" y="27" textAnchor="middle" fontSize="12" fontWeight="800" fontFamily='"Barlow Condensed", sans-serif' fill={text}>
        10
      </text>
    </svg>
  );
}

function BallIcon() {
  return (
    <svg viewBox="-13 -13 26 26" className="h-6 w-6" aria-hidden>
      <circle r="12" fill="#ffffff" stroke="#0b1d42" strokeWidth="1.5" />
      <path d="M0 -4.6 L4.4 -1.4 L2.7 3.8 L-2.7 3.8 L-4.4 -1.4Z" fill="#0b1d42" />
      <path d="M0 -4.6 L0 -11 M4.4 -1.4 L10.5 -3.4 M2.7 3.8 L6.5 9.5 M-2.7 3.8 L-6.5 9.5 M-4.4 -1.4 L-10.5 -3.4" stroke="#0b1d42" strokeWidth="1.3" />
    </svg>
  );
}

// Saved per child, so brothers and sisters sharing one iPad keep their own kit and rounds.
function readKit(api: string): Kit {
  try {
    const id = localStorage.getItem(`${KIT_KEY}:${api}`);
    return KITS.find((k) => k.id === id) ?? KITS[1];
  } catch {
    return KITS[1];
  }
}

function readPending(api: string): unknown[] {
  try {
    return JSON.parse(localStorage.getItem(`${PENDING_KEY}:${api}`) ?? "[]") as unknown[];
  } catch {
    return [];
  }
}
function writePending(api: string, v: unknown[]) {
  try {
    if (v.length) localStorage.setItem(`${PENDING_KEY}:${api}`, JSON.stringify(v.slice(-20)));
    else localStorage.removeItem(`${PENDING_KEY}:${api}`);
  } catch {
    /* storage blocked — fine */
  }
}
