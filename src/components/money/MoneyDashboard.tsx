import { thb } from "@/lib/earnings";
import type { MoneyDashboard as Dash } from "@/lib/moneyDash";
import { fmtDay } from "@/lib/time";
import { MonthsChart, WeeksChart } from "./MoneyCharts";
import { SoundLink } from "@/components/glass/SoundLink";

// 📊 The top of the Money page: four headline numbers, then the charts, who the income comes from,
// and the next renewals. Gets everything ready-made (no database), so it can be shown anywhere.

export function MoneyKpis({ dash, month, lastMonth, paidThisMonth }: { dash: Dash; month: string; lastMonth: string; paidThisMonth: number }) {
  const kpi = dash.kpi;
  return (
    <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:[grid-template-columns:repeat(auto-fit,minmax(230px,1fr))]">
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
  renewLinks = {},
}: {
  dash: Dash;
  today: string;
  month: string;
  renewWeeks: number;
  avgPerHour: number | null;
  /** Where "Draft message" goes for each family (their page, where the renewal message is). */
  renewLinks?: Record<string, string>;
}) {
  const kpi = dash.kpi;
  const rowMax = Math.max(1, ...dash.rows.map((r) => r.monthDone + r.monthBooked));
  return (
    <>
      <section className="glass flex flex-col gap-4 rounded-[26px] p-5 sm:p-6">
        <div>
          <h2 className="font-display text-2xl font-semibold">Week by week</h2>
          <p className="mt-1 text-[var(--th-text-3)]">
            Recent weeks and the next 8, by student. Booked weeks count the lessons already in your calendar. Tap a week.
          </p>
        </div>
        <WeeksChart weeks={dash.weeks} groups={dash.groups} />
      </section>

      <section className="glass flex flex-col gap-3 rounded-[26px] p-5 sm:p-6">
        <div>
          <h2 className="font-display text-2xl font-semibold">Who it comes from · {month}</h2>
          <p className="mt-1 text-[var(--th-text-3)]">Taught so far (solid) and booked (light), and what each pays per hour of your time.</p>
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
                <tr key={r.key} className="border-b border-white/10 last:border-0">
                  <td className="w-32 py-2.5 pr-3 align-top sm:w-40">
                    <span className="flex items-center gap-2 font-medium">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: `var(--series-${r.slot})` }} />
                      <span className="truncate">{r.name}</span>
                    </span>
                    <span className="block pl-[18px] text-xs text-muted">{r.kind === "package" ? "package" : "per class"}</span>
                  </td>
                  <td className="py-2.5 pr-3 align-top">
                    <div className="flex h-2.5 overflow-hidden rounded-full bg-white/[0.08]" aria-hidden>
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

      <div className="flex flex-wrap items-stretch gap-5">
        <section className="glass flex min-w-0 flex-[999_1_520px] flex-col gap-4 rounded-[26px] p-5 sm:p-6">
          <div>
            <h2 className="font-display text-2xl font-semibold">Money in by month</h2>
            <p className="mt-1 text-[var(--th-text-3)]">Packages count when they&apos;re paid; per-class lessons when they&apos;re taught.</p>
          </div>
          <MonthsChart months={dash.months} />
        </section>
        <section className="glass flex min-w-0 flex-[1_1_340px] flex-col gap-3 rounded-[26px] p-5 sm:p-6">
          <h2 className="font-display text-2xl font-semibold">Next renewals</h2>
          {dash.renewals.length ? (
            <ul className="flex flex-col gap-3">
              {dash.renewals.map((r) => {
                const days = Math.round((Date.parse(`${r.date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
                const slot = dash.groups.find((g) => g.name === r.name)?.slot ?? 8;
                const soon = days <= renewWeeks * 7;
                return (
                  <li
                    key={r.name}
                    className="glass-hi flex items-center gap-3 rounded-[18px] px-4 py-3.5"
                    style={soon ? { borderColor: "rgba(251,191,36,0.45)" } : undefined}
                  >
                    <span aria-hidden className="h-10 w-2.5 shrink-0 rounded-md" style={{ background: `var(--series-${slot})` }} />
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">{r.name}</span>
                      <span className={`block text-sm ${soon ? "text-[var(--th-todo-text)]" : "text-[var(--th-text-3)]"}`}>
                        runs out around {fmtDay(r.date)} ·{" "}
                        {days <= 0 ? "now" : days < 14 ? `in ${days} ${days === 1 ? "day" : "days"}` : `in ${Math.round(days / 7)} weeks`}
                      </span>
                    </span>
                    <span className="text-right">
                      <span className="font-display block text-lg font-bold tabular-nums">{r.amount != null ? `≈${thb(r.amount)}` : ""}</span>
                      {renewLinks[r.name] ? (
                        <SoundLink
                          href={renewLinks[r.name]}
                          sound="coin"
                          className="inline-flex min-h-[30px] items-center text-[13px] font-semibold text-accent"
                        >
                          Draft message
                        </SoundLink>
                      ) : null}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-muted">No packages to renew.</p>
          )}
          <p className="text-sm text-[var(--th-text-3)]">
            The amount is the last package&apos;s price, as a guide. Draft message opens the family&apos;s renewal message.
          </p>
        </section>
      </div>
    </>
  );
}

function Kpi({ label, value, note, strong }: { label: string; value: string; note: string; strong?: boolean }) {
  return (
    <div
      className={`${strong ? "glass-hi" : "glass"} rounded-[22px] p-4 sm:p-5`}
      style={strong ? { borderColor: "var(--th-accent-line)", background: "color-mix(in srgb, var(--th-accent) 10%, transparent)" } : undefined}
    >
      <div className="text-sm text-[var(--th-text-2)]">{label}</div>
      <div
        className="font-display text-[28px] font-bold leading-tight tabular-nums sm:text-[40px]"
        style={strong ? { color: "color-mix(in srgb, var(--th-accent) 25%, #ffffff)" } : undefined}
      >
        {value}
      </div>
      <div className="text-sm text-[var(--th-text-3)]">{note}</div>
    </div>
  );
}
