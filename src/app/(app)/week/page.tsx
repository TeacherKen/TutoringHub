import { CalendarCatchUp } from "@/components/CalendarCatchUp";
import { SoundLink } from "@/components/glass/SoundLink";
import { requireTutor } from "@/lib/auth";
import { getAccountSummaries, getLessons, getSettings, getStudents, needsFeedback, reminderSince } from "@/lib/data";
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
  // Notes are optional, so this card counts parent messages still to send instead.
  const toSend = live.filter((l) => needsFeedback(l, today, bkkDateKey, since)).length;
  const busiest = days.map((d) => ({ d, n: live.filter((l) => bkkDateKey(l.start_at) === d).length })).sort((a, b) => b.n - a.n)[0];

  return (
    <div className="flex flex-col gap-5">
      <CalendarCatchUp />
      <header className="flex flex-wrap items-end justify-between gap-4 px-1.5 pt-1">
        <div>
          <p className="text-base text-[var(--th-text-3)]">
            {fmtDay(monday)} – {fmtDay(addDays(monday, 6))}
          </p>
          <h1 className="font-display text-[36px] font-semibold leading-tight sm:text-[44px]">{isThisWeek ? "This week" : "Week"}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <nav aria-label="Weeks" className="glass flex gap-0.5 rounded-[15px] p-0.5">
            <SoundLink sound="flip" className="seg press" href={`/week?start=${addDays(monday, -7)}`} aria-label="Previous week">
              ‹ Prev
            </SoundLink>
            <SoundLink sound="flip" className={`seg press ${isThisWeek ? "font-semibold text-accent" : ""}`} href="/week" aria-current={isThisWeek ? "date" : undefined}>
              Today
            </SoundLink>
            <SoundLink sound="flip" className="seg press" href={`/week?start=${addDays(monday, 7)}`} aria-label="Next week">
              Next ›
            </SoundLink>
          </nav>
          <RefreshButton />
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:[grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
        <Stat label="Lessons" value={String(live.length)} note={done ? `${done} done` : busiest?.n ? `busiest: ${fmtDay(busiest.d).split(" ")[0]}` : "none booked"} />
        <Stat label="Teaching time" value={fmtHours(Math.round(hours * 4) / 4)} note={live.length ? `about ${fmtHours(Math.round((hours / Math.max(1, live.length)) * 4) / 4)} each` : ""} />
        <Stat
          label="Ready"
          value={coming.length ? `${readyCount} of ${coming.length}` : "—"}
          note={coming.length ? (readyCount === coming.length ? "all set" : "slides or worksheets to do") : "nothing still to come"}
          tone={coming.length ? (readyCount < coming.length ? "warn" : "ok") : undefined}
        />
        <Stat label="Feedback to send" value={String(toSend)} note={toSend ? "lesson updates for parents" : "all sent"} tone={toSend ? "warn" : undefined} />
      </section>

      <WeekGrid days={days} lessons={lessons} today={today} since={since} slotOf={slotOf} ready={ready} now={new Date().toISOString()} />

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
  return (
    <div className="glass rounded-[22px] px-5 py-4">
      <div className="text-sm text-[var(--th-text-3)]">{label}</div>
      <div
        className="font-display text-[30px] font-bold leading-tight tabular-nums sm:text-[38px]"
        style={{ color: tone === "warn" ? "var(--th-todo)" : tone === "ok" ? "var(--th-ready)" : undefined }}
      >
        {value}
      </div>
      <div className="text-sm text-[var(--th-text-3)]">{note}</div>
    </div>
  );
}
