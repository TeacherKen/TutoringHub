// What each class earned, how much of each package is used up, and when packages run out.
//
// - A class taught from a package is worth that package's price per hour
//   (price ÷ hours). Packages are used up oldest first.
// - A student without a package (e.g. Preply) uses their own "price per class" (or per hour), if set.
// - A package can start with hours already used before TutoringHub was set up.
// - Only lessons marked done, cancelled-but-charged or no-show count, like package hours.
import { CHARGED_STATUSES, lessonLength } from "./hours";
import { addDays, bkkDateKey } from "./time";

export type EarnStudent = {
  id: string;
  first_name: string;
  hour_account_id: string | null;
  hourly_rate_thb?: number | string | null;
  class_price_thb?: number | string | null;
};
export type EarnPackage = {
  id: string;
  hour_account_id: string;
  hours: number | string;
  price_thb: number | string | null;
  start_date: string;
  paid_on?: string | null;
  /** Hours used before TutoringHub started counting this package. */
  hours_used_before?: number | string | null;
};
export type EarnAccount = { id: string; name: string; adjusted: number };
export type EarnLesson = {
  id: string;
  start_at: string;
  end_at: string;
  status: string;
  length_hours: number | string | null;
  /** Students in the lesson who pay for it (uses_hours). */
  charged: string[];
};

export type LessonEarning = {
  id: string;
  start_at: string;
  date: string;
  studentIds: string[];
  hours: number;
  /** null when nothing about this class has a price. */
  value: number | null;
  /** Students in this class with no package and no price per hour. */
  unpriced: string[];
  /** Part of this class went past the hours paid for (valued at the last package's rate). */
  overPackage: boolean;
};

export type PackageProgress = {
  id: string;
  hours: number;
  price: number | null;
  rate: number | null;
  usedHours: number;
  usedValue: number | null;
  startDate: string;
  state: "used" | "current" | "next";
};

export type Forecast = {
  /** Lessons the hours left will still cover. */
  lessonsLeft: number;
  /** Date of the last lesson the hours will cover (estimate). */
  endDate: string | null;
  basis: "calendar" | "average" | "none";
};

export type AccountMoney = {
  id: string;
  name: string;
  studentIds: string[];
  packages: PackageProgress[];
  bought: number;
  leftHours: number;
  leftValue: number | null;
  earned: number;
  paid: number;
  forecast: Forecast;
};

const r2 = (n: number) => Math.round(n * 100) / 100;
const num = (v: number | string | null | undefined) => (v == null || v === "" ? null : Number(v));
const charged = (status: string) => (CHARGED_STATUSES as readonly string[]).includes(status);

