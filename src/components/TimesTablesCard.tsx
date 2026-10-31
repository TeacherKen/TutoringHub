"use client";
import { useState, useTransition } from "react";
import { MasteryGrid } from "./MasteryGrid";
import { TABLES, level, type FactState } from "@/lib/facts";
import { setStudentTables } from "@/app/actions/students";

type Session = { score: number; total: number; tables: number[]; created_at: string };

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
}: {
  studentId: string;
  name: string;
  roomToken: string | null;
  initialTables: number[];
  progress: FactState[];
  sessions: Session[];
  ready: boolean;
}) {
  const [tables, setTables] = useState(initialTables);
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
  const weak = progress.filter((p) => level(p) === "weak").map((p) => p.fact.replace("x", "×"));
  const shown = [...new Set([...tables, ...progress.map((p) => Number(p.fact.split("x")[0]))])].filter((t) => TABLES.includes(t as (typeof TABLES)[number])).sort((a, b) => a - b);

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
          Tables {name} starts with{" "}
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
      </div>

      {shown.length ? <MasteryGrid progress={progress} tables={shown} /> : null}

      {sessions.length ? (
        <div className="space-y-1">
          <h3 className="text-sm font-medium">Recent rounds</h3>
          <ul className="divide-y divide-line text-sm">
            {sessions.map((s, i) => (
              <li key={i} className="flex justify-between py-1.5">
                <span>
                  {fmt(s.created_at)} · {s.tables.map((t) => `${t}×`).join(" ")}
                </span>
                <span className="tabular-nums">
                  {s.score}/{s.total} {s.score >= 9 ? "⭐⭐⭐" : s.score >= 7 ? "⭐⭐" : s.score >= 5 ? "⭐" : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
