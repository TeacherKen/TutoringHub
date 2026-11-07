import Link from "next/link";
import { famTint } from "@/lib/glassTint";
import { nextMilestone, thb, usd, type PreplyRow, type PreplySummary } from "@/lib/preply";
import { fmtDay } from "@/lib/time";
import { Fold } from "@/components/glass/Fold";
import { PreplyForm } from "./PreplyForm";

// 🟣 Preply on the Money page: everything earned there, how it splits between students (one bar in the
// family colours), the top student in a gold spotlight, then a small card for each of the others.

const PLAN = { subscription: "Subscription", package: "Package", trial: "Trial" } as const;

export function PreplyCard({ p, slotOf, today, students, fx }: { p: PreplySummary; slotOf: (id: string) => number; today: string; students: { id: string; name: string }[]; fx: { rate: number; live: boolean } }) {
  const [top, ...rest] = p.rows;
  const sinceTotal = p.rows.reduce((s, r) => s + r.since, 0);
  return (
    <section aria-labelledby="preply-h" className="glass flex flex-col gap-5 rounded-[24px] p-[22px]">
      <header className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.14em]" style={{ color: "#c4b5fd" }}>
            Preply
          </p>
          <h2 id="preply-h" className="font-display text-[26px] font-semibold leading-tight">
            {usd(p.income)} earned
          </h2>
          <p className="text-[15px] font-semibold tabular-nums text-[var(--th-text-2)]" title={`At ${fx.rate.toFixed(2)} baht to the dollar${fx.live ? " (today's rate)" : " (approximate)"}`}>
            {thb(p.income, fx.rate)} <span className="text-xs font-normal text-[var(--th-text-3)]">at ฿{fx.rate.toFixed(2)} per $1{fx.live ? "" : " (approx.)"}</span>
          </p>
        </div>
        <p className="text-sm text-[var(--th-text-3)]">
          {p.lessons} lessons · numbers from Preply on {p.asOf ? fmtDay(p.asOf, today) : "—"}
          {sinceTotal ? ` + ${sinceTotal} taught since` : ""}
        </p>
      </header>

      {/* Who it comes from: one bar, a piece per student */}
      {p.rows.length > 1 ? (
        <div>
          <div className="flex h-3.5 gap-[2px] overflow-hidden rounded-full" role="img" aria-label={p.rows.map((r) => `${r.name} ${Math.round(r.share * 100)}%`).join(", ")}>
            {p.rows.map((r) => (
              <span key={r.student_id} className="bar-grow h-full first:rounded-l-full last:rounded-r-full" style={{ width: `${Math.max(r.share * 100, 1.5)}%`, background: famTint(slotOf(r.student_id)).colour }} />
            ))}
          </div>
          <ul className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1 text-sm">
            {p.rows.map((r) => (
              <li key={r.student_id} className="flex items-center gap-1.5">
                <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ background: famTint(slotOf(r.student_id)).colour }} />
                <span className="font-medium">{r.name}</span>
                <span className="tabular-nums text-[var(--th-text-3)]">
                  {usd(r.income_usd, false)} · {Math.round(r.share * 100)}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {top ? <Spotlight r={top} today={today} rate={fx.rate} /> : null}

      {rest.length ? (
        <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(250px,1fr))]">
          {rest.map((r) => (
            <Small key={r.student_id} r={r} slot={slotOf(r.student_id)} today={today} rate={fx.rate} />
          ))}
        </div>
      ) : null}

      <Fold summary={<span className="font-medium">Update numbers from Preply</span>}>
        <div className="space-y-2 px-5 pb-5">
          <p className="text-sm text-[var(--th-text-3)]">
            On Preply: Students → click a student → Overview. Copy the numbers here. Lessons you mark done in TutoringHub after that are added by themselves.
          </p>
          <PreplyForm students={students} current={p.rows} />
        </div>
      </Fold>
    </section>
  );
}

