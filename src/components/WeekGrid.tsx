import Link from "next/link";
import { lessonMode, lessonNames, lessonPlace, needsNote, type Lesson } from "@/lib/data";
import { bkkDateKey, fmtDay, fmtTime } from "@/lib/time";

/** The Week page on a laptop: the 7 days side by side, like a calendar. (Phones keep the list.) */
export function WeekGrid({ days, lessons, today, since }: { days: string[]; lessons: Lesson[]; today: string; since: string | null }) {
  return (
    <div className="hidden gap-2 lg:grid lg:grid-cols-7">
      {days.map((d) => {
        const ls = lessons.filter((l) => bkkDateKey(l.start_at) === d);
        return (
          <section key={d} className={`min-h-48 space-y-2 rounded-2xl p-2 ${d === today ? "bg-accent-soft" : "bg-surface-2/60"}`}>
            <h2 className={`px-1 text-sm font-medium ${d === today ? "text-accent" : "text-muted"}`}>
              {fmtDay(d)}
              {d === today ? <span className="block text-xs">Today</span> : null}
            </h2>
            {ls.map((l) => (
              <DayCard key={l.id} lesson={l} since={since} />
            ))}
          </section>
        );
      })}
    </div>
  );
}

/** A lesson in the week grid: small, but the same facts as the list. */
function DayCard({ lesson: l, since }: { lesson: Lesson; since: string | null }) {
  const mode = lessonMode(l);
  const place = lessonPlace(l);
  const cancelled = l.status === "cancelled";
  return (
    <Link href={`/lessons/${l.id}`} className={`block rounded-xl border border-line bg-surface p-2 text-sm transition-colors hover:border-accent ${cancelled ? "opacity-60" : ""}`}>
      <div className="text-xs tabular-nums text-muted">
        {fmtTime(l.start_at)}–{fmtTime(l.end_at)}
      </div>
      <div className={`font-medium leading-snug ${cancelled ? "line-through" : ""}`}>{lessonNames(l)}</div>
      <div className="mt-1 flex flex-wrap gap-1 text-xs text-muted">
        {l.is_preply ? <span className="chip-accent px-1.5 py-0 text-xs">Preply</span> : mode ? <span>{mode === "onsite" ? (place ?? "Onsite") : "Online"}</span> : null}
        {l.status === "done" ? <span className="chip-ok px-1.5 py-0 text-xs">Done</span> : null}
        {l.status === "cancelled_charged" || l.status === "no_show" ? <span className="chip-warn px-1.5 py-0 text-xs">Charged</span> : null}
        {needsNote(l, since) ? <span className="chip-warn px-1.5 py-0 text-xs">Note</span> : null}
      </div>
    </Link>
  );
}
