import Link from "next/link";
import { thb, type AccountMoney } from "@/lib/earnings";
import { fmtDay, fmtHours } from "@/lib/time";

export function Stat({ label, t, href, active }: { label: string; t: { value: number; classes: number }; href: string; active: boolean }) {
  return (
    <Link href={href} className={`rounded-xl border p-3 text-center ${active ? "border-accent bg-accent-soft" : "border-line bg-surface"}`}>
      <div className="text-xs text-muted">{label}</div>
      <div className="text-xl font-semibold tabular-nums sm:text-2xl">{thb(t.value)}</div>
      <div className="text-xs text-muted">
        {t.classes} {t.classes === 1 ? "class" : "classes"}
      </div>
    </Link>
  );
}

export function PackageCard({ a, today, soon }: { a: AccountMoney; today: string; soon: boolean }) {
  const cur = a.packages.find((p) => p.state === "current") ?? a.packages[a.packages.length - 1];
  const pct = cur.hours ? Math.min(100, Math.round((cur.usedHours / cur.hours) * 100)) : 0;
  const f = a.forecast;
  const href = a.studentIds[0] ? `/students/${a.studentIds[0]}#hours` : "/students";
  const daysLeft = f.endDate ? Math.round((new Date(`${f.endDate}T00:00:00Z`).getTime() - new Date(`${today}T00:00:00Z`).getTime()) / 86_400_000) : null;
  return (
    <Link href={href} className={`card block space-y-3 hover:border-accent ${soon ? "border-warn" : ""}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium">{a.name}</span>
        {a.leftHours <= 0 ? <span className="chip-danger">Used up</span> : soon ? <span className="chip-warn">Renew soon</span> : null}
      </div>
      <div>
        <div className="flex justify-between text-sm">
          <span>
            {cur.usedValue != null && cur.price != null ? (
              <>
                <strong className="tabular-nums">{thb(cur.usedValue)}</strong> of {thb(cur.price)} earned
              </>
            ) : (
              "No price on this package"
            )}
          </span>
          <span className="tabular-nums text-muted">
            {cur.usedHours} / {cur.hours} h
          </span>
        </div>
        <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <div className={`h-full rounded-full ${soon ? "bg-warn" : "bg-accent"}`} style={{ width: `${pct}%` }} />
        </div>
      </div>
      <p className="text-sm">
        {a.leftHours > 0 ? (
          <>
            {fmtHours(a.leftHours)} left{a.leftValue != null ? ` (${thb(a.leftValue)})` : ""}
            {f.basis !== "none" ? (
              <>
                {" "}
                · about {f.lessonsLeft} more {f.lessonsLeft === 1 ? "lesson" : "lessons"}
                {f.endDate ? (
                  <>
                    {" "}
                    · runs out around <strong>{fmtDay(f.endDate)}</strong>
                    {daysLeft != null && daysLeft >= 0 ? ` (${daysLeft < 14 ? `${daysLeft} days` : `${Math.round(daysLeft / 7)} weeks`})` : ""}
                  </>
                ) : null}
              </>
            ) : (
              " · no lessons in the calendar to estimate from"
            )}
          </>
        ) : (
          <span className="text-danger">Hours used up{a.leftHours < 0 ? ` — ${fmtHours(-a.leftHours)} taught past the package` : ""}.</span>
        )}
      </p>
      <p className="text-xs text-muted">
        All packages: {thb(a.paid)} paid · {thb(a.earned)} earned so far
        {f.basis === "average" ? " · end date estimated from the usual weekly lessons" : ""}
      </p>
    </Link>
  );
}
