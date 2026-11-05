import { lessonMode, lessonNames, lessonPlace, lessonVia, needsNote, type Lesson } from "@/lib/data";
import { bkkDateKey, fmtDay, fmtTime } from "@/lib/time";
import type { PrepStudent } from "@/lib/prep";
import { PrepCard } from "@/components/PrepCard";
import { ClearAll, SkipOne } from "@/components/ReminderButtons";
import { markPastDone, setLessonReady } from "@/app/actions/lessons";
import type { Ready } from "@/lib/ready";
import { famTint, initials } from "@/lib/glassTint";
import { SoundLink } from "@/components/glass/SoundLink";
import { ReadyPill } from "@/components/glass/ReadyPill";
import { TodoToggle } from "@/components/glass/TodoToggle";

// 🏠 Home in TutoringHub Glass: a bright glass header with the next lesson, three glass cards
// (Today, the month so far, To do), then "Coming up" as a glass list whose status pills mark lessons ready.

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
  const v = lessonVia(l);
  return mode === "onsite" ? ["Onsite", lessonPlace(l)].filter(Boolean).join(" · ") : (v.label ?? (mode === "online" ? "Online" : ""));
};

/** "✓ Slides ready", or what's still to do for a coming lesson. */
export function ReadyChip({ r }: { r: Ready }) {
  if (r.ready) return <span className="chip-ok">✓ {r.text}</span>;
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <span className="chip-warn">{r.text}</span>
      {r.hint ? <span className="text-xs text-muted">{r.hint}</span> : null}
    </span>
  );
}

/** Tick a coming lesson ready (or untick it). Lessons ready by their slides don't need it. */
export function ReadyButton({ lessonId, r }: { lessonId: string; r: Ready }) {
  if (r.ready && r.how === "slides") return null;
  return (
    <form action={setLessonReady}>
      <input type="hidden" name="lesson_id" value={lessonId} />
      <input type="hidden" name="ready" value={r.ready ? "false" : "true"} />
      {r.ready ? (
        <button className="min-h-10 rounded-full px-3 text-sm text-muted hover:bg-surface-2" title="Not ready after all">
          Undo
        </button>
      ) : (
        <button className="min-h-10 rounded-full border border-line px-3 text-sm font-medium text-ok hover:bg-ok-soft" title="Worksheet printed / slides set">
          Mark ready
        </button>
      )}
    </form>
  );
}

export function Hero({
  dateLine,
  greeting,
  now,
  current,
  next,
  slot,
  ready,
  refresh,
  problem,
}: {
  dateLine: string;
  greeting: string;
  now: number;
  current: Lesson | null;
  next: Lesson | null;
  /** The family colour of the lesson shown. */
  slot: number;
  ready?: Ready;
  refresh: React.ReactNode;
  problem: React.ReactNode;
}) {
  const nextIsToday = next && bkkDateKey(next.start_at) === bkkDateKey(new Date(now));
  const shown = current ?? next;
  return (
    <section className="glass-hi relative overflow-hidden rounded-[30px] px-6 py-7 sm:px-9 sm:py-8">
      <div aria-hidden className="glass-grid" />
      <div className="relative flex flex-wrap items-end justify-between gap-6">
        <div className="flex min-w-0 flex-col gap-1.5">
          <p className="text-base text-[var(--th-text-3)]">{dateLine}</p>
          <h1 className="font-display text-[34px] font-semibold leading-[1.08] tracking-[-0.015em] sm:text-[44px] lg:text-[52px]">{greeting}</h1>
          {problem ? <div className="mt-4">{problem}</div> : null}
          {shown ? (
            <>
              <p className="mt-4 text-[var(--th-text-3)]">{current ? "Teaching now" : nextIsToday ? "Next lesson" : "No more lessons today. Next lesson"}</p>
              <p className="flex flex-wrap items-baseline gap-x-3.5 gap-y-1">
                <span className="font-display text-[38px] font-bold tabular-nums text-accent sm:text-[48px]">{fmtTime(shown.start_at)}</span>
                <span className="font-display text-[30px] font-semibold leading-tight sm:text-[40px]">{lessonNames(shown)}</span>
              </p>
              <div className="flex flex-wrap items-center gap-2.5 text-[var(--th-text-2)]">
                <span>{current ? `until ${fmtTime(current.end_at)}` : nextIsToday ? untilText(Date.parse(shown.start_at) - now) : fmtDay(bkkDateKey(shown.start_at))}</span>
                <ModePill lesson={shown} slot={slot} />
                {ready && !current ? <ReadyPill lessonId={shown.id} r={ready} who={lessonNames(shown)} /> : null}
              </div>
            </>
          ) : !problem ? (
            <p className="mt-4 text-lg text-[var(--th-text-3)]">No lessons booked in the next 7 days.</p>
          ) : null}
        </div>
        <div className="flex w-full items-center justify-between gap-3 sm:w-auto sm:flex-col sm:items-end sm:gap-3.5">
          {refresh}
          {shown ? (
            <SoundLink href={`/lessons/${shown.id}`} sound="open" className="btn-mint">
              Open lesson
            </SoundLink>
          ) : null}
        </div>
      </div>
    </section>
  );
}

