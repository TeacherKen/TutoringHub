import Link from "next/link";
import { redirect } from "next/navigation";
import { getMe } from "@/lib/auth";
import { syncIfStale } from "@/lib/calendar/sync";
import { getAccountSummaries, getLessons, getSettings, getStudents, lessonNames, needsNote } from "@/lib/data";
import { addDays, bkkDateKey, bkkStartOfDay, fmtDay, fmtHours, fmtLongDay, fmtTime, mondayOf, todayKey } from "@/lib/time";
import { LessonCard } from "@/components/LessonCard";
import { RefreshButton } from "@/components/RefreshButton";
import { linkEventToStudent, setIgnored } from "@/app/actions/calendar";

export default async function Home() {
  const me = await getMe();
  if (me?.role !== "tutor") redirect("/schedule");

  await syncIfStale();
  const today = todayKey();
  const weekEnd = addDays(mondayOf(today), 7);
  const [lessons, settings, accounts, students] = await Promise.all([
    getLessons(bkkStartOfDay(addDays(today, -14)).toISOString(), bkkStartOfDay(weekEnd).toISOString()),
    getSettings(),
    getAccountSummaries(),
    getStudents({ activeOnly: true }),
  ]);

  const matched = lessons.filter((l) => l.lesson_students.length > 0);
  const todays = matched.filter((l) => bkkDateKey(l.start_at) === today);
  const rest = matched.filter((l) => bkkDateKey(l.start_at) > today);
  // Lessons before the "start tracking from" date (Settings) are never flagged.
  const trackFrom = settings.track_from ?? "0000-01-01";
  const tracked = (l: { start_at: string }) => bkkDateKey(l.start_at) >= trackFrom;
  const missing = matched.filter((l) => tracked(l) && needsNote(l));
  const unsent = matched.filter((l) => tracked(l) && l.status === "done" && !l.sent_at && bkkDateKey(l.start_at) <= today);
  const low = accounts.filter((a) => a.packages.length > 0 && a.balance.left <= Number(settings.low_hours_threshold));
  const unmatched = lessons.filter(
    (l) => l.lesson_students.length === 0 && bkkDateKey(l.start_at) >= (trackFrom > addDays(today, -14) ? trackFrom : addDays(today, -14)),
  );

  const byDay = new Map<string, typeof rest>();
  for (const l of rest) {
    const k = bkkDateKey(l.start_at);
    byDay.set(k, [...(byDay.get(k) ?? []), l]);
  }
  const attention = missing.length + unsent.length + low.length + unmatched.length;

  return (
    <div className="space-y-8">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted">{fmtLongDay(today)}</p>
          <h1 className="h1">Today</h1>
        </div>
        {settings.calendar_connected ? <RefreshButton /> : null}
      </header>

      {!settings.calendar_connected ? (
        <div className="card border-accent bg-accent-soft">
          <p className="font-medium">Connect your Google Calendar to see your lessons.</p>
          <p className="mt-1 text-sm text-muted">It takes about 2 minutes. Then add your students so lessons match.</p>
          <Link href="/settings#calendar" className="btn-primary mt-3">
            Connect calendar
          </Link>
        </div>
      ) : settings.last_sync_error ? (
        <p className="rounded-xl bg-danger-soft p-3 text-sm text-danger">{settings.last_sync_error}</p>
      ) : null}

      <section className="space-y-3">
        {todays.length ? (
          todays.map((l) => <LessonCard key={l.id} lesson={l} />)
        ) : (
          <p className="card text-muted">No lessons today.</p>
        )}
      </section>

      {attention > 0 ? (
        <section className="space-y-3">
          <h2 className="h2">Needs attention</h2>
          <div className="card space-y-4">
            {missing.length ? (
              <Group title={`Lessons without a note (${missing.length})`}>
                {missing.map((l) => (
                  <AttentionLink key={l.id} href={`/lessons/${l.id}`} text={`${lessonNames(l)} · ${fmtDay(bkkDateKey(l.start_at))} ${fmtTime(l.start_at)}`} />
                ))}
              </Group>
            ) : null}
            {unsent.length ? (
              <Group title={`Feedback not sent yet (${unsent.length})`}>
                {unsent.map((l) => (
                  <AttentionLink key={l.id} href={`/lessons/${l.id}`} text={`${lessonNames(l)} · ${fmtDay(bkkDateKey(l.start_at))}`} />
                ))}
              </Group>
            ) : null}
            {low.length ? (
              <Group title="Low on hours">
                {low.map((a) => (
                  <AttentionLink
                    key={a.id}
                    href={a.students[0] ? `/students/${a.students[0].id}#hours` : "/students"}
                    text={`${a.name} · ${fmtHours(a.balance.left)} left`}
                    danger={a.balance.left < 0}
                  />
                ))}
              </Group>
            ) : null}
            {unmatched.length ? (
              <Group title={`Calendar events not linked to a student (${unmatched.length})`}>
                {unmatched.map((l) => (
                  <div key={l.id} className="rounded-xl border border-line p-3">
                    <div className="text-sm">
                      <span className="font-medium">{l.title || "Untitled event"}</span>
                      <span className="text-muted"> · {fmtDay(bkkDateKey(l.start_at))} {fmtTime(l.start_at)}</span>
                    </div>
                    <form action={linkEventToStudent} className="mt-2 flex flex-wrap items-center gap-2">
                      <input type="hidden" name="lesson_id" value={l.id} />
                      <input type="hidden" name="keyword" value={eventName(l.title)} />
                      <select name="student_id" className="input min-h-11 w-auto flex-1" required defaultValue="">
                        <option value="" disabled>
                          Choose student…
                        </option>
                        {students.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.first_name}
                          </option>
                        ))}
                      </select>
                      <button className="btn-secondary min-h-11">Link</button>
                      {eventName(l.title) ? (
                        <span className="w-full text-xs text-muted">
                          Future events called “{eventName(l.title)}” will link to this student by themselves.
                        </span>
                      ) : null}
                    </form>
                    <form action={setIgnored} className="mt-1">
                      <input type="hidden" name="lesson_id" value={l.id} />
                      <input type="hidden" name="ignored" value="true" />
                      <button className="btn-quiet min-h-9 px-0 text-sm text-muted">Not a lesson — hide it</button>
                    </form>
                  </div>
                ))}
                <p className="text-xs text-muted">
                  Preply names events after the account owner — often the parent (e.g. “Chloe L.” for Yina).
                </p>
              </Group>
            ) : null}
          </div>
        </section>
      ) : null}

      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="h2">Rest of this week</h2>
          <Link href="/week" className="text-sm text-accent">
            Full week
          </Link>
        </div>
        {byDay.size === 0 ? <p className="card text-muted">Nothing else this week.</p> : null}
        {[...byDay.entries()].map(([day, ls]) => (
          <div key={day} className="space-y-2">
            <h3 className="text-sm font-medium text-muted">{fmtDay(day)}</h3>
            {ls.map((l) => (
              <LessonCard key={l.id} lesson={l} />
            ))}
          </div>
        ))}
      </section>
    </div>
  );
}

/** "Chloe L. - Preply lesson" → "Chloe L." — the name part of an event title, used to remember the link. */
function eventName(title: string | null): string {
  const t = (title ?? "").trim();
  const name = t.split(/\s+[-–—|]\s+/)[0]?.trim() ?? "";
  return name.length >= 2 && name.length <= 40 ? name : "";
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium">{title}</h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function AttentionLink({ href, text, danger }: { href: string; text: string; danger?: boolean }) {
  return (
    <Link href={href} className={`flex min-h-11 items-center justify-between rounded-xl bg-surface-2 px-3 text-sm ${danger ? "text-danger" : ""}`}>
      <span>{text}</span>
      <span aria-hidden className="text-muted">›</span>
    </Link>
  );
}
