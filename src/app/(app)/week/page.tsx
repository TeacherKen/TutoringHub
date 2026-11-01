import { CalendarCatchUp } from "@/components/CalendarCatchUp";
import Link from "next/link";
import { requireTutor } from "@/lib/auth";
import { getLessons, getSettings, reminderSince } from "@/lib/data";
import { addDays, bkkDateKey, bkkStartOfDay, fmtDay, mondayOf, todayKey } from "@/lib/time";
import { LessonCard } from "@/components/LessonCard";
import { RefreshButton } from "@/components/RefreshButton";

function validKey(s: unknown): string | null {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

export default async function WeekPage({ searchParams }: PageProps<"/week">) {
  await requireTutor();
  const { start } = await searchParams;
  const monday = mondayOf(validKey(start) ?? todayKey());
  const [all, settings] = await Promise.all([getLessons(bkkStartOfDay(monday).toISOString(), bkkStartOfDay(addDays(monday, 7)).toISOString()), getSettings()]);
  const lessons = all.filter((l) => l.lesson_students.length > 0);
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const today = todayKey();
  const since = reminderSince(settings.track_from, today);

  return (
    <div className="space-y-6">
      <CalendarCatchUp />
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted">
            {fmtDay(monday)} – {fmtDay(addDays(monday, 6))}
          </p>
          <h1 className="h1">Week</h1>
        </div>
        <RefreshButton />
      </header>
      <div className="flex gap-2">
        <Link className="btn-secondary flex-1" href={`/week?start=${addDays(monday, -7)}`}>
          ‹ Previous
        </Link>
        <Link className="btn-secondary flex-1" href="/week">
          This week
        </Link>
        <Link className="btn-secondary flex-1" href={`/week?start=${addDays(monday, 7)}`}>
          Next ›
        </Link>
      </div>
      {days.map((d) => {
        const ls = lessons.filter((l) => bkkDateKey(l.start_at) === d);
        return (
          <section key={d} className="space-y-2">
            <h2 className={`text-sm font-medium ${d === today ? "text-accent" : "text-muted"}`}>
              {fmtDay(d)} {d === today ? "· Today" : ""}
            </h2>
            {ls.length ? (
              ls.map((l) => <LessonCard key={l.id} lesson={l} since={since} />)
            ) : (
              <p className="px-1 text-sm text-muted">No lessons</p>
            )}
          </section>
        );
      })}
    </div>
  );
}
