import Link from "next/link";
import { requireTutor } from "@/lib/auth";
import { getAccountSummaries, getLessons, getSettings, getStudents } from "@/lib/data";
import { addDays, bkkDateKey, bkkStartOfDay, fmtDay, fmtHours, fmtTime, todayKey } from "@/lib/time";

export default async function StudentsPage() {
  await requireTutor();
  const [students, accounts, settings, coming] = await Promise.all([
    getStudents(),
    getAccountSummaries(),
    getSettings(),
    getLessons(new Date().toISOString(), bkkStartOfDay(addDays(todayKey(), 29)).toISOString()),
  ]);
  // Each student's next lesson in the coming four weeks.
  const next = new Map<string, string>();
  for (const l of coming)
    if (l.status === "scheduled") for (const ls of l.lesson_students) if (!next.has(ls.student_id)) next.set(ls.student_id, l.start_at);
  const byAccount = new Map(accounts.map((a) => [a.id, a]));
  const active = students.filter((s) => s.active);
  const paused = students.filter((s) => !s.active);

  const row = (s: (typeof students)[number]) => {
    const a = s.hour_account_id ? byAccount.get(s.hour_account_id) : undefined;
    const has = a && a.packages.length > 0;
    const left = a?.balance.left ?? 0;
    const low = has && left <= Number(settings.low_hours_threshold);
    return (
      <Link key={s.id} href={`/students/${s.id}`} className="card flex items-start justify-between gap-3 hover:border-accent">
        <div className="min-w-0">
          <div className="font-medium">
            {s.first_name} {s.level ? <span className="text-sm font-normal text-muted">· {s.level}</span> : null}
          </div>
          <div className="mt-1 flex flex-wrap gap-1.5 text-sm text-muted">
            <span>{s.mode === "onsite" ? "Onsite" : "Online"}</span>
            {s.place && s.mode === "onsite" ? <span>· {s.place}</span> : null}
            {s.source === "preply" ? <span className="chip-accent">Preply</span> : null}
            {a && a.students.length > 1 ? <span className="chip">Shares hours</span> : null}
          </div>
          <div className="mt-2 text-xs text-muted">
            {next.get(s.id) ? (
              <>
                Next: <span className="text-ink">{fmtDay(bkkDateKey(next.get(s.id)!))}</span> · {fmtTime(next.get(s.id)!)}
              </>
            ) : s.active ? (
              "No lesson booked in the next 4 weeks"
            ) : null}
          </div>
        </div>
        {has ? (
          <span className={left < 0 ? "chip-danger" : low ? "chip-warn" : "chip"}>{fmtHours(left)} left</span>
        ) : null}
      </Link>
    );
  };

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="h1">Students</h1>
        <Link href="/students/new" className="btn-primary">
          + Add
        </Link>
      </header>
      {students.length === 0 ? (
        <div className="card text-muted">
          No students yet. Add your first student — their first name is used to find their lessons in your calendar.
        </div>
      ) : null}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{active.map(row)}</div>
      {paused.length ? (
        <section className="space-y-2">
          <h2 className="text-sm font-medium text-muted">Paused</h2>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{paused.map(row)}</div>
        </section>
      ) : null}
    </div>
  );
}