export function computeEarnings(input: {
  accounts: EarnAccount[];
  students: EarnStudent[];
  packages: EarnPackage[];
  /** Past and present lessons (any status; only charged ones count). */
  lessons: EarnLesson[];
  /** Scheduled lessons still to come, for the forecast. */
  upcoming: EarnLesson[];
  today: string;
}): { lessons: LessonEarning[]; accounts: AccountMoney[] } {
  const { accounts, students, packages, today } = input;
  const lessons = [...input.lessons].filter((l) => charged(l.status)).sort((a, b) => a.start_at.localeCompare(b.start_at));
  const studentById = new Map(students.map((s) => [s.id, s]));
  const values = new Map<string, { value: number; priced: boolean; unpriced: string[]; over: boolean }>();
  const part = (id: string) => {
    let v = values.get(id);
    if (!v) values.set(id, (v = { value: 0, priced: false, unpriced: [], over: false }));
    return v;
  };
  // Which (lesson, student) pairs a package already paid for.
  const coveredByPackage = new Set<string>();

  const accountsOut: AccountMoney[] = accounts.map((a) => {
    const members = students.filter((s) => s.hour_account_id === a.id).map((s) => s.id);
    const memberSet = new Set(members);
    const pk = packages
      .filter((p) => p.hour_account_id === a.id)
      .sort((x, y) => x.start_date.localeCompare(y.start_date))
      .map((p) => {
        const hours = Number(p.hours);
        const price = num(p.price_thb);
        const before = Math.min(hours, Math.max(0, num(p.hours_used_before) ?? 0));
        return { p, hours, price, before, rate: price != null && hours > 0 ? price / hours : null, left: hours - before };
      });
    const bought = pk.reduce((s, p) => s + p.hours, 0);
    const paid = pk.reduce((s, p) => s + (p.price ?? 0), 0);
    let used = pk.reduce((s, x) => s + x.before, 0);
    let earned = pk.reduce((s, x) => s + (x.rate != null ? x.before * x.rate : 0), 0);

    if (pk.length) {
      const first = pk[0].p.start_date;
      let i = pk.findIndex((x) => x.left > 1e-9);
      if (i < 0) i = pk.length;
      for (const l of lessons) {
        const who = l.charged.filter((id) => memberSet.has(id));
        if (!who.length) continue;
        const date = bkkDateKey(l.start_at);
        if (date < first) {
          // Before the app started counting (already in "hours used before"): worth the
          // rate of the package that was paid for by then, without using hours again.
          const paidBy = [...pk].reverse().find((x) => x.rate != null && (x.p.paid_on ?? x.p.start_date) <= date);
          if (paidBy) {
            const v = part(l.id);
            v.value += lessonLength({ ...l, length_hours: num(l.length_hours) }) * paidBy.rate!;
            v.priced = true;
            for (const id of who) coveredByPackage.add(`${l.id}:${id}`);
          }
          continue;
        }
        for (const id of who) coveredByPackage.add(`${l.id}:${id}`);
        let need = lessonLength({ ...l, length_hours: num(l.length_hours) });
        used += need;
        const v = part(l.id);
        while (need > 1e-9 && i < pk.length) {
          const take = Math.min(need, pk[i].left);
          if (pk[i].rate != null) {
            v.value += take * pk[i].rate!;
            earned += take * pk[i].rate!;
            v.priced = true;
          }
          pk[i].left -= take;
          need -= take;
          if (pk[i].left <= 1e-9) i++;
        }
        if (need > 1e-9) {
          // Taught past the hours paid for: value it at the latest package's rate (still owed).
          const last = [...pk].reverse().find((p) => p.rate != null);
          v.over = true;
          if (last) {
            v.value += need * last.rate!;
            earned += need * last.rate!;
            v.priced = true;
          }
        }
      }
    }

    const leftHours = r2(bought + a.adjusted - used);
    const lastRate = [...pk].reverse().find((p) => p.rate != null)?.rate ?? null;
    const progress: PackageProgress[] = pk.map((x) => {
      const usedHours = r2(x.hours - x.left);
      return {
        id: x.p.id,
        hours: x.hours,
        price: x.price,
        rate: x.rate,
        usedHours,
        usedValue: x.rate != null ? r2(usedHours * x.rate) : null,
        startDate: x.p.start_date,
        state: x.left <= 1e-9 ? "used" : usedHours > 0 ? "current" : "next",
      };
    });
    // If nothing has started yet, the first unused package is the "current" one.
    if (progress.length && !progress.some((p) => p.state === "current")) {
      const next = progress.find((p) => p.state === "next");
      if (next) next.state = "current";
    }

    return {
      id: a.id,
      name: a.name,
      studentIds: members,
      packages: progress,
      bought: r2(bought),
      leftHours,
      leftValue: lastRate != null ? r2(Math.max(0, leftHours) * lastRate) : null,
      earned: r2(earned),
      paid: r2(paid),
      forecast: pk.length ? forecast(leftHours, members, input.lessons, input.upcoming, today) : { lessonsLeft: 0, endDate: null, basis: "none" },
    };
  });

  // Students paying per lesson (no package, e.g. Preply): price per class, or per hour.
  for (const l of lessons) {
    for (const id of l.charged) {
      if (coveredByPackage.has(`${l.id}:${id}`)) continue;
      const s = studentById.get(id);
      const perClass = num(s?.class_price_thb);
      const perHour = num(s?.hourly_rate_thb);
      const v = part(l.id);
      if (perClass != null) {
        v.value += perClass;
        v.priced = true;
      } else if (perHour != null) {
        v.value += perHour * lessonLength({ ...l, length_hours: num(l.length_hours) });
        v.priced = true;
      } else if (s) v.unpriced.push(s.first_name);
    }
  }

  return {
    lessons: lessons.map((l) => {
      const v = values.get(l.id);
      return {
        id: l.id,
        start_at: l.start_at,
        date: bkkDateKey(l.start_at),
        studentIds: l.charged,
        hours: lessonLength({ ...l, length_hours: num(l.length_hours) }),
        value: v?.priced ? Math.round(v.value) : null,
        unpriced: v?.unpriced ?? [],
        overPackage: v?.over ?? false,
      };
    }),
    accounts: accountsOut,
  };
}

