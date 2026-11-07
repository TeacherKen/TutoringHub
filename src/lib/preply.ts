// 🟣 Preply numbers for the Money page.
// Preply has no link the app can read, so Mr Ken copies the numbers from Preply's "My students" page now
// and then. Between updates, the app adds the Preply lessons marked done in TutoringHub since that day.

export type PreplyStats = {
  student_id: string;
  account_name: string | null;
  plan: "subscription" | "package" | "trial";
  lesson_price_usd: number | null;
  list_price_usd: number | null;
  income_usd: number;
  lessons: number;
  months: number;
  per_four_weeks: number | null;
  booked: number | null;
  booked_of: number | null;
  renews_on: string | null;
  as_of: string;
  /** When the numbers were copied: lessons that end after this are added on top. */
  updated_at: string;
};

export type PreplyRow = PreplyStats & {
  name: string;
  /** Preply lessons marked done in TutoringHub after the numbers were copied. */
  since: number;
  /** Preply's count plus the ones since. */
  lessonsNow: number;
  share: number;
};

export type PreplySummary = { rows: PreplyRow[]; income: number; lessons: number; asOf: string | null };

export function summarise(stats: PreplyStats[], names: Map<string, string>, doneSince: Map<string, number>): PreplySummary {
  const income = stats.reduce((s, r) => s + Number(r.income_usd), 0);
  const rows = stats
    .map((r) => {
      const since = doneSince.get(r.student_id) ?? 0;
      return {
        ...r,
        income_usd: Number(r.income_usd),
        name: names.get(r.student_id) ?? r.account_name ?? "Student",
        since,
        lessonsNow: r.lessons + since,
        share: income > 0 ? Number(r.income_usd) / income : 0,
      };
    })
    .sort((a, b) => b.income_usd - a.income_usd);
  const asOf = stats.length ? stats.map((s) => s.as_of).sort()[0] : null;
  return { rows, income, lessons: rows.reduce((s, r) => s + r.lessonsNow, 0), asOf };
}

/** The next round number of lessons (50, 100, 150 …) and roughly how many weeks away it is. */
export function nextMilestone(lessons: number, perFourWeeks: number | null): { at: number; left: number; weeks: number | null } {
  const step = lessons < 50 ? 10 : 50;
  const at = Math.floor(lessons / step) * step + step;
  const left = at - lessons;
  const weeks = perFourWeeks && perFourWeeks > 0 ? Math.ceil(left / (perFourWeeks / 4)) : null;
  return { at, left, weeks };
}

export const usd = (n: number, cents = true) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: cents ? 2 : 0 }).format(n);

/** "≈ ฿190,415" — dollars shown in baht at today's rate. */
export const thb = (usdAmount: number, rate: number) => `≈ ฿${Math.round(usdAmount * rate).toLocaleString("en-US")}`;
