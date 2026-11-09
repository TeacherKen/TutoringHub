import { usdToThb } from "@/lib/fx";
import Link from "next/link";
import { requireTutor } from "@/lib/auth";
import { getMoneyData, getSettings, getStudents, reminderSince, type Student } from "@/lib/data";
import { renewSoon, sumEarned, thb, type LessonEarning } from "@/lib/earnings";
import { PackageCard } from "@/components/MoneyCards";
import { MoneyDashboard, MoneyKpis } from "@/components/money/MoneyDashboard";
import { autoMarkDone, unmarkedPastLessonIds } from "@/lib/autoDone";
import { markPastDone } from "@/app/actions/lessons";
import { markPackagePaid } from "@/app/actions/students";
import { SoundLink } from "@/components/glass/SoundLink";
import { PromptPayQR } from "@/components/PromptPayQR";
import { addDays, bkkDateKey, fmtDay, fmtHours, fmtTime, mondayOf, todayKey } from "@/lib/time";
import { createClient } from "@/lib/supabase/server";
import { colourSlots } from "@/lib/studentColours";
import { summarise, type PreplyStats } from "@/lib/preply";
import { PreplyCard } from "@/components/money/PreplyCard";

export const dynamic = "force-dynamic";

const VIEWS = { week: "This week", month: "This month", last: "Last month" } as const;
type View = keyof typeof VIEWS;

