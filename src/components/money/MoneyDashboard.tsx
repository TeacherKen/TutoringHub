import { thb } from "@/lib/earnings";
import type { MoneyDashboard as Dash } from "@/lib/moneyDash";
import { fmtDay } from "@/lib/time";
import { MonthsChart, WeeksChart } from "./MoneyCharts";

// 📊 The top of the Money page: four headline numbers, then the charts, who the income comes from,
// and the next renewals. Gets everything ready-made (no database), so it can be shown anywhere.

export function MoneyKpis({ dash, month, lastMonth, paidThisMonth }: { dash: Dash; month: string; lastMonth: string; paidThisMonth: number }) {
  const kpi = dash.kpi;
  return (
    <section className="grid grid-cols-2 gap-2 lg:grid-cols-4">
      <Kpi
        label={`Earned in ${month}`}
        value={thb(kpi.monthDone)}
        note={`so far · ${kpi.monthDoneClasses} ${kpi.monthDoneClasses === 1 ? "class" : "classes"}${kpi.lastMonthDone ? ` · ${lastMonth} ${thb(kpi.lastMonthDone)}` : ""}`}
        strong
      />
      <Kpi label={`Booked for the rest of ${month}`} value={thb(kpi.monthBooked)} note={`on track for ${thb(kpi.monthDone + kpi.monthBooked)}`} />
      <Kpi
        label={`Money in · ${month}`}
        value={thb(kpi.moneyInMonth)}
        note={paidThisMonth ? `${thb(paidThisMonth)} from packages` : "packages paid + per-class lessons"}
      />
      <Kpi label="Still to teach from packages" value={thb(kpi.owedInLessons)} note="paid in advance, not taught yet" />
    </section>
  );
}

export function MoneyDashboard({
  dash,
  today,
  month,
  renewWeeks,
  avgPerHour,
}: {
  dash: Dash;
  today: string;
  month: string;
  renewWeeks: number;
  avgPerHour: number | null;
}) {
  const kpi = dash.kpi;
  const rowMax = Math.max(1, ...dash.rows.map((r) => r.monthDone + r.monthBooked));
  return (
    <>
      <section className="card space-y-3">
        <div>
          <h2 className="h2">Week by week</h2>
          <p className="text-sm text-muted">Recent weeks and the next 8, by student. Booked weeks count the lessons already in your calendar.</p>
        </div>
        <WeeksChart weeks={dash.weeks} groups={dash.groups} />
      </section>

      <section className="card space-y-3">
        <div>
          <h2 className="h2">Who it comes from · {month}</h2>
          <p className="text-sm text-muted">Taught so far (solid) and booked (light), and what each pays per hour of your time.</p>
        </div>
        <table className="w-full text-sm">
          <thead className="sr-only">
            <tr>
              <th>Student</th>
              <th>{month}</th>
              <th>Per hour</th>
              <th>Hours a week</th>
            </tr>
          </thead>
          <tbody>
            {dash.rows.map((r) => {
              const total = r.monthDone + r.monthBooked;
              return (
                <tr key={r.key} className="border-b border-line last:border-0">
                  <td className="w-32 py-2.5 pr-3 align-top sm:w-40">
                    <span className="flex items-center gap-2 font-medium">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: `var(--series-${r.slot})` }} />
                      <span className="truncate">{r.name}</span>
                    </span>
                    <span className="block pl-[18px] text-xs text-muted">{r.kind === "package" ? "package" : "per class"}</span>
                  </td>
                  <td className="py-2.5 pr-3 align-top">
                    <div className="flex h-2.5 overflow-hidden rounded-full bg-surface-2" aria-hidden>
                      <span
                        style={{
                          width: `${(r.monthDone / rowMax) * 100}%`,
                          background: `var(--series-${r.slot})`,
                        }}
                      />
                      <span
                        style={{
                          width: `${(r.monthBooked / rowMax) * 100}%`,
                          background: `var(--series-${r.slot})`,
                          opacity: 0.38,
                        }}
                      />
                    </div>
                    <span className="mt-1 block text-xs text-muted tabular-nums">
                      <strong className="text-ink">{thb(total)}</strong>
                      {r.monthBooked ? <span className="hidden sm:inline">{` · ${thb(r.monthDone)} taught, ${thb(r.monthBooked)} booked`}</span> : null}
                      {kpi.monthDone + kpi.monthBooked > 0 ? ` · ${Math.round((total / (kpi.monthDone + kpi.monthBooked)) * 100)}%` : ""}
                    </span>
                  </td>
                  <td className="w-24 py-2.5 text-right align-top tabular-nums">
                    {r.perHour != null ? (
                      <>
                        <strong>{thb(r.perHour)}</strong>
                        <span className="text-muted">/h</span>
                      </>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                    <span className="block text-xs text-muted">{r.hoursPerWeek ? `${r.hoursPerWeek} h a week` : ""}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {avgPerHour ? (
          <p className="text-xs text-muted">
            Your average this month: <strong className="text-ink">{thb(avgPerHour)}</strong> an hour of teaching.
          </p>
        ) : null}
      </section>

      <section className="grid gap-4 lg:grid-cols-[3fr_2fr]">
        <div className="card space-y-3">
          <div>
            <h2 className="h2">Money in by month</h2>
            <p className="text-sm text-muted">Packages count when they&apos;re paid; per-class lessons when they&apos;re taught.</p>
          </div>
          <MonthsChart months={dash.months} />
        </div>
        <div className="card space-y-3">
          <h2 className="h2">Next renewals</h2>
          {dash.renewals.length ? (
            <ul className="space-y-2">
              {dash.renewals.map((r) => {
                const days = Math.round((Date.parse(`${r.date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
                return (
                  <li
                    key={r.name}
                    className={`flex items-center justify-between gap-3 rounded-xl p-3 text-sm ${days <= renewWeeks * 7 ? "bg-warn-soft" : "bg-surface-2"}`}
                  >
                    <span>
                      <span className="font-medium">{r.name}</span>
                      <span className="block text-xs text-muted">
                        runs out around {fmtDay(r.date)} · {days <= 0 ? "now" : days < 14 ? `in ${days} days` : `in ${Math.round(days / 7)} weeks`}
                      </span>
                    </span>
                    <span className="text-right tabular-nums">{r.amount != null ? `≈${thb(r.amount)}` : ""}</span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-muted">No packages to renew.</p>
          )}
          <p className="text-xs text-muted">The amount is the last package&apos;s price, as a guide.</p>
        </div>
      </section>
    </>
  );
}

function Kpi({ label, value, note, strong }: { label: string; value: string; note: string; strong?: boolean }) {
  return (
    <div className={`rounded-xl border p-3 ${strong ? "border-accent bg-accent-soft" : "border-line bg-surface"}`}>
      <div className="text-xs text-muted">{label}</div>
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
      <div className="text-xs text-muted">{note}</div>
    </div>
  );
}
