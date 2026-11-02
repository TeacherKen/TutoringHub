import Link from "next/link";
import type { Lesson, Student } from "@/lib/data";
import { thb, type AccountMoney } from "@/lib/earnings";
import type { Ready } from "@/lib/ready";
import { bkkDateKey, fmtDay, fmtHours, fmtTime } from "@/lib/time";

/** A family: brothers and sisters sharing hours, or one student. */
export type Family = { key: string; name: string; students: Student[]; account?: AccountMoney; slot: number };

export function firstNext(f: Family, nextOf: Map<string, Lesson>): Lesson | undefined {
  return f.students
    .map((s) => nextOf.get(s.id))
    .filter((l): l is Lesson => !!l)
    .sort((a, b) => a.start_at.localeCompare(b.start_at))[0];
}

export function FamilyCard({
  f,
  today,
  soon,
  next,
  ready,
  taught,
}: {
  f: Family;
  today: string;
  soon: boolean;
  next?: Lesson;
  ready: Map<string, Ready>;
  taught: { value: number | null }[];
}) {
  const colour = `var(--series-${f.slot})`;
  const first = f.students[0];
  const a = f.account;
  const pk = a?.packages.length ? a : null;
  const cur = pk ? (pk.packages.find((p) => p.state === "current") ?? pk.packages[pk.packages.length - 1]) : null;
  const upNext = pk?.packages.find((p) => p.state === "next" && p.id !== cur?.id);
  const pct = cur && cur.hours ? Math.min(100, Math.round((cur.usedHours / cur.hours) * 100)) : 0;
  const curLeft = cur ? Math.max(0, cur.hours - cur.usedHours) : 0;
  const preply = f.students.some((s) => s.source === "preply");
  const r = next ? ready.get(next.id) : undefined;
  const value = taught.reduce((t, l) => t + (l.value ?? 0), 0);
  const days = pk?.forecast.endDate ? Math.round((Date.parse(`${pk.forecast.endDate}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000) : null;

  return (
    <article className={`card flex flex-col gap-3 ${soon ? "border-warn" : ""}`}>
      {/* Who */}
      <div className="flex items-start gap-3">
        <div className="flex -space-x-2">
          {f.students.map((s) => (
            <span
              key={s.id}
              className="grid h-10 w-10 place-items-center rounded-full border-2 border-surface text-sm font-semibold text-ink"
              style={{ background: `color-mix(in srgb, ${colour} 28%, var(--surface))` }}
              aria-hidden
            >
              {s.first_name.slice(0, 2)}
            </span>
          ))}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2">
            {f.students.length > 1 ? (
              f.students.map((s, i) => (
                <span key={s.id} className="font-semibold">
                  <Link href={`/students/${s.id}`} className="hover:underline">
                    {s.first_name}
                  </Link>
                  {i < f.students.length - 1 ? <span className="font-normal text-muted"> &</span> : null}
                </span>
              ))
            ) : (
              <Link href={`/students/${first.id}`} className="font-semibold hover:underline">
                {first.first_name}
              </Link>
            )}
            {f.students.length === 1 && first.level ? <span className="text-sm text-muted">{first.level}</span> : null}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted">
            <span className="h-2 w-2 rounded-full" style={{ background: colour }} aria-hidden />
            <span>{first.mode === "onsite" ? `Onsite${first.place ? ` · ${first.place}` : ""}` : "Online"}</span>
            {preply ? <span className="chip-accent px-1.5 py-0 text-xs">Preply</span> : null}
            {f.students.length > 1 ? <span>· share hours</span> : null}
          </div>
        </div>
        {soon ? <span className="chip-warn shrink-0 text-xs">Renew soon</span> : null}
      </div>

      {/* Money: package or price per class */}
      {pk && cur ? (
        <div className="rounded-xl bg-surface-2 p-3 text-sm">
          <div className="flex items-baseline justify-between gap-2">
            <span>
              <strong className="tabular-nums">{fmtHours(curLeft)}</strong> <span className="text-muted">left of {cur.hours} h</span>
            </span>
            {cur.price != null ? <span className="text-xs text-muted tabular-nums">{thb(cur.price)} package</span> : null}
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: soon ? "var(--warn)" : colour }} />
          </div>
          <p className="mt-1.5 text-xs text-muted">
            {upNext ? (
              <>
                Then the next package: <span className="text-ink">{upNext.hours} h{upNext.price != null ? ` · ${thb(upNext.price)}` : ""}</span>
                {" · "}
              </>
            ) : null}
            {pk.forecast.endDate ? (
              <>
                All hours run out around <span className="text-ink">{fmtDay(pk.forecast.endDate)}</span>
                {days != null && days >= 0 ? ` (${days < 14 ? `${days} days` : `${Math.round(days / 7)} weeks`})` : ""}
              </>
            ) : (
              "No lessons booked to estimate the end date"
            )}
          </p>
        </div>
      ) : (
        <div className="rounded-xl bg-surface-2 p-3 text-sm">
          <span className="text-muted">Pays per class</span>
          {taught.length ? (
            <span className="float-right tabular-nums">
              {taught.length} this month{value ? ` · ${thb(value)}` : ""}
            </span>
          ) : (
            <span className="float-right text-muted">none this month yet</span>
          )}
        </div>
      )}

      {/* Next lesson */}
      <div className="mt-auto flex items-center justify-between gap-2 text-sm">
        {next ? (
          <Link href={`/lessons/${next.id}`} className="min-w-0 hover:underline">
            <span className="text-muted">Next: </span>
            <span className="font-medium">
              {bkkDateKey(next.start_at) === today ? "Today" : fmtDay(bkkDateKey(next.start_at))} · {fmtTime(next.start_at)}
            </span>
          </Link>
        ) : (
          <span className="text-muted">No lesson in the next 4 weeks</span>
        )}
        {r ? (
          <span className={`shrink-0 text-xs ${r.ready ? "text-ok" : "text-warn"}`} title={r.text}>
            ● {r.ready ? "ready" : r.need === "slides" ? "slides to do" : "print worksheet"}
          </span>
        ) : null}
      </div>
    </article>
  );
}
