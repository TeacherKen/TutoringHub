import Link from "next/link";
import { requireTutor } from "@/lib/auth";
import { getAccountSummaries, getSettings, getStudents } from "@/lib/data";
import { fmtHours } from "@/lib/time";

export default async function StudentsPage() {
  await requireTutor();
  const [students, accounts, settings] = await Promise.all([getStudents(), getAccountSummaries(), getSettings()]);
  const byAccount = new Map(accounts.map((a) => [a.id, a]));
  const active = students.filter((s) => s.active);
  const paused = students.filter((s) => !s.active);

  const row = (s: (typeof students)[number]) => {
    const a = s.hour_account_id ? byAccount.get(s.hour_account_id) : undefined;
    const has = a && a.packages.length > 0;
    const left = a?.balance.left ?? 0;
    const low = has && left <= Number(settings.low_hours_threshold);
    return (
      <Link key={s.id} href={`/students/${s.id}`} className="card flex items-center justify-between gap-3 hover:border-accent">
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
      <div className="space-y-2">{active.map(row)}</div>
      {paused.length ? (
        <section className="space-y-2">
          <h2 className="text-sm font-medium text-muted">Paused</h2>
          {paused.map(row)}
        </section>
      ) : null}
    </div>
  );
}
