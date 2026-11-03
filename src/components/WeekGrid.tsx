import { lessonNames, lessonVia, lessonMode, lessonPlace, needsNote, type Lesson } from "@/lib/data";
import type { Ready } from "@/lib/ready";
import { bkkDateKey, fmtDay, fmtTime } from "@/lib/time";
import { WeekBoard, type WeekEvent } from "./WeekBoard";

// 📅 The Week page on a laptop: a glass calendar with the hours down the side and each lesson placed at
// its time, in its family's colour (the same colour as on Students and Money). Tapping a lesson shows it
// in the panel beside the calendar. Phones keep the simple list. This part works out where everything
// goes; WeekBoard draws it.

const bkkHour = (iso: string) => {
  const d = new Date(iso);
  return ((d.getUTCHours() + 7) % 24) + d.getUTCMinutes() / 60; // Thailand is always UTC+7
};
const weekday = (d: string) => new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`));

function where(l: Lesson): string {
  const v = lessonVia(l);
  if (lessonMode(l) === "onsite") return ["Onsite", lessonPlace(l)].filter(Boolean).join(" · ");
  return v.label ?? (lessonMode(l) === "online" ? "Online" : "");
}

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
  const pct = (h: number) => ((h - from) / span) * 100;
  const nowH = bkkHour(now);

  const events: WeekEvent[] = [];
  for (const d of days) {
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
    for (const l of ls) {
      const hours = (Date.parse(l.end_at) - Date.parse(l.start_at)) / 3_600_000;
      const long = hours > 1;
      events.push({
        id: l.id,
        day: d,
        name: lessonNames(l),
        time: long ? `${fmtTime(l.start_at)}–${fmtTime(l.end_at)}` : fmtTime(l.start_at),
        when: `${fmtDay(d)} · ${fmtTime(l.start_at)}–${fmtTime(l.end_at)}`,
        mode: where(l),
        slot: slotOf[l.id] ?? 8,
        ready: ready[l.id] ?? null,
        status: l.status,
        note: needsNote(l, since),
        top: pct(bkkHour(l.start_at)),
        height: (hours / span) * 100,
        hours,
        left: (lane.get(l.id)! / lanes) * 100,
        width: 100 / lanes,
      });
    }
  }

  return (
    <WeekBoard
      days={days.map((d) => ({
        key: d,
        dow: weekday(d).toUpperCase(),
        num: Number(d.slice(8)),
        count: lessons.filter((l) => bkkDateKey(l.start_at) === d && l.status !== "cancelled").length,
        isToday: d === today,
      }))}
      hours={Array.from({ length: span + 1 }, (_, i) => from + i).map((h) => ({ top: pct(h), label: h === from || h === to ? "" : `${String(h).padStart(2, "0")}:00` }))}
      span={span}
      events={events}
      nowTop={nowH >= from && nowH <= to ? pct(nowH) : null}
      nowMs={Date.parse(now)}
    />
  );
}
