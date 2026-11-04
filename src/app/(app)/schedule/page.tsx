import { CalendarCatchUp } from "@/components/CalendarCatchUp";
import { SoundLink } from "@/components/glass/SoundLink";
import { requireSignedIn } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { addDays, bkkDateKey, bkkStartOfDay, fmtDay, fmtTime, mondayOf, todayKey } from "@/lib/time";
import { RefreshButton } from "@/components/RefreshButton";

type Row = {
  lesson_id: string;
  start_at: string;
  end_at: string;
  students: string;
  mode: "onsite" | "online" | null;
  place: string | null;
  is_preply: boolean;
};

const DAY_START_H = 8;
const DAY_END_H = 22;

function freeBlocks(day: string, rows: Row[]): { from: Date; to: Date }[] {
  const start = new Date(bkkStartOfDay(day).getTime() + DAY_START_H * 3_600_000);
  const end = new Date(bkkStartOfDay(day).getTime() + DAY_END_H * 3_600_000);
  const out: { from: Date; to: Date }[] = [];
  let cursor = start;
  for (const r of rows) {
    const s = new Date(r.start_at);
    const e = new Date(r.end_at);
    if (s.getTime() - cursor.getTime() >= 45 * 60_000 && s > start) out.push({ from: cursor, to: s < end ? s : end });
    if (e > cursor) cursor = e;
  }
  if (end.getTime() - cursor.getTime() >= 45 * 60_000) out.push({ from: cursor, to: end });
  return out;
}

export default async function SchedulePage({ searchParams }: PageProps<"/schedule">) {
  const me = await requireSignedIn();
  const { start } = await searchParams;
  const monday = mondayOf(typeof start === "string" && /^\d{4}-\d{2}-\d{2}$/.test(start) ? start : todayKey());

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("viewer_schedule", {
    p_from: bkkStartOfDay(monday).toISOString(),
    p_to: bkkStartOfDay(addDays(monday, 7)).toISOString(),
  });
  const rows = (data ?? []) as Row[];
  const today = todayKey();
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));

  return (
    <div className="flex flex-col gap-5">
      <CalendarCatchUp />
      <header className="flex flex-wrap items-end justify-between gap-4 px-1.5 pt-1">
        <div>
          <p className="text-base text-[var(--th-text-3)]">
            {fmtDay(monday)} – {fmtDay(addDays(monday, 6))}
          </p>
          <h1 className="font-display text-[36px] font-semibold leading-tight sm:text-[44px]">{me.role === "tutor" ? "Family view" : "Ken's schedule"}</h1>
          {me.role === "tutor" ? <p className="mt-1 text-sm text-[var(--th-text-3)]">This is exactly what your family member sees.</p> : null}
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <nav aria-label="Weeks" className="glass flex gap-0.5 rounded-[15px] p-0.5">
            <SoundLink sound="flip" className="seg press" href={`/schedule?start=${addDays(monday, -7)}`} aria-label="Previous week">
              ‹ Prev
            </SoundLink>
            <SoundLink sound="flip" className={`seg press ${monday === mondayOf(today) ? "font-semibold text-accent" : ""}`} href="/schedule">
              This week
            </SoundLink>
            <SoundLink sound="flip" className="seg press" href={`/schedule?start=${addDays(monday, 7)}`} aria-label="Next week">
              Next ›
            </SoundLink>
          </nav>
          <RefreshButton />
        </div>
      </header>
      {error ? <p className="rounded-xl bg-danger-soft p-3 text-sm text-danger">Couldn&apos;t load the schedule.</p> : null}

      {days.map((d) => {
        const dayRows = rows.filter((r) => bkkDateKey(r.start_at) === d);
        const free = freeBlocks(d, dayRows);
        const items = [
          ...dayRows.map((r) => ({ t: new Date(r.start_at).getTime(), kind: "lesson" as const, r })),
          ...free.map((f) => ({ t: f.from.getTime(), kind: "free" as const, f })),
        ].sort((a, b) => a.t - b.t);
        return (
          <section
            key={d}
            className="glass space-y-2 rounded-[24px] p-4 sm:p-5"
            style={d === today ? { borderColor: "var(--th-accent-line)", background: "color-mix(in srgb, var(--th-accent) 7%, transparent)" } : undefined}
          >
            <h2 className={`font-display px-1 text-lg font-semibold ${d === today ? "text-accent" : ""}`}>
              {fmtDay(d)} {d === today ? <span className="pill ml-1 align-middle !py-0.5 text-accent" style={{ borderColor: "var(--th-accent-line)" }}>Today</span> : null}
            </h2>
            {dayRows.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-white/15 px-4 py-3 text-sm text-[var(--th-text-3)]">Free all day — no lessons</p>
            ) : (
              items.map((it) =>
                it.kind === "lesson" ? (
                  <div key={it.r.lesson_id} className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3">
                    <div className="w-28 shrink-0 font-semibold tabular-nums text-accent">
                      {fmtTime(it.r.start_at)}–{fmtTime(it.r.end_at)}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-base font-semibold">{it.r.students}</div>
                      <div className="text-sm text-muted">
                        {it.r.is_preply ? "Preply (online)" : it.r.mode === "online" ? "Online (at home)" : it.r.mode === "onsite" ? `Onsite${it.r.place ? ` · ${it.r.place}` : ""}` : ""}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div key={`free-${it.t}`} className="rounded-2xl border border-dashed border-white/15 px-4 py-2 text-sm text-[var(--th-text-3)]">
                    Free {fmtTime(it.f.from)}–{fmtTime(it.f.to)}
                  </div>
                ),
              )
            )}
          </section>
        );
      })}
      <p className="px-1.5 pb-4 text-xs text-muted">Free time is shown between 08:00 and 22:00.</p>
    </div>
  );
}
