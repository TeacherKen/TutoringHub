import type { MissionView } from "@/lib/gameScore";
import type { GameInfo } from "@/lib/games";
import { GameLogo } from "./GameLogo";

/** Little dots: one per round, filled when played. */
export function RoundDots({ played, rounds }: { played: number; rounds: number }) {
  return (
    <span className="inline-flex flex-wrap gap-1" aria-label={`${played} of ${rounds} rounds played`}>
      {Array.from({ length: rounds }, (_, i) => (
        <span key={i} aria-hidden className={`h-2.5 w-2.5 rounded-full ${i < played ? "bg-[#30a46c]" : "bg-current opacity-20"}`} />
      ))}
    </span>
  );
}

/**
 * Homework missions as a child (room) or a parent (family page) sees them.
 * `onPlay` (room) gives each open mission a Play button; `playHref` (family page) links to the child's room.
 */
export function MissionList({ missions, onPlay, playHref, title = "Missions from Mr Ken" }: { missions: MissionView[]; onPlay?: (game: string) => void; playHref?: string; title?: string }) {
  if (!missions.length) return null;
  const open = missions.filter((m) => !m.done);
  return (
    <section className="card space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">{title}</h2>
        {open.length ? <span className="text-sm text-muted">{open.length} to do</span> : <span className="text-sm font-medium text-ok">All done!</span>}
      </div>
      <ul className="space-y-2">
        {missions.map((m) => (
          <li key={m.id} className={`flex flex-wrap items-center gap-3 rounded-2xl p-3 ${m.done ? "bg-ok-soft" : "bg-surface-2"}`}>
            <span aria-hidden className="relative w-20 shrink-0">
              <GameLogo id={m.game as GameInfo["id"]} badge={false} />
              {m.done ? (
                <span className="absolute -right-1.5 -top-1.5 grid h-7 w-7 place-items-center rounded-full bg-[#30a46c] text-sm font-black text-white shadow ring-2 ring-white">✓</span>
              ) : null}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-medium">
                {m.name} <span className="font-normal text-muted">· {m.rounds} round{m.rounds === 1 ? "" : "s"}</span>
              </span>
              {m.note ? <span className="block text-sm text-muted">{m.note}</span> : null}
              <span className="mt-1 flex items-center gap-2 text-sm text-muted">
                <RoundDots played={m.played} rounds={m.rounds} />
                {m.done ? "Done" : `${m.played} of ${m.rounds}`}
              </span>
            </span>
            {!m.done && onPlay ? (
              <button type="button" className="btn-primary min-h-11 px-5" onClick={() => onPlay(m.game)}>
                Play ▶
              </button>
            ) : !m.done && playHref ? (
              <a href={playHref} className="btn-primary min-h-11 px-5" target="_blank" rel="noopener noreferrer">
                Play ▶
              </a>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