/** The top student: a gold card with the big number, a monthly average and the next lesson milestone. */
function Spotlight({ r, today, rate }: { r: PreplyRow; today: string; rate: number }) {
  const perMonth = r.months > 0 ? r.income_usd / r.months : null;
  const m = nextMilestone(r.lessonsNow, r.per_four_weeks);
  const from = m.at - (m.at <= 50 ? 10 : 50);
  const pct = Math.min(100, Math.max(4, ((r.lessonsNow - from) / (m.at - from)) * 100));
  return (
    <div
      className="relative overflow-hidden rounded-[22px] p-5 sm:p-6"
      style={{
        background: "linear-gradient(135deg, rgba(251,191,36,0.16), rgba(251,191,36,0.04) 55%, rgba(196,181,253,0.08))",
        border: "1px solid rgba(251,191,36,0.42)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.1), 0 24px 50px -30px rgba(251,191,36,0.55)",
      }}
    >
      <div aria-hidden className="pointer-events-none absolute -right-10 -top-12 h-44 w-44 rounded-full" style={{ background: "radial-gradient(circle, rgba(251,191,36,0.28), transparent 70%)" }} />
      <p className="text-sm font-semibold" style={{ color: "#fcd34d" }}>
        ⭐ Top Preply student
      </p>
      <div className="mt-1 flex flex-wrap items-baseline gap-x-3">
        <Link href={`/students/${r.student_id}`} className="font-display text-[26px] font-semibold hover:underline">
          {r.name}
        </Link>
        {r.account_name && r.account_name !== r.name ? <span className="text-sm text-[var(--th-text-3)]">on Preply: {r.account_name}</span> : null}
      </div>
      <p className="font-display mt-2 text-[44px] font-bold leading-none tabular-nums max-sm:text-[36px]" style={{ background: "linear-gradient(90deg, #fde68a, #fbbf24)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>
        {usd(r.income_usd)}
      </p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-[#fde68a]/80">{thb(r.income_usd, rate)}</p>
      <p className="mt-2 text-[15px] text-[var(--th-text-2)]">
        {r.lessonsNow} lessons over {r.months} {r.months === 1 ? "month" : "months"}
        {perMonth ? ` · about ${usd(perMonth, false)} a month` : ""}
      </p>

      <div className="mt-4 flex flex-wrap gap-2 text-sm">
        {r.lesson_price_usd != null ? (
          <span className="tag">
            {usd(r.lesson_price_usd, false)} a lesson
            {r.list_price_usd && r.list_price_usd > r.lesson_price_usd ? ` (${usd(r.list_price_usd - r.lesson_price_usd, false)} below your ${usd(r.list_price_usd, false)})` : ""}
          </span>
        ) : null}
        {r.per_four_weeks ? <span className="tag">{r.per_four_weeks} lessons every 4 weeks</span> : null}
        {r.renews_on ? <span className="tag">Renews {fmtDay(r.renews_on, today)}</span> : null}
        {r.booked != null && r.booked_of ? (
          <span className="tag">
            {r.booked} of {r.booked_of} booked
          </span>
        ) : null}
      </div>

      <div className="mt-5">
        <div className="flex items-baseline justify-between gap-2 text-sm">
          <span className="font-medium">Next: {m.at} lessons</span>
          <span className="text-[var(--th-text-3)]">
            {m.left} to go{m.weeks ? `, about ${m.weeks} ${m.weeks === 1 ? "week" : "weeks"}` : ""}
          </span>
        </div>
        <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-white/10">
          <div className="bar-grow h-full rounded-full" style={{ width: `${pct}%`, background: "linear-gradient(90deg, #fbbf24, #fde68a)" }} />
        </div>
      </div>
    </div>
  );
}

/** Everyone else: what they've earned, how much of the plan is booked, and a warning if nothing is. */
function Small({ r, slot, today, rate }: { r: PreplyRow; slot: number; today: string; rate: number }) {
  const t = famTint(slot);
  const nothingBooked = r.plan === "subscription" && r.booked === 0 && (r.booked_of ?? 0) > 0;
  const pct = r.booked != null && r.booked_of ? Math.round((r.booked / r.booked_of) * 100) : null;
  return (
    <div className="glass rounded-[20px] p-4" style={{ borderColor: t.line }}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Link href={`/students/${r.student_id}`} className="font-semibold hover:underline">
            {r.name}
          </Link>
          {r.account_name && r.account_name !== r.name ? <span className="ml-1.5 text-sm text-[var(--th-text-3)]">{r.account_name}</span> : null}
        </div>
        <span className="tag shrink-0">{PLAN[r.plan]}</span>
      </div>
      <p className="font-display mt-1.5 text-[26px] font-bold leading-tight tabular-nums">
        {usd(r.income_usd)} <span className="text-base font-semibold text-[var(--th-text-3)]">{thb(r.income_usd, rate)}</span>
      </p>
      <p className="text-sm text-[var(--th-text-3)]">
        {r.lessonsNow} lessons · {r.months} {r.months === 1 ? "month" : "months"}
        {r.lesson_price_usd != null ? ` · ${usd(r.lesson_price_usd, false)} a lesson` : ""}
      </p>
      {pct != null ? (
        <div className="mt-3">
          <div className="flex justify-between text-sm">
            <span>
              {r.booked} of {r.booked_of} {r.plan === "package" ? "used or booked" : "booked"}
            </span>
            {r.renews_on ? <span className="text-[var(--th-text-3)]">renews {fmtDay(r.renews_on, today)}</span> : null}
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/10">
            <div className="bar-grow h-full rounded-full" style={{ width: `${Math.max(pct, 2)}%`, background: t.colour }} />
          </div>
        </div>
      ) : null}
      {nothingBooked ? (
        <p className="mt-3 rounded-xl px-3 py-2 text-sm" style={{ background: "rgba(251,191,36,0.14)", color: "var(--th-todo-text)" }}>
          Nothing booked yet{r.renews_on ? ` and the plan renews ${fmtDay(r.renews_on, today)}` : ""}. Maybe message the family.
        </p>
      ) : null}
    </div>
  );
}
