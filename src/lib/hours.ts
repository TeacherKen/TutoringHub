import { bkkDateKey, hoursBetween } from "./time";

export const CHARGED_STATUSES = ["done", "cancelled_charged", "no_show"] as const;

export type HoursPackage = { hours: number; start_date: string };
export type HoursAdjustment = { hours: number };
export type HoursLesson = {
  id: string;
  start_at: string;
  end_at: string;
  status: string;
  length_hours: number | null;
  /** Students in this lesson who use hours (uses_hours = true). */
  charged_student_ids: string[];
};

export function lessonLength(l: { start_at: string; end_at: string; length_hours: number | null }): number {
  return l.length_hours != null ? Number(l.length_hours) : hoursBetween(l.start_at, l.end_at);
}

export type Balance = {
  bought: number;
  adjusted: number;
  used: number;
  left: number;
  startDate: string | null;
  countedLessonIds: string[];
};

/**
 * Hours left for one hour account (one student, or siblings sharing).
 * - Only lessons on or after the first package's start date count.
 * - Done, charged cancellations and no-shows use hours.
 * - A lesson counts once per account, even if two siblings sharing the
 *   account were both in it.
 */
export function accountBalance(
  accountStudentIds: string[],
  packages: HoursPackage[],
  adjustments: HoursAdjustment[],
  lessons: HoursLesson[],
): Balance {
  const bought = packages.reduce((s, p) => s + Number(p.hours), 0);
  const adjusted = adjustments.reduce((s, a) => s + Number(a.hours), 0);
  const startDate = packages.length ? packages.map((p) => p.start_date).sort()[0] : null;
  const members = new Set(accountStudentIds);

  let used = 0;
  const counted: string[] = [];
  if (startDate) {
    for (const l of lessons) {
      if (!(CHARGED_STATUSES as readonly string[]).includes(l.status)) continue;
      if (bkkDateKey(l.start_at) < startDate) continue;
      if (!l.charged_student_ids.some((id) => members.has(id))) continue;
      used += lessonLength(l);
      counted.push(l.id);
    }
  }
  const round = (n: number) => Math.round(n * 100) / 100;
  return {
    bought: round(bought),
    adjusted: round(adjusted),
    used: round(used),
    left: round(bought + adjusted - used),
    startDate,
    countedLessonIds: counted,
  };
}
