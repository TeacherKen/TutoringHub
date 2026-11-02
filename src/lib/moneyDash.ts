// 📊 The Money dashboard's numbers: week by week (taught and booked), money in by month (and expected),
// who the income comes from, and what each pays per hour of Mr Ken's time.
// Pure functions (no database), so they can be tested.
import { computeEarnings, type AccountMoney, type EarnAccount, type EarnLesson, type EarnPackage, type EarnStudent } from "./earnings";
import { addDays, bkkDateKey, mondayOf } from "./time";

export type DashGroup = {
  key: string;
  name: string;
  /** Colour slot 1–8 (fixed by the group's place in the list, so a colour always means the same student). */
  slot: number;
  kind: "package" | "perClass";
  /** Baht per hour of lesson time (latest package rate, or price per class ÷ usual lesson length). */
  perHour: number | null;
};
export type WeekBar = {
  start: string;
  /** Taught (done) and booked (still to come) value per group. */
  done: Record<string, number>;
  booked: Record<string, number>;
  total: number;
  hours: number;
  classes: number;
  when: "past" | "now" | "future";
};
export type MonthBar = { month: string; received: number; expected: number; when: "past" | "now" | "future" };
export type GroupRow = DashGroup & { monthDone: number; monthBooked: number; next4: number; hoursPerWeek: number };
export type Renewal = { name: string; date: string; amount: number | null; leftHours: number };
export type MoneyDashboard = {
  groups: DashGroup[];
  weeks: WeekBar[];
  months: MonthBar[];
  rows: GroupRow[];
  renewals: Renewal[];
  kpi: {
    monthDone: number;
    monthDoneClasses: number;
    monthBooked: number;
    lastMonthDone: number;
    moneyInMonth: number;
    /** Hours paid for in packages but not taught yet, in baht. */
    owedInLessons: number;
  };
};

const num = (v: number | string | null | undefined) => (v == null || v === "" ? null : Number(v));
const monthOf = (d: string) => d.slice(0, 7);
const addMonths = (m: string, n: number) => {
  const [y, mo] = m.split("-").map(Number);
  const t = y * 12 + (mo - 1) + n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
};

