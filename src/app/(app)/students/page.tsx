import Link from "next/link";
import { requireTutor } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getLessons, getMoneyData, getSettings, type Lesson, type Student } from "@/lib/data";
import { renewSoon } from "@/lib/earnings";
import { FamilyCard, firstNext, type Family } from "@/components/StudentCards";
import { FilterGroup } from "@/components/glass/Segmented";
import { SoundLink } from "@/components/glass/SoundLink";
import { loadReady } from "@/lib/readyData";
import { colourSlots } from "@/lib/studentColours";
import { addDays, bkkStartOfDay, todayKey } from "@/lib/time";

// 👥 Students, one card per family: who they are, their package (or price per class), and the next lesson.
// Brothers and sisters who share hours are one card. Colours match Week and Money.


export default async function StudentsPage() {
  await requireTutor();
  const today = todayKey();
  const [money, settings, coming] = await Promise.all([getMoneyData(), getSettings(), getLessons(new Date().toISOString(), bkkStartOfDay(addDays(today, 29)).toISOString())]);
  const students = money.students as unknown as Student[];
  const colours = colourSlots({ students, packages: money.packages, accountNames: new Map(money.accounts.map((a) => [a.id, a.name])) });
  const renewWeeks = Number((settings as { renew_weeks?: number }).renew_weeks ?? 2);
  const low = Number(settings.low_hours_threshold);

  // Each student's next lesson in the coming four weeks, and whether it's ready.
  const upcoming = coming.filter((l) => l.status === "scheduled" && l.lesson_students.length);
  const nextOf = new Map<string, Lesson>();
  for (const l of upcoming) for (const ls of l.lesson_students) if (!nextOf.has(ls.student_id)) nextOf.set(ls.student_id, l);
  const ready = await loadReady([...new Set(nextOf.values())], students);

  // Lessons taught this month (for per-class students).
  const monthStart = `${today.slice(0, 7)}-01`;
  const thisMonth = (ids: string[]) => money.lessons.filter((l) => l.date >= monthStart && l.studentIds.some((id) => ids.includes(id)));

  // Each family's private page: made yet, and opened by the parent? (database update 0015)
  const supabase = await createClient();
  const { data: pages } = await supabase.from("hour_accounts").select("id, family_token, family_consent_at");
  const pageOf = new Map(((pages ?? []) as { id: string; family_token: string | null; family_consent_at: string | null }[]).map((p) => [p.id, p]));

  const families: Family[] = [];
  for (const s of students) {
    const key = s.hour_account_id ?? `s:${s.id}`;
    let f = families.find((x) => x.key === key);
    if (!f) {
      const account = money.accounts.find((a) => a.id === s.hour_account_id);
      const pg = s.hour_account_id ? pageOf.get(s.hour_account_id) : undefined;
      families.push(
        (f = {
          key,
          name: account?.name ?? s.first_name,
          students: [],
          account,
          slot: colours.slotOfStudent(s.id),
          page: s.hour_account_id ? { accountId: s.hour_account_id, token: pg?.family_token ?? null, opened: Boolean(pg?.family_consent_at) } : undefined,
        }),
      );
    }
    f.students.push(s);
  }
  const active = families.filter((f) => f.students.some((s) => s.active));
  const paused = families.filter((f) => !f.students.some((s) => s.active));
  const soon = (f: Family) => (f.account && f.account.packages.length ? renewSoon(f.account, today, low, renewWeeks) : false);
  active.sort((a, b) => Number(soon(b)) - Number(soon(a)) || Number(!!b.account?.packages.length) - Number(!!a.account?.packages.length) || a.name.localeCompare(b.name));

  const activeStudents = students.filter((s) => s.active);
  const withPackages = active.filter((f) => f.account?.packages.length).length;
  const renewing = active.filter(soon).length;

  return (
    <div className="flex flex-col gap-6">
      <FilterGroup
        label="Show"
        options={[
          { value: "all", label: "All" },
          { value: "pkg", label: "Packages" },
          { value: "per", label: "Per class" },
        ]}
        title={
          <div>
            <h1 className="font-display text-[36px] font-semibold leading-tight sm:text-[44px]">Students</h1>
            <p className="mt-1.5 text-base text-[var(--th-text-3)]">
              {activeStudents.length} {activeStudents.length === 1 ? "student" : "students"} · {active.length} {active.length === 1 ? "family" : "families"} · {withPackages} on packages,{" "}
              {active.length - withPackages} per class
              {renewing ? (
                <>
                  {" "}
                  · <span className="text-[var(--th-todo-text)]">{renewing} to renew soon</span>
                </>
              ) : null}
            </p>
          </div>
        }
        action={
          <SoundLink href="/students/new" sound="tap" className="btn-mint !h-12 !rounded-[15px] !px-5 !text-base">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
              <path d="M12 5v14M5 12h14" />
            </svg>
            Add
          </SoundLink>
        }
        className="grid gap-[18px] [grid-template-columns:repeat(auto-fill,minmax(min(100%,340px),1fr))]"
      >
        {active.map((f) => (
          <FamilyCard key={f.key} f={f} today={today} soon={soon(f)} next={firstNext(f, nextOf)} ready={ready} taught={thisMonth(f.students.map((s) => s.id))} />
        ))}
      </FilterGroup>

      {students.length === 0 ? <div className="card text-muted">No students yet. Add your first student — their first name is used to find their lessons in your calendar.</div> : null}

      {paused.length ? (
        <section className="space-y-2">
          <h2 className="px-1.5 text-sm font-medium text-[var(--th-text-3)]">Paused</h2>
          <div className="flex flex-wrap gap-2">
            {paused.flatMap((f) =>
              f.students.map((s) => (
                <Link key={s.id} href={`/students/${s.id}`} className="tag press">
                  {s.first_name}
                </Link>
              )),
            )}
          </div>
        </section>
      ) : null}
    </div>
  );
}
