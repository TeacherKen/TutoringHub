import { CalendarCatchUp } from "@/components/CalendarCatchUp";
import Link from "next/link";
import { requireTutor } from "@/lib/auth";
import { getAccountSummaries, getLessons, getSettings, getStudents, needsNote, reminderSince } from "@/lib/data";
import { loadReady } from "@/lib/readyData";
import { colourSlots } from "@/lib/studentColours";
import { addDays, bkkDateKey, bkkStartOfDay, fmtDay, fmtHours, mondayOf, todayKey } from "@/lib/time";
import { LessonCard } from "@/components/LessonCard";
import { RefreshButton } from "@/components/RefreshButton";
import { WeekGrid } from "@/components/WeekGrid";

function validKey(s: unknown): string | null {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

export default async function WeekPage({ searchParams }: PageProps<"/week">) {
  await requireTutor();
  const { start } = await searchParams;
  const monday = mondayOf(validKey(start) ?? todayKey());
  const [all, settings, students, accounts] = await Promise.all([
    getLessons(bkkStartOfDay(monday).toISOString(), bkkStartOfDay(addDays(monday, 7)).toISOString()),
    getSettings(),
    getStudents(),
    getAccountSummaries(),
  ]);
  const lessons = all.filter((l) => l.lesson_students.length > 0);
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const today = todayKey();
  const since = reminderSince(settings.track_from, today);
  const isThisWeek = monday === mondayOf(today);

  // Colours: the same for each family/student as on Students and Money.
  const colours = colourSlots({
    students,
    packages: accounts.flatMap((a) => a.packages.map(() => ({ hour_account_id: a.id }))),
    accountNames: new Map(accounts.map((a) => [a.id, a.name])),
  });
  const slotOf = Object.fromEntries(lessons.map((l) => [l.id, colours.slotOfStudent(l.lesson_students[0].student_id)]));
  const readyMap = await loadReady(lessons, students);
  const ready = Object.fromEntries(readyMap);

  // The week in numbers.
  const live = lessons.filter((l) => l.status !== "cancelled");
  const hours = live.reduce((t, l) => t + (Date.parse(l.end_at) - Date.parse(l.start_at)) / 3_600_000, 0);
  const done = live.filter((l) => l.status === "done").length;
  const coming = [...readyMap.values()];
  const readyCount = coming.filter((r) => r.ready).length;
  const notes = live.filter((l) => needsNote(l, since)).length;
  const busiest = days.map((d) => ({ d, n: live.filter((l) => bkkDateKey(l.start_at) === d).length })).sort((a, b) => b.n - a.n)[0];

  return (
    <div className="space-y-4">
      <CalendarCatchUp />
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted">
            {fmtDay(monday)} – {fmtDay(addDays(monday, 6))}
          </p>
          <h1 className="h1">{isThisWeek ? "This week" : "Week"}</h1>
        </div>
        <div className="flex items-center gap-2">
          <nav className="flex overflow-hidden rounded-xl border border-line bg-surface text-sm" aria-label="Weeks">
            <Link className="px-3 py-2 hover:bg-surface-2" href={`/week?start=${addDays(monday, -7)}`} aria-label="Previous week">
              ‹ Prev
            </Link>
            <Link className={`border-x border-line px-3 py-2 hover:bg-surface-2 ${isThisWeek ? "font-semibold text-accent" : ""}`} href="/week">
              Today
            </Link>
            <Link className="px-3 py-2 hover:bg-surface-2" href={`/week?start=${addDays(monday, 7)}`} aria-label="Next week">
              Next ›
            </Link>
          </nav>
          <RefreshButton />
        </div>
      </header>

      <section className="grid grid-cols-2 gap-2 lg:flex lg:flex-wrap lg:gap-2">
        <Stat label="Lessons" value={String(live.length)} note={done ? `${done} done` : busiest?.n ? `busiest: ${fmtDay(busiest.d).split(" ")[0]}` : "none booked"} />
        <Stat label="Teaching" value={fmtHours(Math.round(hours * 4) / 4)} note={live.length ? `about ${fmtHours(Math.round((hours / Math.max(1, live.length)) * 4) / 4)} each` : ""} />
        <Stat
          label="Ready"
          value={coming.length ? `${readyCount} of ${coming.length}` : "—"}
          note={coming.length ? (readyCount === coming.length ? "all set" : "slides or worksheets to do") : "nothing still to come"}
          tone={coming.length && readyCount < coming.length ? "warn" : "ok"}
        />
        <Stat label="Notes to write" value={String(notes)} note={notes ? "after the lesson" : "all written"} tone={notes ? "warn" : "ok"} />
      </section>

      <WeekGrid days={days} lessons={lessons} today={today} since={since} slotOf={slotOf} ready={ready} now={new Date().toISOString()} />
      <p className="hidden text-xs text-muted lg:block">
        <span className="text-ok">●</span> ready · <span className="text-warn">●</span> slides or worksheet still to do · ✓ done · Preply and Google Meet tags show how
        each online lesson happens. Each family has its own colour, the same as on Students and Money.
      </p>

      {/* Phone and iPad: one day under another */}
      <div className="space-y-5 lg:hidden">
        {days.map((d) => {
          const ls = lessons.filter((l) => bkkDateKey(l.start_at) === d);
          return (
            <section key={d} className="space-y-2">
              <h2 className={`text-sm font-medium ${d === today ? "text-accent" : "text-muted"}`}>
                {fmtDay(d)} {d === today ? "· Today" : ""}
              </h2>
              {ls.length ? ls.map((l) => <LessonCard key={l.id} lesson={l} since={since} />) : <p className="px-1 text-sm text-muted">No lessons</p>}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ label, value, note, tone }: { label: string; value: string; note: string; tone?: "ok" | "warn" }) {
  // Phone: a small card. Laptop: one compact pill, so the calendar starts near the top.
  return (
    <div className="rounded-xl border border-line bg-surface p-3 lg:flex lg:items-baseline lg:gap-2 lg:rounded-full lg:px-4 lg:py-1.5">
      <div className="text-xs text-muted">{label}</div>
      <div className={`text-2xl font-semibold tabular-nums lg:text-base ${tone === "warn" ? "text-warn" : ""}`}>{value}</div>
      <div className="text-xs text-muted">{note}</div>
    </div>
  );
}
