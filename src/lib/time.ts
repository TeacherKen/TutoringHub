// Everything in TutoringHub is shown in Bangkok time.
export const TZ = "Asia/Bangkok";
const OFFSET_MS = 7 * 60 * 60 * 1000; // Bangkok has no daylight saving

/** "2026-10-29" for the Bangkok calendar day of this instant. */
export function bkkDateKey(d: Date | string): string {
  const t = typeof d === "string" ? new Date(d) : d;
  return new Date(t.getTime() + OFFSET_MS).toISOString().slice(0, 10);
}

/** Midnight (Bangkok) at the start of the given date key, as a Date. */
export function bkkStartOfDay(key: string): Date {
  return new Date(new Date(`${key}T00:00:00Z`).getTime() - OFFSET_MS);
}

export function addDays(key: string, days: number): string {
  const d = new Date(`${key}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Monday (Bangkok) of the week containing this date key. */
export function mondayOf(key: string): string {
  const day = new Date(`${key}T00:00:00Z`).getUTCDay(); // 0 = Sun
  return addDays(key, day === 0 ? -6 : 1 - day);
}

export function todayKey(): string {
  return bkkDateKey(new Date());
}

export function fmtTime(d: Date | string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false }).format(
    new Date(d),
  );
}

export function fmtDay(key: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" }).format(
    new Date(`${key}T00:00:00Z`),
  );
}

export function fmtLongDay(key: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" }).format(
    new Date(`${key}T00:00:00Z`),
  );
}

export function fmtDate(d: Date | string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: TZ, day: "numeric", month: "short", year: "numeric" }).format(
    new Date(d),
  );
}

export function hoursBetween(start: Date | string, end: Date | string): number {
  const h = (new Date(end).getTime() - new Date(start).getTime()) / 3_600_000;
  return Math.max(0, Math.round(h * 4) / 4); // nearest quarter hour
}

export function fmtHours(h: number): string {
  const r = Math.round(h * 100) / 100;
  return `${r} ${Math.abs(r) === 1 ? "hour" : "hours"}`;
}

export function isPast(d: Date | string): boolean {
  return new Date(d).getTime() < Date.now();
}
