import Link from "next/link";
import { lessonNames, needsNote, type Lesson } from "@/lib/data";
import { ViaTag } from "./ViaTag";
import type { Ready } from "@/lib/ready";
import { bkkDateKey, fmtTime } from "@/lib/time";

// 📅 The Week page on a laptop: a calendar with the hours down the side and each lesson placed at its time,
// in its student's colour (the same colour as on Students and Money). Phones keep the simple list.

// The whole day fits on the screen (no scrolling): the calendar is as tall as the window allows, and
// lessons are placed by percentage of it. About this many pixels an hour, to decide how much text fits:
const EST_HEIGHT = 680;
// The calendar on its own fills the screen (below the menu bar and the day names).
const COLUMN_HEIGHT = "max(520px, calc(100dvh - 210px))";
const bkkHour = (iso: string) => {
  const d = new Date(iso);
  return (d.getUTCHours() + 7) % 24 + d.getUTCMinutes() / 60; // Thailand is always UTC+7
};
const weekday = (d: string) => new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`));

export function WeekGrid({
  days,
  lessons,
  today,
  since,
  slotOf,
  ready,
  now,
}: {
  days: string[];
  lessons: Lesson[];
  today: string;
  since: string | null;
  /** Colour slot (1–8) for each lesson id. */
  slotOf: Record<string, number>;
  ready: Record<string, Ready>;
  now: string;
}) {
  // Hours shown: from the earliest lesson to the latest (at least 9:00–18:00), nothing more.
  const starts = lessons.map((l) => bkkHour(l.start_at));
  const ends = lessons.map((l) => {
    const e = bkkHour(l.end_at);
    return e < bkkHour(l.start_at) ? 24 : e;
  });
  const from = Math.max(0, Math.min(9, ...starts.map(Math.floor)));
  const to = Math.min(24, Math.max(18, ...ends.map(Math.ceil)));
  const span = to - from;
  const hours = Array.from({ length: span + 1 }, (_, i) => from + i);
  const pct = (h: number) => `${((h - from) / span) * 100}%`;
  const hourPx = EST_HEIGHT / span;
  const nowH = bkkHour(now);

  return (
    <div id="calendar" className="card hidden scroll-mt-24 overflow-hidden p-0 lg:block">
      {/* Day headings */}
      <div className="grid grid-cols-[52px_repeat(7,minmax(0,1fr))] border-b border-line">
        <div />
        {days.map((d) => {
          const isToday = d === today;
          const count = lessons.filter((l) => bkkDateKey(l.start_at) === d && l.status !== "cancelled").length;
          return (
            <div key={d} className={`border-l border-line px-2 py-1.5 text-center ${isToday ? "bg-accent-soft" : ""}`}>
              <div className={`text-xs font-medium uppercase tracking-wide ${isToday ? "text-accent" : "text-muted"}`}>{weekday(d)}</div>
              <div className="mt-0.5 flex items-center justify-center gap-1.5">
                <span
                  className={`grid h-7 min-w-7 place-items-center rounded-full px-1 text-base font-semibold tabular-nums ${isToday ? "bg-accent text-accent-text" : ""}`}
                >
                  {Number(d.slice(8))}
                </span>
              </div>
              <div className="text-[11px] text-muted">{count ? `${count} ${count === 1 ? "lesson" : "lessons"}` : "free"}</div>
            </div>
          );
        })}
      </div>

      {/* Hours and lessons */}
      <div className="grid grid-cols-[52px_repeat(7,minmax(0,1fr))]">
        <div className="relative" style={{ height: COLUMN_HEIGHT }}>
          {hours.map((h) => (
            <span key={h} className="absolute right-2 -translate-y-1/2 text-[11px] tabular-nums text-muted" style={{ top: pct(h) }}>
              {h === from || h === to ? "" : `${String(h).padStart(2, "0")}:00`}
            </span>
          ))}
        </div>
        {days.map((d) => {
          const isToday = d === today;
          const ls = lessons.filter((l) => bkkDateKey(l.start_at) === d).sort((a, b) => a.start_at.localeCompare(b.start_at));
          // Lessons at the same time sit side by side.
          const lane = new Map<string, number>();
          const laneEnds: number[] = [];
          for (const l of ls) {
            const s = Date.parse(l.start_at);
            let i = laneEnds.findIndex((e) => e <= s);
            if (i < 0) i = laneEnds.length;
            laneEnds[i] = Date.parse(l.end_at);
            lane.set(l.id, i);
          }
          const lanes = Math.max(1, laneEnds.length);
          return (
            <div
              key={d}
              className={`relative border-l border-line ${isToday ? "bg-accent-soft/40" : ""}`}
              style={{
                height: COLUMN_HEIGHT,
                backgroundImage: "linear-gradient(to bottom, var(--border) 1px, transparent 1px)",
                backgroundSize: `100% ${100 / span}%`,
              }}
            >
              {isToday && nowH >= from && nowH <= to ? (
                <div className="pointer-events-none absolute inset-x-0 z-20 flex items-center" style={{ top: pct(nowH) }} aria-label="Now">
                  <span className="-ml-1 h-2 w-2 rounded-full bg-danger" />
                  <span className="h-px flex-1 bg-danger" />
                </div>
              ) : null}
              {ls.map((l) => (
                <Block
                  key={l.id}
                  l={l}
                  since={since}
                  slot={slotOf[l.id] ?? 8}
                  ready={ready[l.id]}
                  top={pct(bkkHour(l.start_at))}
                  hours={(Date.parse(l.end_at) - Date.parse(l.start_at)) / 3_600_000}
                  span={span}
                  hourPx={hourPx}
                  left={(lane.get(l.id)! / lanes) * 100}
                  width={100 / lanes}
                />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Block({
  l,
  since,
  slot,
  ready,
  top,
  hours,
  span,
  hourPx,
  left,
  width,
}: {
  l: Lesson;
  since: string | null;
  slot: number;
  ready?: Ready;
  top: string;
  hours: number;
  span: number;
  hourPx: number;
  left: number;
  width: number;
}) {
  const h = hours * hourPx; // about how tall it is, to decide how much text fits
  const cancelled = l.status === "cancelled";
  const done = l.status === "done";
  const note = needsNote(l, since);
  const lines = h >= 62 ? 3 : h >= 32 ? 2 : 1;
  const colour = `var(--series-${slot})`;
  return (
    <Link
      href={`/lessons/${l.id}`}
      title={`${lessonNames(l)} · ${fmtTime(l.start_at)}–${fmtTime(l.end_at)}`}
      className={`absolute z-10 overflow-hidden rounded-lg border-l-[3px] px-1.5 py-1 text-xs leading-tight shadow-sm transition hover:z-30 hover:shadow-md ${cancelled ? "opacity-50" : ""}`}
      style={{
        top: `calc(${top} + 1px)`,
        height: `max(22px, calc(${(hours / span) * 100}% - 2px))`,
        left: `calc(${left}% + 3px)`,
        width: `calc(${width}% - 6px)`,
        borderLeftColor: colour,
        background: `color-mix(in srgb, ${colour} ${done ? 10 : 18}%, var(--surface))`,
      }}
    >
      <div className={`flex items-start justify-between gap-1 font-semibold text-ink ${cancelled ? "line-through" : ""}`}>
        <span className="truncate">{lessonNames(l)}</span>
        {done ? (
          <span className="shrink-0 text-ok" aria-label="Done">
            ✓
          </span>
        ) : ready ? (
          ready.ready ? (
            <span className="shrink-0 text-ok" title={ready.text} aria-label={ready.text}>
              ●
            </span>
          ) : (
            <span className="shrink-0 text-warn" title={ready.text} aria-label={ready.text}>
              ●
            </span>
          )
        ) : null}
      </div>
      {lines >= 2 ? (
        <div className="flex items-center gap-1 overflow-hidden whitespace-nowrap tabular-nums text-muted">
          {lines === 2 ? (
            <>
              <span>{fmtTime(l.start_at)}</span>
              <ViaTag lesson={l} size="xs" />
            </>
          ) : (
            <span>
              {fmtTime(l.start_at)}–{fmtTime(l.end_at)}
            </span>
          )}
        </div>
      ) : null}
      {lines === 3 ? (
        <div className="mt-1 flex flex-wrap items-center gap-1 text-muted">
          <ViaTag lesson={l} size="xs" />
          {note ? <span className="text-warn">note</span> : null}
          {l.status === "cancelled_charged" || l.status === "no_show" ? <span className="text-warn">charged</span> : null}
        </div>
      ) : null}
    </Link>
  );
}
