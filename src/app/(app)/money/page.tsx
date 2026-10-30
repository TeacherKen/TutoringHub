import Link from "next/link";
import { requireTutor } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getMoneyData, getSettings } from "@/lib/data";
import { renewSoon, sumEarned, thb, type LessonEarning } from "@/lib/earnings";
import { PackageCard, Stat } from "@/components/MoneyCards";
import { autoMarkDone } from "@/lib/autoDone";
import { markPastDone } from "@/app/actions/lessons";
import { markPackagePaid } from "@/app/actions/students";
import { PromptPayQR } from "@/components/PromptPayQR";
import { addDays, bkkStartOfDay, fmtDay, fmtHours, fmtTime, mondayOf } from "@/lib/time";

export const dynamic = "force-dynamic";

const VIEWS = { week: "This week", month: "This month", last: "Last month" } as const;
type View = keyof typeof VIEWS;

export default async function MoneyPage({ searchParams }: PageProps<"/money">) {
  await requireTutor();
  const sp = await searchParams;
  await autoMarkDone();
  const view: View = sp.view === "month" || sp.view === "last" ? sp.view : "week";
  const [money, settings] = await Promise.all([getMoneyData(), getSettings()]);
  const { today } = money;
  const renewWeeks = Number((settings as { renew_weeks?: number }).renew_weeks ?? 2);

  const weekStart = mondayOf(today);
  const monthStart = `${today.slice(0, 7)}-01`;
  const nextMonth = `${addDays(monthStart, 32).slice(0, 7)}-01`;
  const lastMonthStart = `${addDays(monthStart, -1).slice(0, 7)}-01`;
  const ranges: Record<View, [string, string]> = {
    week: [weekStart, addDays(weekStart, 7)],
    month: [monthStart, nextMonth],
    last: [lastMonthStart, monthStart],
  };
  const totals = Object.fromEntries((Object.keys(ranges) as View[]).map((k) => [k, sumEarned(money.lessons, ...ranges[k])])) as Record<
    View,
    ReturnType<typeof sumEarned>
  >;
  const paidThisMonth = money.packages.filter((p) => (p.paid_on ?? p.start_date) >= monthStart && (p.paid_on ?? p.start_date) < nextMonth).reduce((s, p) => s + Number(p.price_thb ?? 0), 0);

  // Past classes not marked yet don't count, so say how many there are.
  const supabase = await createClient();
  const { count: unmarked } = await supabase
    .from("lessons")
    .select("id, lesson_students!inner(student_id)", { count: "exact", head: true })
    .eq("status", "scheduled")
    .eq("ignored", false)
    .gte("start_at", bkkStartOfDay(lastMonthStart).toISOString())
    .lt("start_at", new Date().toISOString());

  const name = new Map(money.students.map((s) => [s.id, s.first_name]));
  const names = (ids: string[]) => [...new Set(ids.map((id) => name.get(id)).filter(Boolean))].join(" & ") || "—";
  const unpriced = [...new Set(money.lessons.filter((l) => l.date >= lastMonthStart).flatMap((l) => l.unpriced))];
  const withPackages = money.accounts
    .filter((a) => a.packages.length)
    .sort((a, b) => Number(renewSoon(b, today, Number(settings.low_hours_threshold), renewWeeks)) - Number(renewSoon(a, today, Number(settings.low_hours_threshold), renewWeeks)) || a.name.localeCompare(b.name));

  const accountName = new Map(money.accounts.map((a) => [a.id, a.name]));
  const firstStudent = new Map(money.accounts.map((a) => [a.id, a.studentIds[0]]));
  const unpaid = money.packages.filter((p) => !p.paid_on && p.price_thb != null && Number(p.price_thb) > 0);
  const owed = unpaid.reduce((s, p) => s + Number(p.price_thb), 0);
  const [from, to] = ranges[view];
  const shown = money.lessons.filter((l) => l.date >= from && l.date < to).reverse();
  const byDay = new Map<string, LessonEarning[]>();
  for (const l of shown) byDay.set(l.date, [...(byDay.get(l.date) ?? []), l]);
  const monthName = (key: string) => new Intl.DateTimeFormat("en-GB", { month: "long", timeZone: "UTC" }).format(new Date(`${key}T00:00:00Z`));

  return (
    <div className="space-y-8">
      <header>
        <h1 className="h1">Money</h1>
        <p className="mt-1 text-sm text-muted">What you earned from the classes you taught. Each class is worth its package&apos;s price per hour.</p>
      </header>

      <section className="grid grid-cols-3 gap-2">
        <Stat label="This week" t={totals.week} href="/money?view=week" active={view === "week"} />
        <Stat label={monthName(monthStart)} t={totals.month} href="/money?view=month" active={view === "month"} />
        <Stat label={monthName(lastMonthStart)} t={totals.last} href="/money?view=last" active={view === "last"} />
      </section>
      <div className="-mt-5 space-y-2 text-sm text-muted">
        {paidThisMonth > 0 ? <p>Packages paid to you in {monthName(monthStart)}: {thb(paidThisMonth)}</p> : null}
        {unmarked ? (
          <div className="rounded-xl bg-warn-soft p-3 text-warn">
            {unmarked} past {unmarked === 1 ? "class isn't" : "classes aren't"} marked yet, so {unmarked === 1 ? "it isn't" : "they aren't"} counted.
            <form action={markPastDone} className="mt-2">
              <button className="btn-secondary min-h-10 text-sm">✓ Mark {unmarked === 1 ? "it" : `all ${unmarked}`} as done</button>
            </form>
          </div>
        ) : null}
        {unpriced.length ? (
          <p className="rounded-xl bg-surface-2 p-3">
            No price yet for {unpriced.join(", ")}. Add a package, or a price per hour in their details (e.g. for Preply).{" "}
            <Link href="/students" className="text-accent underline">
              Students
            </Link>
          </p>
        ) : null}
      </div>

      {unpaid.length ? (
        <section id="unpaid" className="space-y-3">
          <h2 className="h2">Waiting for payment · {thb(owed)}</h2>
          {unpaid.map((p) => (
            <div key={p.id} className="card space-y-3 border-warn">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <Link href={firstStudent.get(p.hour_account_id) ? `/students/${firstStudent.get(p.hour_account_id)}#hours` : "/students"} className="font-medium hover:underline">
                  {accountName.get(p.hour_account_id) ?? "Package"}
                </Link>
                <span className="text-sm text-muted">
                  {Number(p.hours)} h · <strong className="text-ink">{thb(Number(p.price_thb))}</strong> · added {fmtDay(p.created_at.slice(0, 10))}
                </span>
              </div>
              <form action={markPackagePaid} className="flex flex-wrap items-center gap-2">
                <input type="hidden" name="id" value={p.id} />
                <select name="paid_by" className="input min-h-10 w-auto text-sm" defaultValue="promptpay">
                  <option value="promptpay">PromptPay</option>
                  <option value="bank_transfer">Bank transfer</option>
                  <option value="cash">Cash</option>
                  <option value="other">Other</option>
                </select>
                <button className="btn-primary min-h-10 text-sm">✓ Mark paid today</button>
              </form>
              {settings.promptpay_id ? (
                <details>
                  <summary className="cursor-pointer text-sm text-accent">Show PromptPay QR for {thb(Number(p.price_thb))}</summary>
                  <div className="mt-2 max-w-xs">
                    <PromptPayQR promptpayId={settings.promptpay_id} amount={Number(p.price_thb)} label={`PromptPay for ${accountName.get(p.hour_account_id) ?? "lessons"}`} />
                  </div>
                </details>
              ) : null}
            </div>
          ))}
        </section>
      ) : null}

      {withPackages.length ? (
        <section className="space-y-3">
          <h2 className="h2">Packages</h2>
          {withPackages.map((a) => (
            <PackageCard key={a.id} a={a} today={today} soon={renewSoon(a, today, Number(settings.low_hours_threshold), renewWeeks)} />
          ))}
        </section>
      ) : null}

      <section className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="h2">Classes · {view === "week" ? "this week" : view === "month" ? monthName(monthStart) : monthName(lastMonthStart)}</h2>
          <nav className="flex gap-1 text-sm" aria-label="Period">
            {(Object.keys(VIEWS) as View[]).map((k) => (
              <Link key={k} href={`/money?view=${k}`} className={k === view ? "chip-accent" : "chip"}>
                {VIEWS[k]}
              </Link>
            ))}
          </nav>
        </div>
        {shown.length === 0 ? <p className="card text-sm text-muted">No classes marked done in this period yet.</p> : null}
        {[...byDay.entries()].map(([day, list]) => (
          <div key={day} className="card space-y-2">
            <h3 className="text-sm font-medium text-muted">{fmtDay(day)}</h3>
            {list.map((l) => (
              <Link key={l.id} href={`/lessons/${l.id}`} className="flex items-center justify-between gap-3 rounded-xl bg-surface-2 p-3 text-sm hover:bg-accent-soft">
                <span>
                  <span className="font-medium">{names(l.studentIds)}</span>
                  <span className="text-muted">
                    {" "}
                    · {fmtTime(l.start_at)} · {fmtHours(l.hours)}
                    {l.overPackage ? " · past package" : ""}
                  </span>
                </span>
                <span className="font-semibold tabular-nums">{l.value != null ? thb(l.value) : <span className="font-normal text-muted">no price</span>}</span>
              </Link>
            ))}
          </div>
        ))}
        {shown.length ? (
          <p className="text-right text-sm">
            Total: <strong className="tabular-nums">{thb(totals[view].value)}</strong> · {totals[view].classes} {totals[view].classes === 1 ? "class" : "classes"} ·{" "}
            {fmtHours(totals[view].hours)}
          </p>
        ) : null}
      </section>
    </div>
  );
}