export default async function MoneyPage({ searchParams }: PageProps<"/money">) {
  const [, sp] = await Promise.all([requireTutor(), searchParams]);
  const view: View = sp.view === "month" || sp.view === "last" ? sp.view : "week";
  // Three waits instead of seven. First: tick off finished classes, and fetch what doesn't depend on that.
  const [, settings, allStudents, fx] = await Promise.all([autoMarkDone(), getSettings(), getStudents(), usdToThb()]);
  const todayNow = todayKey();
  // Past classes not marked yet don't count, so say how many there are (the same ones Home lists).
  const [money, unmarkedIds, preply] = await Promise.all([
    getMoneyData(),
    unmarkedPastLessonIds({ before: new Date(), from: reminderSince(settings.track_from, todayNow) }),
    loadPreply(allStudents),
  ]);
  const unmarked = unmarkedIds.length;
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
  // Only packages actually paid (a package still waiting for payment isn't money in yet).
  const paidThisMonth = money.packages
    .filter((p) => p.paid_on && p.paid_on >= monthStart && p.paid_on < nextMonth)
    .reduce((s, p) => s + Number(p.price_thb ?? 0), 0);


  const name = new Map(money.students.map((s) => [s.id, s.first_name]));
  const names = (ids: string[]) => [...new Set(ids.map((id) => name.get(id)).filter(Boolean))].join(" & ") || "—";
  const unpriced = [...new Set(money.lessons.filter((l) => l.date >= lastMonthStart).flatMap((l) => l.unpriced))];
  const withPackages = money.accounts
    .filter((a) => a.packages.length)
    .sort(
      (a, b) =>
        Number(renewSoon(b, today, Number(settings.low_hours_threshold ?? 2), renewWeeks)) -
          Number(renewSoon(a, today, Number(settings.low_hours_threshold ?? 2), renewWeeks)) || a.name.localeCompare(b.name),
    );

  const accountName = new Map(money.accounts.map((a) => [a.id, a.name]));
  const firstStudent = new Map(money.accounts.map((a) => [a.id, a.studentIds[0]]));
  const unpaid = money.packages.filter((p) => !p.paid_on && p.price_thb != null && Number(p.price_thb) > 0);
  const owed = unpaid.reduce((s, p) => s + Number(p.price_thb), 0);
  const dash = money.dashboard;
  const monthHours = sumEarned(money.lessons, monthStart, nextMonth).hours;
  const avgPerHour = monthHours > 0 ? dash.kpi.monthDone / monthHours : null;
  const [from, to] = ranges[view];
  const shown = money.lessons.filter((l) => l.date >= from && l.date < to).reverse();
  const byDay = new Map<string, LessonEarning[]>();
  for (const l of shown) byDay.set(l.date, [...(byDay.get(l.date) ?? []), l]);
  const colours = colourSlots({ students: allStudents, packages: money.packages, accountNames: accountName });
  const preplyStudents = allStudents.filter((s) => s.source === "preply" && s.active !== false).map((s) => ({ id: s.id, name: s.first_name }));
  const monthName = (key: string) => new Intl.DateTimeFormat("en-GB", { month: "long", timeZone: "UTC" }).format(new Date(`${key}T00:00:00Z`));

  return (
    <div className="flex flex-col gap-[22px]">
      <header className="px-1.5 pt-1">
        <h1 className="font-display text-[36px] font-semibold leading-tight sm:text-[44px]">Money</h1>
        <p className="mt-1.5 text-base text-[var(--th-text-3)]">What you earned from the classes you taught, what&apos;s booked, and what&apos;s coming in.</p>
      </header>

      <MoneyKpis dash={dash} month={monthName(monthStart)} lastMonth={monthName(lastMonthStart)} paidThisMonth={paidThisMonth} />
      {unmarked || unpriced.length ? (
        <div className="space-y-2 text-sm text-muted">
          {unmarked ? (
            <div className="glass rounded-2xl p-4 text-[var(--th-todo-text)]" style={{ borderColor: "rgba(251,191,36,0.45)" }}>
              {unmarked} past {unmarked === 1 ? "class isn't" : "classes aren't"} marked yet, so {unmarked === 1 ? "it isn't" : "they aren't"} counted.
              <form action={markPastDone} className="mt-2">
                <button className="btn-secondary min-h-10 text-sm">✓ Mark {unmarked === 1 ? "it" : `all ${unmarked}`} as done</button>
              </form>
            </div>
          ) : null}
          {unpriced.length ? (
            <p className="glass rounded-2xl p-4">
              No price yet for {unpriced.join(", ")}. Add a package, or a price per class in their details (e.g. for Preply).{" "}
              <Link href="/students" className="text-accent underline">
                Students
              </Link>
            </p>
          ) : null}
        </div>
      ) : null}

      <MoneyDashboard
        dash={dash}
        today={today}
        month={monthName(monthStart)}
        renewWeeks={renewWeeks}
        avgPerHour={avgPerHour}
        renewLinks={Object.fromEntries(money.accounts.filter((a) => a.studentIds[0]).map((a) => [a.name, `/students/${a.studentIds[0]}#hours`]))}
      />

      {preply && (preply.rows.length || preplyStudents.length) ? (
        <PreplyCard p={preply} slotOf={colours.slotOfStudent} today={today} students={preplyStudents} fx={fx} />
      ) : null}

      {unpaid.length ? (
        <section id="unpaid" className="space-y-3">
          <h2 className="font-display px-1.5 text-[26px] font-semibold">Waiting for payment · {thb(owed)}</h2>
          {unpaid.map((p) => (
            <div key={p.id} className="glass space-y-3 rounded-[24px] p-5" style={{ borderColor: "rgba(251,191,36,0.45)" }}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <Link
                  href={firstStudent.get(p.hour_account_id) ? `/students/${firstStudent.get(p.hour_account_id)}#hours` : "/students"}
                  className="font-medium hover:underline"
                >
                  {accountName.get(p.hour_account_id) ?? "Package"}
                </Link>
                <span className="text-sm text-muted">
                  {Number(p.hours)} h · <strong className="text-ink">{thb(Number(p.price_thb))}</strong> · added {fmtDay(bkkDateKey(p.created_at))}
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
                    <PromptPayQR
                      promptpayId={settings.promptpay_id}
                      amount={Number(p.price_thb)}
                      label={`PromptPay for ${accountName.get(p.hour_account_id) ?? "lessons"}`}
                    />
                  </div>
                </details>
              ) : null}
            </div>
          ))}
        </section>
      ) : null}

      {withPackages.length ? (
        <section className="flex flex-col gap-3.5">
          <h2 className="font-display px-1.5 text-[26px] font-semibold">Packages</h2>
          <div className="grid gap-[18px] [grid-template-columns:repeat(auto-fit,minmax(min(100%,340px),1fr))]">
            {withPackages.map((a) => (
              <PackageCard key={a.id} a={a} today={today} soon={renewSoon(a, today, Number(settings.low_hours_threshold ?? 2), renewWeeks)} />
            ))}
          </div>
        </section>
      ) : null}

      <section className="flex flex-col gap-3.5">
        <div className="flex flex-wrap items-center justify-between gap-3 px-1.5">
          <h2 className="font-display text-[26px] font-semibold">
            Classes · {view === "week" ? "this week" : view === "month" ? monthName(monthStart) : monthName(lastMonthStart)}
          </h2>
          <nav className="glass flex gap-0.5 rounded-[15px] p-0.5" aria-label="Period">
            {(Object.keys(VIEWS) as View[]).map((k) => (
              <SoundLink
                key={k}
                sound="flip"
                scroll={false}
                href={`/money?view=${k}`}
                aria-current={k === view ? "page" : undefined}
                className={`seg press ${k === view ? "is-on" : ""}`}
              >
                {VIEWS[k]}
              </SoundLink>
            ))}
          </nav>
        </div>
        {shown.length === 0 ? <p className="glass rounded-[20px] px-[22px] py-5 text-[var(--th-text-3)]">No classes marked done in this period yet.</p> : null}
        {[...byDay.entries()].map(([day, list]) => (
          <div key={day} className="glass space-y-2 rounded-[22px] p-4 sm:p-5">
            <h3 className="text-sm font-medium text-muted">{fmtDay(day)}</h3>
            {list.map((l) => (
              <Link
                key={l.id}
                href={`/lessons/${l.id}`}
                className="flex items-center justify-between gap-3 rounded-2xl bg-white/[0.04] p-3 text-sm transition-colors hover:bg-accent-soft"
              >
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
          <p className="px-1.5 text-right text-sm">
            Total: <strong className="tabular-nums">{thb(totals[view].value)}</strong> · {totals[view].classes}{" "}
            {totals[view].classes === 1 ? "class" : "classes"} · {fmtHours(totals[view].hours)}
          </p>
        ) : null}
      </section>
    </div>
  );
}

/** Preply numbers (copied from Preply) plus the Preply lessons marked done since. Null before database update 0026. */
async function loadPreply(students: Student[]) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("preply_stats").select("*");
  if (error) return null;
  const stats = (data ?? []) as PreplyStats[];
  const doneSince = new Map<string, number>();
  if (stats.length) {
    const oldest = stats.map((s) => s.updated_at).sort()[0];
    const { data: rows } = await supabase
      .from("lessons")
      .select("end_at, lesson_students!inner(student_id)")
      .eq("status", "done")
      .eq("ignored", false)
      .gt("end_at", oldest)
      .in(
        "lesson_students.student_id",
        stats.map((s) => s.student_id),
      );
    const copied = new Map(stats.map((s) => [s.student_id, s.updated_at]));
    for (const l of (rows ?? []) as { end_at: string; lesson_students: { student_id: string }[] }[]) {
      for (const ls of l.lesson_students) {
        const at = copied.get(ls.student_id);
        if (at && l.end_at > at) doneSince.set(ls.student_id, (doneSince.get(ls.student_id) ?? 0) + 1);
      }
    }
  }
  return summarise(stats, new Map(students.map((s) => [s.id, s.first_name])), doneSince);
}
