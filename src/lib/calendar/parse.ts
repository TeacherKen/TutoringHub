import ical, { type VEvent } from "node-ical";

export type Occurrence = {
  /** The calendar event's UID. */
  uid: string;
  /**
   * Stable id for this occurrence, so notes stay attached:
   * - one-off events: "single" (stays the same if the event is moved)
   * - repeating events: the original start time of that repeat (stays the
   *   same if just that one week is moved)
   */
  key: string;
  start: Date;
  end: Date;
  title: string;
  location: string | null;
};

function text(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "object" && v && "val" in v) return String((v as { val: unknown }).val ?? "");
  return String(v);
}

function isCancelled(e: VEvent): boolean {
  return String(e.status ?? "").toUpperCase() === "CANCELLED";
}

/**
 * Turn an iCal (.ics) file into lesson-sized occurrences between `from` and `to`.
 * All-day events (holidays, reminders) are skipped.
 */
export function parseOccurrences(icsText: string, from: Date, to: Date): Occurrence[] {
  const data = ical.sync.parseICS(icsText);
  const out: Occurrence[] = [];

  for (const comp of Object.values(data)) {
    if (!comp || comp.type !== "VEVENT") continue;
    const ev = comp as VEvent;
    if (!ev.uid || !ev.start) continue;
    // Moved single repeats are stored on the main event's `recurrences`;
    // node-ical also lists them separately with a recurrenceid — skip those here.
    if ((ev as VEvent & { recurrenceid?: Date }).recurrenceid && !ev.rrule) continue;

    if (ev.rrule) {
      const instances = ical.expandRecurringEvent(ev, { from, to });
      for (const inst of instances) {
        if (inst.isFullDay) continue;
        const src = inst.event;
        if (isCancelled(src)) continue;
        const originalStart = inst.isOverride
          ? ((src as VEvent & { recurrenceid?: Date }).recurrenceid ?? inst.start)
          : inst.start;
        out.push({
          uid: ev.uid,
          key: new Date(originalStart).toISOString(),
          start: new Date(inst.start),
          end: new Date(inst.end ?? inst.start),
          title: text(src.summary ?? ev.summary).trim(),
          location: text(src.location ?? ev.location).trim() || null,
        });
      }
    } else {
      if (isCancelled(ev)) continue;
      if (ev.datetype === "date" || (ev.start as { dateOnly?: boolean }).dateOnly) continue;
      const start = new Date(ev.start);
      const end = new Date(ev.end ?? ev.start);
      if (end < from || start > to) continue;
      out.push({
        uid: ev.uid,
        key: "single",
        start,
        end,
        title: text(ev.summary).trim(),
        location: text(ev.location).trim() || null,
      });
    }
  }

  out.sort((a, b) => a.start.getTime() - b.start.getTime());
  return out;
}