/** "Onsite · Nana", "Preply", "Google Meet", in the family's colour. */
export function ModePill({ lesson, slot }: { lesson: Lesson; slot: number }) {
  const label = where(lesson);
  if (!label) return null;
  const t = famTint(slot);
  return (
    <span className="pill" style={{ background: t.bg, borderColor: t.line, color: t.text }}>
      <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: t.colour }} />
      {label}
    </span>
  );
}

/** A round avatar with two letters, in the family's colour. */
export function Avatar({ name, slot, size = 42 }: { name: string; slot: number; size?: number }) {
  const t = famTint(slot);
  return (
    <span
      aria-hidden
      className="grid shrink-0 place-items-center rounded-full border border-white/15 text-sm font-bold"
      style={{ width: size, height: size, background: t.bg, color: t.text }}
    >
      {initials(name)}
    </span>
  );
}

const STATUS: Partial<Record<Lesson["status"], { label: string; cls: string }>> = {
  done: { label: "Done", cls: "chip-ok" },
  cancelled: { label: "Cancelled", cls: "chip" },
  cancelled_charged: { label: "Cancelled, charged", cls: "chip-warn" },
  no_show: { label: "No-show, charged", cls: "chip-warn" },
};

/** Today's lessons along a time line: done, now, next and later look different. */
export function TodayTimeline({ lessons, now, prep, ready }: { lessons: Lesson[]; now: number; prep: Map<string, PrepStudent[]>; ready: Map<string, Ready> }) {
  const nextId = lessons.find((l) => Date.parse(l.start_at) > now && !l.status.startsWith("cancelled"))?.id;
  return (
    <section aria-labelledby="today-h" className="glass flex flex-col gap-3.5 rounded-[24px] p-[22px]">
      <h2 id="today-h" className="font-display text-[22px] font-semibold">
        Today
      </h2>
      {lessons.length === 0 ? (
        <p className="flex min-h-24 flex-1 items-center rounded-[18px] border border-dashed border-white/20 px-5 text-base text-[var(--th-text-3)]">No lessons today.</p>
      ) : (
        <ol className="-mx-1">
          {lessons.map((l, i) => {
            const start = Date.parse(l.start_at);
            const end = Date.parse(l.end_at);
            const state = now >= end ? "past" : now >= start ? "now" : l.id === nextId ? "next" : "later";
            const st = STATUS[l.status];
            const p = prep.get(l.id);
            const r = ready.get(l.id);
            return (
              <li key={l.id} className="relative grid grid-cols-[3.25rem_1.25rem_minmax(0,1fr)] gap-x-2 py-2.5">
                <div className={`text-right tabular-nums ${state === "past" ? "text-muted" : ""}`}>
                  <div className="font-semibold">{fmtTime(l.start_at)}</div>
                  <div className="text-xs text-muted">{fmtTime(l.end_at)}</div>
                </div>
                {/* the time line */}
                <div className="relative flex justify-center">
                  {i < lessons.length - 1 ? <span aria-hidden className="absolute top-5 -bottom-5 w-px bg-white/15" /> : null}
                  <span
                    aria-hidden
                    className={`relative mt-1.5 h-3 w-3 rounded-full ${
                      state === "now"
                        ? "bg-accent ring-4 ring-accent-soft"
                        : state === "next"
                          ? "border-2 border-accent"
                          : state === "past"
                            ? "bg-white/20"
                            : "border-2 border-white/25"
                    }`}
                  />
                </div>
                <div className="min-w-0 space-y-2">
                  <SoundLink href={`/lessons/${l.id}`} sound="open" className="group block rounded-lg">
                    <div className={`flex flex-wrap items-baseline gap-x-2 ${l.status.startsWith("cancelled") ? "line-through opacity-60" : ""}`}>
                      <span className="text-base font-semibold group-hover:text-accent">{lessonNames(l)}</span>
                      {state === "now" ? <span className="text-sm font-medium text-accent">Now</span> : null}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-sm text-muted">
                      {where(l) ? <span>{where(l)}</span> : null}
                      {st ? <span className={st.cls}>{st.label}</span> : null}
                      {needsNote(l) ? <span className="chip-warn">Note to write</span> : null}
                    </div>
                  </SoundLink>
                  {r && (state === "next" || state === "later") ? <ReadyPill lessonId={l.id} r={r} who={lessonNames(l)} /> : null}
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
      <SoundLink href={r.href} className={`flex min-h-11 min-w-0 flex-1 items-center rounded-xl px-2 py-1.5 text-[15px] leading-snug hover:bg-white/5 ${r.danger ? "text-danger" : ""}`}>
        <span>{r.text}</span>
      </SoundLink>
      {r.extra}
      {skip ? <SkipOne kind={skip} id={r.id} /> : null}
    </li>
  );
  return (
    <div className="py-3 first:pt-1 last:pb-1">
      <div className="flex flex-wrap items-center justify-between gap-2 px-2">
        <h3 className="font-semibold">
          {title} <span className="ml-1 rounded-full bg-white/10 px-2 py-0.5 text-sm tabular-nums text-[var(--th-text-2)]">{rows.length}</span>
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
  getReady = [],
  renew,
  unpaid,
  link,
  linkCount = 0,
  messages = [],
  seen = [],
}: {
  /** New messages from families (not read yet). */
  messages?: Row[];
  /** Families who opened their page recently (just so Mr Ken knows; nothing to do). */
  seen?: Row[];
  /** Coming lessons in the next 2 days that aren't ready yet. */
  getReady?: { lesson: Lesson; r: Ready }[];
  notes: Lesson[];
  /** Past classes still "scheduled" (they don't count for hours or money yet), cleared or not. */
  unmarked: Lesson[];
  feedback: Lesson[];
  renew: Row[];
  unpaid: Row[];
  link: React.ReactNode;
  /** How many calendar events still need linking to a student. */
  linkCount?: number;
}) {
  const lessonRow = (l: Lesson, withTime: boolean): Row => ({
    id: l.id,
    href: `/lessons/${l.id}`,
    text: `${lessonNames(l)}, ${fmtDay(bkkDateKey(l.start_at))}${withTime ? ` ${fmtTime(l.start_at)}` : ""}`,
  });
  const doneButton = (id: string) => (
    <form action={markPastDone}>
      <input type="hidden" name="lesson_id" value={id} />
      <button className="min-h-10 rounded-full px-3 text-sm font-medium text-ok hover:bg-ok-soft" title="Mark this class as done (it counts towards hours and money)">
        Done
      </button>
    </form>
  );
  const noteRows = notes.map((l) => ({ ...lessonRow(l, true), extra: l.status === "scheduled" ? doneButton(l.id) : null }));
  // Classes whose note was cleared but that still aren't marked: they'd quietly never count for money.
  const noteIds = new Set(notes.map((l) => l.id));
  const markRows = unmarked.filter((l) => !noteIds.has(l.id)).map((l) => ({ ...lessonRow(l, true), extra: doneButton(l.id) }));
  const markAll = (
    <form action={markPastDone}>
      <button className="rounded-full px-3 py-1 text-sm font-medium text-ok hover:bg-ok-soft">Mark all done</button>
    </form>
  );
  const readyRows = getReady.map(({ lesson: l, r }) => ({ ...lessonRow(l, true), extra: <ReadyPill lessonId={l.id} r={r} who={lessonNames(l)} /> }));
  // The button's words: what's waiting, most useful first.
  const groups: [string, number][] = [
    ["Messages from families", messages.length],
    ["Get ready", readyRows.length],
    ["Notes to write", noteRows.length],
    ["Not marked as done", markRows.length],
    ["Feedback to send", feedback.length],
    ["Packages to renew", renew.length],
    ["Waiting for payment", unpaid.length],
    ["Calendar events to link", link ? linkCount : 0],
  ];
  const waiting = groups.filter(([, n]) => n > 0);
  const total = waiting.reduce((t, [, n]) => t + n, 0);
  const summary = waiting.length === 0 ? "" : waiting.length === 1 ? waiting[0][0] : waiting.length === 2 ? `${waiting[0][0]} and ${waiting[1][0].toLowerCase()}` : `${waiting[0][0]} and ${waiting.length - 1} more`;
  return (
    <section aria-labelledby="todo-h" className="glass flex flex-col gap-3.5 rounded-[24px] p-[22px]">
      <h2 id="todo-h" className="font-display text-[22px] font-semibold">
        To do
      </h2>
      {!waiting.length ? (
        <p className="flex items-center gap-2.5 rounded-2xl border border-white/10 px-4 py-4 text-[15px]">
          <span aria-hidden className="grid h-6 w-6 place-items-center rounded-full bg-ok-soft text-ok">
            ✓
          </span>
          All caught up.
        </p>
      ) : (
        <TodoToggle summary={summary} count={total}>
          <div className="divide-y divide-white/10">
            <TodoGroup title="Messages from families" rows={messages} />
            <TodoGroup title="Get ready" rows={readyRows} />
            <TodoGroup
              title="Notes to write"
              rows={noteRows}
              skip="note"
              action={
                <span className="flex flex-wrap items-center justify-end gap-1">
                  {unmarked.length > 1 && !markRows.length && noteRows.some((r) => r.extra) ? markAll : null}
                  <ClearAll kind="note" ids={notes.map((l) => l.id)} />
                </span>
              }
            />
            <TodoGroup title="Not marked as done" rows={markRows} action={unmarked.length > 1 ? markAll : null} />
            <TodoGroup title="Feedback to send" rows={feedback.map((l) => lessonRow(l, false))} skip="feedback" action={<ClearAll kind="feedback" ids={feedback.map((l) => l.id)} />} />
            <TodoGroup title="Packages to renew" rows={renew} />
            <TodoGroup title="Waiting for payment" rows={unpaid} />
            {link}
          </div>
        </TodoToggle>
      )}
      {seen.length ? (
        <ul className="space-y-1 text-sm text-[var(--th-text-3)]">
          {seen.map((s) => (
            <li key={s.id}>
              <SoundLink href={s.href} className="hover:underline">
                👀 {s.text}
              </SoundLink>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

/** This month's money and classes. */
export function MonthPanel({ month, earned, classes, hours, week }: { month: string; earned: number; classes: number; hours: number; week: number }) {
  return (
    <section aria-labelledby="month-h" className="glass flex flex-col gap-3.5 rounded-[24px] p-[22px]">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="month-h" className="font-display text-[22px] font-semibold">
          {month} so far
        </h2>
        <SoundLink href="/money" sound="nav" className="-my-2 inline-flex min-h-11 items-center font-semibold text-accent">
          Money
        </SoundLink>
      </div>
      <p className="font-display text-[44px] font-bold leading-none tabular-nums">฿{earned.toLocaleString("en-US")}</p>
      <p className="text-[var(--th-text-3)]">
        {classes} {classes === 1 ? "class" : "classes"}, {Math.round(hours * 10) / 10} hours taught. {week} {week === 1 ? "lesson" : "lessons"} this week.
      </p>
    </section>
  );
}

const dayShort = (d: string) => new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`));

/** The next 7 days, one glass row per lesson, each with a status pill to mark it ready. */
export function WeekList({ days, ready, slotOf }: { days: [string, Lesson[]][]; ready: Map<string, Ready>; slotOf: (l: Lesson) => number }) {
  const all = days.flatMap(([, list]) => list).filter((l) => ready.has(l.id));
  const done = all.filter((l) => ready.get(l.id)!.ready).length;
  const canTick = all.some((l) => !ready.get(l.id)!.ready);
  return (
    <section aria-labelledby="week-h" className="flex flex-col gap-3.5">
      <div className="flex items-center gap-3 px-1.5">
        <h2 id="week-h" className="font-display text-[26px] font-semibold">
          Coming up
        </h2>
        {all.length ? (
          <span className={`pill ${done === all.length ? "ok" : ""}`} style={done === all.length ? undefined : { background: "rgba(255,255,255,0.06)", color: "var(--th-text-2)" }}>
            {done} of {all.length} ready
          </span>
        ) : null}
        <span className="flex-1" />
        <SoundLink href="/week" sound="nav" className="inline-flex min-h-11 items-center font-semibold text-accent">
          Full week
        </SoundLink>
      </div>
      {days.length === 0 ? (
        <p className="glass rounded-[24px] px-5 py-6 text-[var(--th-text-3)]">No lessons in the next 7 days.</p>
      ) : (
        <ul className="glass rounded-[24px] p-2">
          {days.flatMap(([day, list]) =>
            list.map((l) => {
              const r = ready.get(l.id);
              const cancelled = l.status.startsWith("cancelled");
              const mins = (Date.parse(l.end_at) - Date.parse(l.start_at)) / 60_000;
              return (
                <li key={l.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl px-3.5 py-3 transition-colors hover:bg-white/[0.04]">
                  <SoundLink href={`/lessons/${l.id}`} sound="open" className={`flex min-w-0 flex-[1_1_260px] items-center gap-4 ${cancelled ? "line-through opacity-60" : ""}`}>
                    <span className="w-[104px] shrink-0 sm:w-[118px]">
                      <span className="block font-semibold">{dayShort(day)}</span>
                      <span className="block text-sm tabular-nums text-[var(--th-text-3)]">
                        {fmtTime(l.start_at)}
                        {mins > 60 ? `–${fmtTime(l.end_at)}` : ""}
                      </span>
                    </span>
                    <Avatar name={lessonNames(l)} slot={slotOf(l)} />
                    <span className="min-w-0">
                      <span className="block truncate text-base font-semibold">{lessonNames(l)}</span>
                      <span className="block truncate text-sm text-[var(--th-text-3)]">{where(l)}</span>
                    </span>
                  </SoundLink>
                  {cancelled ? <span className="chip">Cancelled</span> : r ? <ReadyPill lessonId={l.id} r={r} who={lessonNames(l)} /> : null}
                </li>
              );
            }),
          )}
        </ul>
      )}
      {canTick ? <p className="px-1.5 text-[13px] text-[var(--th-label)]">Tap a status to mark it ready.</p> : null}
    </section>
  );
}
