import type { Lesson, Student } from "@/lib/data";
import { thb, type AccountMoney } from "@/lib/earnings";
import type { Ready } from "@/lib/ready";
import { bkkDateKey, fmtDay, fmtHours, fmtTime } from "@/lib/time";
import { famTint, initials } from "@/lib/glassTint";
import { SoundLink } from "./glass/SoundLink";
import { FamilyShare } from "./FamilyShare";

/** A family: brothers and sisters sharing hours, or one student. */
export type Family = {
  key: string;
  name: string;
  students: Student[];
  account?: AccountMoney;
  slot: number;
  /** The family page: its link (if made) and whether the parent has opened it. */
  page?: { accountId: string; token: string | null; opened: boolean };
};

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

  const t = famTint(f.slot);
  const mode = [first.mode === "onsite" ? `Onsite${first.place ? ` · ${first.place}` : ""}` : preply ? "Preply" : first.mode === "online" ? "Google Meet" : null, f.students.length > 1 ? "share hours" : null]
    .filter(Boolean)
    .join(" · ");
  const names = f.students.map((s) => s.first_name).join(" & ");

  return (
    <article
      data-kind={pk ? "pkg" : "per"}
      className="glass lift relative flex flex-col gap-4 rounded-[26px] p-[22px]"
      style={soon ? { borderColor: "rgba(251,191,36,0.5)" } : undefined}
    >
      {/* The whole card opens the (first) student */}
      <SoundLink href={`/students/${first.id}`} sound="open" className="absolute inset-0 rounded-[26px]" aria-label={`Open ${names}`} />

      {/* Who */}
      <div className="pointer-events-none relative flex items-center gap-3.5">
        <span className="flex shrink-0">
          {f.students.slice(0, 3).map((s, i) => (
            <span
              key={s.id}
              aria-hidden
              className={`grid h-[52px] w-[52px] place-items-center rounded-full border-2 text-base font-bold ${i ? "-ml-3" : ""}`}
              style={{ background: t.bg, color: t.text, borderColor: "color-mix(in srgb, var(--th-bg), #ffffff 6%)" }}
            >
              {initials(s.first_name)}
            </span>
          ))}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-baseline gap-x-2">
            {f.students.length > 1 ? (
              f.students.map((s, i) => (
                <span key={s.id} className="font-display text-[22px] font-semibold">
                  <SoundLink href={`/students/${s.id}`} sound="open" className="pointer-events-auto relative hover:text-accent">
                    {s.first_name}
                  </SoundLink>
                  {i < f.students.length - 1 ? <span className="text-[var(--th-text-3)]"> &</span> : null}
                </span>
              ))
            ) : (
              <span className="font-display text-[22px] font-semibold">{first.first_name}</span>
            )}
            {f.students.length === 1 && first.level ? <span className="text-[var(--th-text-3)]">{first.level}</span> : null}
          </span>
          <span className="mt-1 flex flex-wrap items-center gap-2">
            <span aria-hidden className="h-[9px] w-[9px] rounded-full" style={{ background: t.colour }} />
            {mode ? <span className="tag">{mode}</span> : null}
            {soon ? <span className="pill todo !py-0.5">renew soon</span> : null}
          </span>
        </span>
      </div>

      {/* Money: package or price per class */}
      {pk && cur ? (
        <div className="pointer-events-none relative flex flex-col gap-2.5 rounded-[18px] border border-white/[0.08] bg-black/20 p-4">
          <div className="flex items-baseline justify-between gap-2.5">
            <span>
              <strong className="text-[17px] tabular-nums">{fmtHours(curLeft)}</strong> <span className="text-[var(--th-text-3)]">left of {cur.hours} h</span>
            </span>
            {cur.price != null ? <span className="text-sm tabular-nums text-[var(--th-text-2)]">{thb(cur.price)} package</span> : null}
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-white/[0.08]" role="progressbar" aria-label="Hours used" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
            <div
              className="h-full rounded-full"
              style={{ width: `${pct}%`, background: soon ? "var(--th-todo)" : t.colour, boxShadow: `0 0 14px color-mix(in srgb, ${soon ? "var(--th-todo)" : t.colour} 60%, transparent)` }}
            />
          </div>
          <p className="text-sm text-[var(--th-text-2)]">
            {upNext ? (
              <>
                Then the next package: <span className="text-[var(--th-text)]">{upNext.hours} h{upNext.price != null ? ` · ${thb(upNext.price)}` : ""}</span>
                {" · "}
              </>
            ) : null}
            {pk.forecast.endDate ? (
              <>
                All hours run out around <span className="text-[var(--th-text)]">{fmtDay(pk.forecast.endDate)}</span>
                {days != null && days >= 0 ? ` (${days < 14 ? `${days} ${days === 1 ? "day" : "days"}` : `${Math.round(days / 7)} weeks`})` : ""}
              </>
            ) : (
              "No lessons booked to estimate the end date"
            )}
          </p>
        </div>
      ) : (
        <div className="pointer-events-none relative flex justify-between gap-2.5 rounded-[18px] border border-white/[0.08] bg-black/20 p-4">
          <span className="text-[var(--th-text-3)]">Pays per class</span>
          <span className="font-semibold tabular-nums">{taught.length ? `${taught.length} this month${value ? ` · ${thb(value)}` : ""}` : "none this month yet"}</span>
        </div>
      )}

      {/* Next lesson */}
      <div className="pointer-events-none relative mt-auto flex items-center justify-between gap-2.5">
        {next ? (
          <SoundLink href={`/lessons/${next.id}`} sound="open" className="pointer-events-auto min-w-0 hover:text-accent">
            <span className="text-[var(--th-text-3)]">Next: </span>
            <strong className="font-semibold">
              {bkkDateKey(next.start_at) === today ? "Today" : fmtDay(bkkDateKey(next.start_at))} · {fmtTime(next.start_at)}
            </strong>
          </SoundLink>
        ) : (
          <span className="text-[var(--th-text-3)]">No lesson in the next 4 weeks</span>
        )}
        {r ? (
          <span className="inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold" style={{ color: r.ready ? "var(--th-ready-text)" : "var(--th-todo-text)" }} title={r.text}>
            <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: r.ready ? "var(--th-ready)" : "var(--th-todo)" }} />
            {r.ready ? "ready" : r.need === "slides" ? "slides to do" : "print worksheet"}
          </span>
        ) : null}
      </div>

      {f.page ? (
        <FamilyShare
          accountId={f.page.accountId}
          names={f.students.map((s) => s.first_name).join(" & ")}
          parentName={first.parent_name}
          contactApp={first.contact_app}
          contact={first.contact}
          initialToken={f.page.token}
          opened={f.page.opened}
        />
      ) : null}
    </article>
  );
}