export function buildMoneyDashboard(input: {
  accounts: EarnAccount[];
  students: EarnStudent[];
  packages: EarnPackage[];
  /** Lessons already charged (done, no-show, cancelled-but-charged). */
  past: EarnLesson[];
  /** Scheduled lessons still to come. */
  upcoming: EarnLesson[];
  /** The real package results (for "runs out around" and hours left). */
  accountMoney: AccountMoney[];
  today: string;
  weeksBack?: number;
  weeksAhead?: number;
}): MoneyDashboard {
  const { accounts, students, packages, today, accountMoney } = input;
  const weeksBack = input.weeksBack ?? 8;
  const weeksAhead = input.weeksAhead ?? 8;

  // Value every lesson, past and booked, the same way Money already does: booked lessons are treated as
  // if taught, so they use up packages in order (past the hours paid for = at the latest package's rate).
  const future = new Set(input.upcoming.map((l) => l.id));
  const valued = computeEarnings({
    accounts,
    students,
    packages,
    lessons: [...input.past, ...input.upcoming.map((l) => ({ ...l, status: "done" }))],
    upcoming: [],
    today,
  }).lessons;

  // Groups: a family with packages is one group; a student paying per class is their own group.
  const withPackages = new Set(packages.map((p) => p.hour_account_id));
  const accName = new Map(accounts.map((a) => [a.id, a.name]));
  const stu = new Map(students.map((s) => [s.id, s]));
  const groupKey = (sid: string) => {
    const s = stu.get(sid);
    return s?.hour_account_id && withPackages.has(s.hour_account_id) ? `a:${s.hour_account_id}` : `s:${sid}`;
  };
  const groupName = (key: string) => (key.startsWith("a:") ? (accName.get(key.slice(2)) ?? "Family") : (stu.get(key.slice(2))?.first_name ?? "Student"));

  type Item = { date: string; group: string; value: number; hours: number; future: boolean };
  const items: Item[] = [];
  for (const l of valued) {
    if (l.value == null) continue;
    const keys = [...new Set(l.studentIds.map(groupKey))];
    if (!keys.length) continue;
    for (const k of keys) items.push({ date: l.date, group: k, value: l.value / keys.length, hours: l.hours / keys.length, future: future.has(l.id) });
  }

  // Fixed order: families with packages first, then per-class students, each by name. Up to 7 get their own
  // colour; any more share an "Other" (8th) so a colour is never reused.
  const keys = [...new Set(items.map((i) => i.group))].sort((a, b) => (a[0] === b[0] ? groupName(a).localeCompare(groupName(b)) : a < b ? -1 : 1));
  const own = keys.slice(0, keys.length > 8 ? 7 : 8);
  const slotOf = (k: string) => (own.includes(k) ? own.indexOf(k) + 1 : 8);
  const shown = (k: string) => (own.includes(k) ? k : "other");

  // Baht per hour of lesson time.
  const perHourOf = (k: string): number | null => {
    if (k.startsWith("a:")) {
      const p = [...packages].filter((x) => x.hour_account_id === k.slice(2) && num(x.price_thb) != null && Number(x.hours) > 0).sort((a, b) => a.start_date.localeCompare(b.start_date)).pop();
      return p ? Number(p.price_thb) / Number(p.hours) : null;
    }
    const s = stu.get(k.slice(2));
    const perClass = num(s?.class_price_thb);
    const perHour = num(s?.hourly_rate_thb);
    if (perHour != null) return perHour;
    if (perClass == null) return null;
    // The real lesson length (a 50-minute Preply lesson is 0.83 h, not the 0.75 h it counts as for hours).
    const mine = [...input.past, ...input.upcoming].filter((l) => l.charged.some((id) => groupKey(id) === k));
    const avg = mine.length ? mine.reduce((t, l) => t + (Date.parse(l.end_at) - Date.parse(l.start_at)) / 3_600_000, 0) / mine.length : 1;
    return avg > 0 ? perClass / avg : null;
  };

  const groups: DashGroup[] = own.map((k) => ({ key: k, name: groupName(k), slot: slotOf(k), kind: k.startsWith("a:") ? "package" : "perClass", perHour: perHourOf(k) }));
  if (keys.length > own.length) groups.push({ key: "other", name: "Others", slot: 8, kind: "perClass", perHour: null });

  // ---- Week by week ----
  const thisMonday = mondayOf(today);
  // Don't show empty weeks from before the first lesson: start there (at least 3 weeks back).
  const firstItem = items.map((i) => i.date).sort()[0];
  const weeksSince = firstItem ? Math.round((Date.parse(`${thisMonday}T00:00:00Z`) - Date.parse(`${mondayOf(firstItem)}T00:00:00Z`)) / (7 * 86_400_000)) : 0;
  const back = Math.min(weeksBack, Math.max(3, weeksSince));
  const firstWeek = addDays(thisMonday, -7 * back);
  const weeks: WeekBar[] = Array.from({ length: back + 1 + weeksAhead }, (_, i) => {
    const start = addDays(firstWeek, 7 * i);
    return { start, done: {}, booked: {}, total: 0, hours: 0, classes: 0, when: start < thisMonday ? "past" : start === thisMonday ? "now" : "future" };
  });
  const weekIndex = (d: string) => Math.floor((Date.parse(`${mondayOf(d)}T00:00:00Z`) - Date.parse(`${firstWeek}T00:00:00Z`)) / (7 * 86_400_000));
  for (const it of items) {
    const w = weeks[weekIndex(it.date)];
    if (!w) continue;
    const bucket = it.future ? w.booked : w.done;
    const g = shown(it.group);
    bucket[g] = (bucket[g] ?? 0) + it.value;
    w.total += it.value;
    w.hours += it.hours;
  }
  for (const l of valued) {
    const w = weeks[weekIndex(l.date)];
    if (w && l.value != null) w.classes++;
  }
  for (const w of weeks) {
    w.total = Math.round(w.total);
    w.hours = Math.round(w.hours * 10) / 10;
  }

  // ---- This month ----
  const month = monthOf(today);
  const lastMonth = addMonths(month, -1);
  const inMonth = (m: string) => items.filter((i) => monthOf(i.date) === m);
  const monthDone = Math.round(inMonth(month).filter((i) => !i.future).reduce((t, i) => t + i.value, 0));
  const monthBooked = Math.round(inMonth(month).filter((i) => i.future).reduce((t, i) => t + i.value, 0));
  const lastMonthDone = Math.round(inMonth(lastMonth).filter((i) => !i.future).reduce((t, i) => t + i.value, 0));
  const monthDoneClasses = valued.filter((l) => !future.has(l.id) && monthOf(l.date) === month && l.value != null).length;

  // ---- Who it comes from ----
  const in4 = addDays(today, 28);
  const recentFrom = addDays(today, -28);
  const rows: GroupRow[] = groups
    .map((g) => {
      const mine = items.filter((i) => shown(i.group) === g.key);
      const recent = mine.filter((i) => !i.future && i.date >= recentFrom);
      const firstDate = mine.filter((i) => !i.future).map((i) => i.date).sort()[0];
      const weeksSeen = firstDate ? Math.min(4, Math.max(1, Math.ceil((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${firstDate}T00:00:00Z`)) / (7 * 86_400_000)))) : 4;
      return {
        ...g,
        monthDone: Math.round(mine.filter((i) => !i.future && monthOf(i.date) === month).reduce((t, i) => t + i.value, 0)),
        monthBooked: Math.round(mine.filter((i) => i.future && monthOf(i.date) === month).reduce((t, i) => t + i.value, 0)),
        next4: Math.round(mine.filter((i) => i.future && i.date < in4).reduce((t, i) => t + i.value, 0)),
        hoursPerWeek: Math.round((recent.reduce((t, i) => t + i.hours, 0) / weeksSeen) * 10) / 10,
      };
    })
    .sort((a, b) => b.monthDone + b.monthBooked - (a.monthDone + a.monthBooked) || b.next4 - a.next4);

  // ---- Renewals: when each package runs out, and what the next one is likely to cost ----
  const renewals: Renewal[] = accountMoney
    .filter((a) => a.packages.length && a.forecast.endDate)
    .map((a) => {
      const last = [...a.packages].reverse().find((p) => p.price != null);
      return { name: a.name, date: a.forecast.endDate!, amount: last?.price ?? null, leftHours: a.leftHours };
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  // ---- Money in by month: packages when paid, per-class lessons when taught; then what's expected ----
  const paidMonths = packages.filter((p) => p.paid_on && num(p.price_thb)).map((p) => monthOf(p.paid_on!));
  const firstMonth = [...paidMonths, ...items.map((i) => monthOf(i.date)), month].sort()[0];
  const startMonth = firstMonth < addMonths(month, -11) ? addMonths(month, -11) : firstMonth;
  const months: MonthBar[] = [];
  for (let m = startMonth; m <= addMonths(month, 2); m = addMonths(m, 1)) {
    const received =
      packages.filter((p) => p.paid_on && monthOf(p.paid_on) === m).reduce((t, p) => t + (num(p.price_thb) ?? 0), 0) +
      items.filter((i) => !i.future && i.group.startsWith("s:") && monthOf(i.date) === m).reduce((t, i) => t + i.value, 0);
    const expected =
      items.filter((i) => i.future && i.group.startsWith("s:") && monthOf(i.date) === m).reduce((t, i) => t + i.value, 0) +
      renewals.filter((r) => r.amount != null && r.date >= today && monthOf(r.date) === m).reduce((t, r) => t + r.amount!, 0);
    months.push({ month: m, received: Math.round(received), expected: Math.round(expected), when: m < month ? "past" : m === month ? "now" : "future" });
  }

  const owedInLessons = Math.round(accountMoney.reduce((t, a) => t + (a.leftHours > 0 ? (a.leftValue ?? 0) : 0), 0));
  const moneyInMonth = months.find((m) => m.month === month)?.received ?? 0;

  return { groups, weeks, months, rows, renewals, kpi: { monthDone, monthDoneClasses, monthBooked, lastMonthDone, moneyInMonth, owedInLessons } };
}

/** "฿12k", "฿1.5k", "฿800" for chart axes. */
export function shortThb(n: number): string {
  if (Math.abs(n) >= 1000) {
    const k = n / 1000;
    return `฿${k >= 10 || Number.isInteger(k) ? Math.round(k) : k.toFixed(1)}k`;
  }
  return `฿${Math.round(n)}`;
}

