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
    <Link href={href} className="glass lift flex flex-col gap-3 rounded-[24px] p-[22px]" style={soon ? { borderColor: "rgba(251,191,36,0.45)" } : undefined}>
      <div className="flex items-center justify-between gap-2">
        <span className="font-display text-[22px] font-semibold">{a.name}</span>
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
        <div className="mt-2 h-3 overflow-hidden rounded-full bg-white/[0.08]" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <div
            className="h-full rounded-full"
            style={{
              width: `${pct}%`,
              background: soon ? "var(--th-todo)" : "linear-gradient(90deg, color-mix(in srgb, var(--th-accent), #0d9488 45%), var(--th-accent))",
            }}
          />
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
      {a.packages.some((p) => p.state === "next" && p.id !== cur.id)
        ? a.packages
            .filter((p) => p.state === "next" && p.id !== cur.id)
            .map((p) => (
              <p
                key={p.id}
                className="rounded-[14px] border px-3.5 py-3 text-sm"
                style={{
                  background: "color-mix(in srgb, var(--th-accent) 8%, transparent)",
                  borderColor: "color-mix(in srgb, var(--th-accent) 25%, transparent)",
                }}
              >
                Next package ready: <strong>{p.hours} h</strong>
                {p.price != null ? <> · {thb(p.price)}</> : null} — it starts when the {fmtHours(Math.max(0, cur.hours - cur.usedHours))} left on this one are
                used.
              </p>
            ))
        : null}
      <p className="text-[13px] text-[var(--th-label)]">
        All packages: {thb(a.paid)} paid · {thb(a.earned)} earned so far
        {f.basis === "average" ? " · end date estimated from the usual weekly lessons" : ""}
      </p>
    </Link>
  );
}
