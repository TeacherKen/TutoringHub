"use client";
import { useState, useTransition } from "react";
import { MasteryGrid } from "./MasteryGrid";
import { MODE_EXAMPLES, MODE_NAMES, MODES, TABLES, level, type FactState, type GameMode } from "@/lib/facts";
import { setStudentMode, setStudentTables } from "@/app/actions/students";
import { roundStars, shelf, trophies, type TrophyStats } from "@/lib/trophies";
import { TrophyShelf } from "./Trophies";

type Session = { score: number; total: number; tables: number[]; created_at: string; game?: string | null; won?: boolean | null };

const fmt = (iso: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "Asia/Bangkok" }).format(new Date(iso));

/** On a student's page: their times tables chart, recent rounds, which tables to practise, and a button to play. */
export function TimesTablesCard({
  studentId,
  name,
  roomToken,
  initialTables,
  progress,
  sessions,
  ready,
  stats,
  initialMode,
}: {
  studentId: string;
  name: string;
  roomToken: string | null;
  initialTables: number[];
  progress: FactState[];
  sessions: Session[];
  ready: boolean;
  stats: TrophyStats;
  initialMode: GameMode;
}) {
  const [tables, setTables] = useState(initialTables);
  const [mode, setMode] = useState(initialMode);
  const [saved, setSaved] = useState<"idle" | "saved" | "error">("idle");
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();

  if (!ready) {
    return (
      <section className="card space-y-1">
        <h2 className="font-medium">⚽ Times tables</h2>
        <p className="text-sm text-muted">Run database update 0016 in Supabase to turn this on.</p>
      </section>
    );
  }

  const known = progress.filter((p) => level(p) === "mastered").length;
  const shelfItems = shelf(trophies(stats), tables);
  const won = shelfItems.filter((t) => t.got).length;
  const weak = progress.filter((p) => level(p) === "weak").map((p) => p.fact.replace("x", "×"));
  const shown = [...new Set([...tables, ...progress.map((p) => Number(p.fact.split("x")[0]))])].filter((t) => TABLES.includes(t as (typeof TABLES)[number])).sort((a, b) => a - b);

  function chooseMode(m: GameMode) {
    setMode(m);
    setSaved("idle");
    start(async () => {
      const r = await setStudentMode(studentId, m);
      setSaved(r.ok ? "saved" : "error");
      setMsg(r.error ?? "");
    });
  }

  function toggle(t: number) {
    const next = tables.includes(t) ? tables.filter((x) => x !== t) : [...tables, t].sort((a, b) => a - b);
    setTables(next);
    setSaved("idle");
    start(async () => {
      const r = await setStudentTables(studentId, next);
      setSaved(r.ok ? "saved" : "error");
      setMsg(r.error ?? "");
    });
  }

  return (
    <section className="card space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-medium">⚽ Times tables</h2>
          <p className="text-sm text-muted">
            {progress.length ? `${known} of ${progress.length} facts tried are known well.` : `${name} hasn't played yet.`}
            {weak.length ? ` Needs practice: ${weak.slice(0, 6).join(", ")}${weak.length > 6 ? "…" : ""}` : ""}
          </p>
        </div>
        {roomToken ? (
          <a href={`/room/${roomToken}?tab=practice`} target="_blank" rel="noopener" className="btn-primary">
            ▶ Play on this device
          </a>
        ) : (
          <p className="text-xs text-muted">Make a room link first to play.</p>
        )}
      </div>

      <div className="space-y-2">
        <p className="text-sm">
          Tables and game {name} starts with{" "}
          <span className="text-xs text-muted">{pending ? "Saving…" : saved === "saved" ? "✓ Saved" : saved === "error" ? msg || "Couldn't save" : "(they can change it in the game)"}</span>
        </p>
        <div className="flex flex-wrap gap-1.5">
          {TABLES.map((t) => {
            const on = tables.includes(t);
            return (
              <button
                key={t}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(t)}
                className={`min-h-10 min-w-11 rounded-xl border px-2 text-sm font-semibold transition active:scale-95 ${on ? "border-green-600 bg-green-600 text-white" : "border-line bg-surface"}`}
              >
                {t}×
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {MODES.map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              onClick={() => chooseMode(m)}
              className={`min-h-10 rounded-xl border px-3 text-sm transition active:scale-95 ${mode === m ? "border-green-600 bg-green-600 text-white" : "border-line bg-surface"}`}
            >
              <span className="font-semibold">{MODE_NAMES[m]}</span> <span className={mode === m ? "text-white/80" : "text-muted"}>{MODE_EXAMPLES[m]}</span>
            </button>
          ))}
        </div>
      </div>

      {shown.length ? <MasteryGrid progress={progress} tables={shown} /> : null}

      {stats.rounds ? (
        <div className="space-y-2">
          <h3 className="text-sm font-medium">
            Trophies <span className="font-normal text-muted">· {stats.stars} stars · {won} won</span>
          </h3>
          <TrophyShelf items={shelfItems} />
        </div>
      ) : null}

      {sessions.length ? (
        <div className="space-y-1">
          <h3 className="text-sm font-medium">Recent rounds</h3>
          <ul className="divide-y divide-line text-sm">
            {sessions.map((s, i) => (
              <li key={i} className="flex justify-between py-1.5">
                <span>
                  {fmt(s.created_at)} · {s.game === "match" ? (s.won ? "Match, won" : "Match") : s.game === "tt-divide" ? "Divide" : s.game === "tt-missing" ? "Missing number" : s.game === "tt-mixed" ? "Mixed" : "Practice"} · {s.tables.map((t) => `${t}×`).join(" ")}
                </span>
                <span className="tabular-nums">
                  {s.game === "match" ? `${s.score} goals` : `${s.score}/${s.total}`} {"⭐".repeat(roundStars(s))}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
