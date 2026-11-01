import Link from "next/link";
import { lessonMode, lessonNames, lessonPlace, needsNote, type Lesson } from "@/lib/data";
import { bkkDateKey, fmtDay, fmtTime } from "@/lib/time";
import type { PrepStudent } from "@/lib/prep";
import { PrepCard } from "@/components/PrepCard";
import { ClearAll, SkipOne } from "@/components/ReminderButtons";
import { markPastDone } from "@/app/actions/lessons";

// Home, laid out as a dashboard. The one bold thing is the header on squared exercise-book
// paper with the next lesson; everything else stays quiet: one surface per area, sentence case.

const SQUARED = {
  backgroundImage:
    "linear-gradient(to right, color-mix(in srgb, var(--accent) 9%, transparent) 1px, transparent 1px), linear-gradient(to bottom, color-mix(in srgb, var(--accent) 9%, transparent) 1px, transparent 1px)",
  backgroundSize: "24px 24px",
  backgroundPosition: "-1px -1px",
} as const;

/** "in 2 h 10 min", "in 25 min", "now". */
export function untilText(ms: number): string {
  if (ms <= 60_000) return "starting now";
  const mins = Math.round(ms / 60_000);
  if (mins < 60) return `in ${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h >= 24) return `in ${Math.round(h / 24)} ${Math.round(h / 24) === 1 ? "day" : "days"}`;
  return m ? `in ${h} h ${m} min` : `in ${h} h`;
}

const where = (l: Lesson) => {
  const mode = lessonMode(l);
  const place = lessonPlace(l);
  return [mode === "onsite" ? "Onsite" : mode === "online" ? "Online" : null, place].filter(Boolean).join(", ");
};

export function Hero({
  dateLine,
  greeting,
  now,
  current,
  next,
  refresh,
  problem,
}: {
  dateLine: string;
  greeting: string;
  now: number;
  current: Lesson | null;
  next: Lesson | null;
  refresh: React.ReactNode;
  problem: React.ReactNode;
}) {
  const nextIsToday = next && bkkDateKey(next.start_at) === bkkDateKey(new Date(now));
  return (
    <section className="relative overflow-hidden rounded-3xl border border-line bg-surface" style={SQUARED}>
      {/* the margin line of an exercise book */}
      <span aria-hidden className="absolute inset-y-0 left-8 w-px bg-accent/30 sm:left-10" />
      <div className="relative flex flex-col gap-6 py-6 pl-12 pr-5 sm:py-8 sm:pl-16 sm:pr-8">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[15px] text-muted">{dateLine}</p>
            <h1 className="mt-0.5 text-[24px] font-semibold leading-tight tracking-tight sm:text-[34px]">{greeting}</h1>
          </div>
          {refresh ? <div className="shrink-0">{refresh}</div> : null}
        </div>
        {problem}
        {current ? (
          <NextLine label="Teaching now" lesson={current} detail={`until ${fmtTime(current.end_at)}`} />
        ) : next ? (
          <NextLine
            label={nextIsToday ? "Next lesson" : "No more lessons today. Next lesson"}
            lesson={next}
            detail={nextIsToday ? untilText(Date.parse(next.start_at) - now) : fmtDay(bkkDateKey(next.start_at))}
          />
        ) : (
          <p className="text-lg text-muted">No more lessons booked this week.</p>
        )}
      </div>
    </section>
  );
}

function NextLine({ label, lesson, detail }: { label: string; lesson: Lesson; detail: string }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <p className="text-[15px] text-muted">{label}</p>
        <p className="mt-1 text-[24px] font-semibold leading-tight tracking-tight sm:text-[32px]">
          <span className="tabular-nums text-accent">{fmtTime(lesson.start_at)}</span> {lessonNames(lesson)}
        </p>
        <p className="mt-1 text-[15px] text-muted">
          {detail}
          {where(lesson) ? `, ${where(lesson).toLowerCase()}` : ""}
        </p>
      </div>
      <Link href={`/lessons/${lesson.id}`} className="btn-primary">
        Open lesson
      </Link>
    </div>
  );
}

const STATUS: Partial<Record<Lesson["status"], { label: string; cls: string }>> = {
  done: { label: "Done", cls: "chip-ok" },
  cancelled: { label: "Cancelled", cls: "chip" },
  cancelled_charged: { label: "Cancelled, charged", cls: "chip-warn" },
  no_show: { label: "No-show, charged", cls: "chip-warn" },
};

/** Today's lessons along a time line: done, now, next and later look different. */
export function TodayTimeline({ lessons, now, prep }: { lessons: Lesson[]; now: number; prep: Map<string, PrepStudent[]> }) {
  const nextId = lessons.find((l) => Date.parse(l.start_at) > now && !l.status.startsWith("cancelled"))?.id;
  return (
    <section aria-labelledby="today-h" className="space-y-3">
      <h2 id="today-h" className="h2">
        Today
      </h2>
      {lessons.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line px-4 py-6 text-muted">No lessons today.</p>
      ) : (
        <ol className="rounded-2xl border border-line bg-surface px-3 py-2 sm:px-4">
          {lessons.map((l, i) => {
            const start = Date.parse(l.start_at);
            const end = Date.parse(l.end_at);
            const state = now >= end ? "past" : now >= start ? "now" : l.id === nextId ? "next" : "later";
            const st = STATUS[l.status];
            const p = prep.get(l.id);
            return (
              <li key={l.id} className="relative grid grid-cols-[3.5rem_1.25rem_minmax(0,1fr)] gap-x-2 py-3">
                <div className={`text-right tabular-nums ${state === "past" ? "text-muted" : ""}`}>
                  <div className="font-semibold">{fmtTime(l.start_at)}</div>
                  <div className="text-xs text-muted">{fmtTime(l.end_at)}</div>
                </div>
                {/* the time line */}
                <div className="relative flex justify-center">
                  {i < lessons.length - 1 ? <span aria-hidden className="absolute top-5 -bottom-6 w-px bg-line" /> : null}
                  <span
                    aria-hidden
                    className={`relative mt-1.5 h-3 w-3 rounded-full ${
                      state === "now" ? "bg-accent ring-4 ring-accent-soft" : state === "next" ? "border-2 border-accent bg-surface" : state === "past" ? "bg-line" : "border-2 border-line bg-surface"
                    }`}
                  />
                </div>
                <div className="min-w-0 space-y-2">
                  <Link href={`/lessons/${l.id}`} className="group block rounded-lg focus-visible:outline-2 focus-visible:outline-accent">
                    <div className={`flex flex-wrap items-baseline gap-x-2 ${l.status.startsWith("cancelled") ? "line-through opacity-60" : ""}`}>
                      <span className="text-[17px] font-medium group-hover:text-accent">{lessonNames(l)}</span>
                      {state === "now" ? <span className="text-sm font-medium text-accent">Now</span> : null}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-sm text-muted">
                      {where(l) ? <span>{where(l)}</span> : null}
                      {l.is_preply ? <span className="chip-accent">Preply</span> : null}
                      {st ? <span className={st.cls}>{st.label}</span> : null}
                      {needsNote(l) ? <span className="chip-warn">Note to write</span> : null}
                    </div>
                  </Link>
                  {p && state !== "past" ? <PrepCard lessonId={l.id} students={p} inline /> : null}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

type Row = { id: string; text: string; href: string; danger?: boolean; extra?: React.ReactNode };

/** One list in the To do panel: a heading with its count and action, then the rows (long lists fold away). */
function TodoGroup({ title, action, rows, skip }: { title: string; action?: React.ReactNode; rows: Row[]; skip?: "note" | "feedback" }) {
  if (!rows.length) return null;
  const shown = rows.slice(0, 4);
  const more = rows.slice(4);
  const row = (r: Row) => (
    <li key={r.id} className="flex items-center gap-1">
      <Link href={r.href} className={`flex min-h-11 min-w-0 flex-1 items-center rounded-lg px-2 py-1.5 text-[15px] leading-snug hover:bg-surface-2 ${r.danger ? "text-danger" : ""}`}>
        <span>{r.text}</span>
      </Link>
      {r.extra}
      {skip ? <SkipOne kind={skip} id={r.id} /> : null}
    </li>
  );
  return (
    <div className="py-3 first:pt-1 last:pb-1">
      <div className="flex flex-wrap items-center justify-between gap-2 px-2">
        <h3 className="font-medium">
          {title} <span className="ml-1 rounded-full bg-surface-2 px-2 py-0.5 text-sm tabular-nums text-muted">{rows.length}</span>
        </h3>
        {action}
      </div>
      <ul className="mt-1">{shown.map(row)}</ul>
      {more.length ? (
        <details className="group">
          <summary className="cursor-pointer list-none px-2 py-1.5 text-sm font-medium text-accent">
            <span className="group-open:hidden">Show {more.length} more</span>
            <span className="hidden group-open:inline">Show fewer</span>
          </summary>
          <ul>{more.map(row)}</ul>
        </details>
      ) : null}
    </div>
  );
}

export function TodoPanel({
  notes,
  unmarked,
  feedback,
  renew,
  unpaid,
  link,
}: {
  notes: Lesson[];
  unmarked: number;
  feedback: Lesson[];
  renew: Row[];
  unpaid: Row[];
  link: React.ReactNode;
}) {
  const lessonRow = (l: Lesson, withTime: boolean): Row => ({
    id: l.id,
    href: `/lessons/${l.id}`,
    text: `${lessonNames(l)}, ${fmtDay(bkkDateKey(l.start_at))}${withTime ? ` ${fmtTime(l.start_at)}` : ""}`,
  });
  const noteRows = notes.map((l) => ({
    ...lessonRow(l, true),
    extra:
      l.status === "scheduled" ? (
        <form action={markPastDone}>
          <input type="hidden" name="lesson_id" value={l.id} />
          <button className="min-h-10 rounded-full px-3 text-sm font-medium text-ok hover:bg-ok-soft" title="Mark this class as done (it counts towards hours and money)">
            Done
          </button>
        </form>
      ) : null,
  }));
  const empty = !notes.length && !feedback.length && !renew.length && !unpaid.length && !link;
  return (
    <section aria-labelledby="todo-h" className="space-y-3">
      <h2 id="todo-h" className="h2">
        To do
      </h2>
      {empty ? (
        <p className="flex items-center gap-2 rounded-2xl border border-line bg-surface px-4 py-5 text-[15px]">
          <span aria-hidden className="grid h-6 w-6 place-items-center rounded-full bg-ok-soft text-ok">
            ✓
          </span>
          All caught up.
        </p>
      ) : (
        <div className="divide-y divide-line rounded-2xl border border-line bg-surface px-2 py-2">
          <TodoGroup
            title="Notes to write"
            rows={noteRows}
            skip="note"
            action={
              <span className="flex flex-wrap items-center justify-end gap-1">
                {unmarked > 1 ? (
                  <form action={markPastDone}>
                    <button className="rounded-full px-3 py-1 text-sm font-medium text-ok hover:bg-ok-soft">Mark all done</button>
                  </form>
                ) : null}
                <ClearAll kind="note" ids={notes.map((l) => l.id)} />
              </span>
            }
          />
          <TodoGroup title="Feedback to send" rows={feedback.map((l) => lessonRow(l, false))} skip="feedback" action={<ClearAll kind="feedback" ids={feedback.map((l) => l.id)} />} />
          <TodoGroup title="Packages to renew" rows={renew} />
          <TodoGroup title="Waiting for payment" rows={unpaid} />
          {link}
        </div>
      )}
    </section>
  );
}

/** This month's money and classes, small and quiet. */
export function MonthPanel({ month, earned, classes, hours, week }: { month: string; earned: number; classes: number; hours: number; week: number }) {
  return (
    <section aria-labelledby="month-h" className="rounded-2xl border border-line bg-surface px-4 py-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="month-h" className="font-medium">
          {month} so far
        </h2>
        <Link href="/money" className="text-sm font-medium text-accent">
          Money
        </Link>
      </div>
      <p className="mt-2 text-[28px] font-semibold tabular-nums tracking-tight">฿{earned.toLocaleString("en-US")}</p>
      <p className="text-[15px] text-muted">
        {classes} {classes === 1 ? "class" : "classes"}, {Math.round(hours * 10) / 10} hours taught. {week} {week === 1 ? "lesson" : "lessons"} this week.
      </p>
    </section>
  );
}

/** The rest of the week, one quiet line per lesson. */
export function WeekList({ days }: { days: [string, Lesson[]][] }) {
  return (
    <section aria-labelledby="week-h" className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 id="week-h" className="h2">
          Rest of this week
        </h2>
        <Link href="/week" className="text-sm font-medium text-accent">
          Full week
        </Link>
      </div>
      {days.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line px-4 py-5 text-muted">Nothing else this week.</p>
      ) : (
        <div className="divide-y divide-line rounded-2xl border border-line bg-surface">
          {days.map(([day, list]) => (
            <div key={day} className="grid gap-x-4 px-4 py-3 sm:grid-cols-[7.5rem_minmax(0,1fr)]">
              <h3 className="text-[15px] font-medium text-muted">{fmtDay(day)}</h3>
              <ul>
                {list.map((l) => (
                  <li key={l.id}>
                    <Link href={`/lessons/${l.id}`} className={`flex min-h-10 items-baseline gap-3 rounded-lg hover:text-accent ${l.status.startsWith("cancelled") ? "line-through opacity-60" : ""}`}>
                      <span className="w-12 shrink-0 font-medium tabular-nums">{fmtTime(l.start_at)}</span>
                      <span className="min-w-0 truncate">
                        {lessonNames(l)}
                        {where(l) ? <span className="ml-2 text-muted">{where(l)}</span> : null}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
