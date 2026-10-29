import Link from "next/link";
import { requireSignedIn } from "@/lib/auth";
import { syncIfStale } from "@/lib/calendar/sync";
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
  await syncIfStale();
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
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted">
            {fmtDay(monday)} – {fmtDay(addDays(monday, 6))}
          </p>
          <h1 className="h1">{me.role === "tutor" ? "Family view" : "Ken's schedule"}</h1>
          {me.role === "tutor" ? (
            <p className="mt-1 text-sm text-muted">This is exactly what your family member sees.</p>
          ) : null}
        </div>
        <RefreshButton />
      </header>
      <div className="flex gap-2">
        <Link className="btn-secondary flex-1" href={`/schedule?start=${addDays(monday, -7)}`}>
          ‹ Previous
        </Link>
        <Link className="btn-secondary flex-1" href="/schedule">
          This week
        </Link>
        <Link className="btn-secondary flex-1" href={`/schedule?start=${addDays(monday, 7)}`}>
          Next ›
        </Link>
      </div>
      {error ? <p className="rounded-xl bg-danger-soft p-3 text-sm text-danger">Couldn&apos;t load the schedule.</p> : null}

      {days.map((d) => {
        const dayRows = rows.filter((r) => bkkDateKey(r.start_at) === d);
        const free = freeBlocks(d, dayRows);
        const items = [
          ...dayRows.map((r) => ({ t: new Date(r.start_at).getTime(), kind: "lesson" as const, r })),
          ...free.map((f) => ({ t: f.from.getTime(), kind: "free" as const, f })),
        ].sort((a, b) => a.t - b.t);
        return (
          <section key={d} className="space-y-2">
            <h2 className={`text-sm font-medium ${d === today ? "text-accent" : "text-muted"}`}>
              {fmtDay(d)} {d === today ? "· Today" : ""}
            </h2>
            {dayRows.length === 0 ? (
              <p className="rounded-xl border border-dashed border-line px-4 py-3 text-sm text-muted">Free all day — no lessons</p>
            ) : (
              items.map((it) =>
                it.kind === "lesson" ? (
                  <div key={it.r.lesson_id} className="card flex items-center gap-4">
                    <div className="w-24 shrink-0 text-sm font-semibold tabular-nums">
                      {fmtTime(it.r.start_at)}–{fmtTime(it.r.end_at)}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate font-medium">{it.r.students}</div>
                      <div className="text-sm text-muted">
                        {it.r.is_preply ? "Preply (online)" : it.r.mode === "online" ? "Online (at home)" : it.r.mode === "onsite" ? `Onsite${it.r.place ? ` · ${it.r.place}` : ""}` : ""}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div key={`free-${it.t}`} className="rounded-xl border border-dashed border-line px-4 py-2 text-sm text-muted">
                    Free {fmtTime(it.f.from)}–{fmtTime(it.f.to)}
                  </div>
                ),
              )
            )}
          </section>
        );
      })}
      <p className="pb-4 text-xs text-muted">Free time is shown between 08:00 and 22:00.</p>
    </div>
  );
}
