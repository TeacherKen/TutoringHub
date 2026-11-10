"use client";
import { useState, useTransition } from "react";
import { addMission, removeMission } from "@/app/actions/games";
import { netFail } from "@/lib/netFail";
import { gameName, MISSION_GAMES, type GamePlay, type MissionView } from "@/lib/gameScore";
import { RoundDots } from "@/components/games/Missions";

const day = (iso: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "Asia/Bangkok" }).format(new Date(iso));

/** 🎮 On a student's page: homework missions (give one, see progress) and what they've played lately. */
export function GamesCard({ studentId, name, hasRoom, missions, plays }: { studentId: string; name: string; hasRoom: boolean; missions: MissionView[]; plays: GamePlay[] }) {
  const [game, setGame] = useState<string>("qm");
  const [rounds, setRounds] = useState(3);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  const [removing, setRemoving] = useState<string | null>(null);

  return (
    <div className="space-y-5">
      {!hasRoom ? (
        <p className="rounded-xl bg-warn-soft p-3 text-sm text-warn">
          {name} needs a room link first (make one in the Times tables card). Missions and game results are saved when {name} plays with that link.
        </p>
      ) : null}

      <div className="space-y-2">
        <h3 className="font-semibold">🎯 Missions</h3>
        {missions.length ? (
          <ul className="space-y-2">
            {missions.map((m) => (
              <li key={m.id} className={`flex flex-wrap items-center gap-3 rounded-xl p-3 ${m.done ? "bg-ok-soft" : "bg-surface-2"}`}>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">
                    {m.done ? "✅ " : ""}
                    {m.name} <span className="font-normal text-muted">· {m.rounds} round{m.rounds === 1 ? "" : "s"}</span>
                  </span>
                  {m.note ? <span className="block text-sm text-muted">{m.note}</span> : null}
                  <span className="mt-1 flex items-center gap-2 text-sm text-muted">
                    <RoundDots played={m.played} rounds={m.rounds} />
                    {m.done && m.doneAt ? `Done ${day(m.doneAt)}` : `${m.played} of ${m.rounds} · set ${day(m.createdAt)}`}
                  </span>
                </span>
                <button
                  type="button"
                  disabled={removing === m.id}
                  className="min-h-11 rounded-full px-3 text-sm font-medium text-muted hover:bg-surface disabled:opacity-50"
                  onClick={async () => {
                    setRemoving(m.id);
                    const r = await removeMission(studentId, m.id).catch(netFail);
                    setRemoving(null);
                    if (r.error) setError(r.error);
                  }}
                >
                  {removing === m.id ? "…" : m.done ? "Clear" : "Remove"}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">No missions yet. Give {name} a game to practise at home; it shows in their room and on the family page.</p>
        )}

        <form
          className="space-y-2 rounded-xl border border-line p-3"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            setSaved(false);
            start(async () => {
              const r = await addMission(studentId, game, rounds, note).catch(netFail);
              if (r.error) setError(r.error);
              else {
                setNote("");
                setSaved(true);
              }
            });
          }}
        >
          <div className="flex flex-wrap gap-2">
            <label className="min-w-0 flex-1">
              <span className="sr-only">Game</span>
              <select className="input w-full" value={game} onChange={(e) => setGame(e.target.value)}>
                {MISSION_GAMES.map((g) => (
                  <option key={g} value={g}>
                    {gameName(g)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <select className="input" value={rounds} onChange={(e) => setRounds(Number(e.target.value))} aria-label="Rounds">
                {[1, 2, 3, 4, 5, 6, 8, 10].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
              round{rounds === 1 ? "" : "s"}
            </label>
          </div>
          <input className="input w-full" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="Note (optional), e.g. try Medium" />
          <div className="flex flex-wrap items-center gap-3">
            <button className="btn-primary min-h-11" disabled={pending}>
              {pending ? "Saving…" : "🎯 Give mission"}
            </button>
            {saved ? <span className="text-sm text-ok">Added. {name} sees it in their room.</span> : null}
            {error ? <span className="text-sm text-danger">{error}</span> : null}
          </div>
        </form>
      </div>

      <div className="space-y-2">
        <h3 className="font-semibold">🎮 Played in the last 30 days</h3>
        {plays.length ? (
          <ul className="divide-y divide-line text-sm">
            {plays.slice(0, 12).map((p) => (
              <li key={`${p.game}-${p.variant}`} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 py-2">
                <span className="font-medium">
                  {p.name}
                  {p.level ? <span className="font-normal text-muted"> · {p.level}</span> : null}
                </span>
                <span className="text-muted">
                  {p.plays}× · best <span className="font-medium text-ink">{p.best}</span> · last {day(p.lastAt)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">Nothing yet. Games {name} finishes in their room are saved here (not games on your iPad).</p>
        )}
      </div>
    </div>
  );
}