/**
 * When will the hours left run out? Walk through the lessons already in the calendar;
 * if hours are still left after those, carry on at the student's usual weekly pace.
 */
export function forecast(leftHours: number, members: string[], past: EarnLesson[], upcoming: EarnLesson[], today: string): Forecast {
  const mine = (l: EarnLesson) => l.charged.some((id) => members.includes(id));
  const len = (l: EarnLesson) => lessonLength({ ...l, length_hours: num(l.length_hours) });
  if (leftHours <= 1e-9) return { lessonsLeft: 0, endDate: today, basis: "calendar" };

  let remaining = leftHours;
  let count = 0;
  let lastDate: string | null = null;
  const future = upcoming.filter((l) => mine(l) && bkkDateKey(l.start_at) >= today).sort((a, b) => a.start_at.localeCompare(b.start_at));
  for (const l of future) {
    const h = len(l);
    if (remaining + 1e-9 < h) return { lessonsLeft: count, endDate: lastDate ?? today, basis: "calendar" };
    remaining -= h;
    count++;
    lastDate = bkkDateKey(l.start_at);
  }
  if (remaining <= 1e-9) return { lessonsLeft: count, endDate: lastDate, basis: "calendar" };

  // Usual pace: hours taught in the last 4 weeks, or else the hours booked in the next 4 weeks.
  const from = addDays(today, -28);
  const recent = past.filter((l) => charged(l.status) && mine(l) && bkkDateKey(l.start_at) >= from && bkkDateKey(l.start_at) <= today);
  const soon = future.filter((l) => bkkDateKey(l.start_at) < addDays(today, 28));
  const sample = recent.length ? recent : soon;
  const weekly = sample.reduce((s, l) => s + len(l), 0) / 4;
  if (weekly <= 0) return { lessonsLeft: count, endDate: lastDate, basis: count ? "calendar" : "none" };
  const avgLesson = sample.reduce((s, l) => s + len(l), 0) / sample.length;
  const extraDays = Math.round((remaining / weekly) * 7);
  return {
    lessonsLeft: count + Math.floor(remaining / avgLesson + 1e-9),
    endDate: addDays(lastDate ?? today, extraDays),
    basis: "average",
  };
}

/** Should this package be renewed soon? */
export function renewSoon(a: AccountMoney, today: string, lowHours: number, renewWeeks: number): boolean {
  if (!a.packages.length) return false;
  if (a.leftHours <= lowHours) return true;
  return a.forecast.endDate != null && a.forecast.endDate <= addDays(today, Math.round(renewWeeks * 7));
}

export function sumEarned(list: LessonEarning[], from: string, toExclusive: string): { value: number; hours: number; classes: number } {
  const inRange = list.filter((l) => l.date >= from && l.date < toExclusive);
  return {
    value: Math.round(inRange.reduce((s, l) => s + (l.value ?? 0), 0)),
    hours: r2(inRange.reduce((s, l) => s + l.hours, 0)),
    classes: inRange.length,
  };
}

export const thb = (n: number) => `฿${Math.round(n).toLocaleString("en-US")}`;
