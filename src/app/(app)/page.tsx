import { CalendarCatchUp } from "@/components/CalendarCatchUp";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getLessons, getMoneyData, getReminderLessons, getSettings, getStudents, isUnmarked, needsFeedback, needsNote, REMINDER_DAYS, reminderSince, type Lesson } from "@/lib/data";
import { renewSoon, sumEarned } from "@/lib/earnings";
import { addDays, bkkDateKey, bkkStartOfDay, fmtDay, fmtHours, fmtLongDay, fmtTime, mondayOf, nowMs, todayKey, TZ } from "@/lib/time";
import { RefreshButton } from "@/components/RefreshButton";
import { linkEventToStudent, setIgnored } from "@/app/actions/calendar";
import { eventName } from "@/lib/calendar/match";
import { backupIfDue } from "@/lib/backup";
import { after } from "next/server";
import { loadPrep } from "@/lib/prepData";
import { loadReady } from "@/lib/readyData";
import { Hero, JustDone, MonthPanel, TodayTimeline, TodoPanel, WeekList } from "@/components/home/Dashboard";
import { tutorName } from "@/lib/env";
import { FamilyInbox, type InboxFamily } from "@/components/home/FamilyInbox";
import { colourSlots } from "@/lib/studentColours";

export default async function Home() {
  const me = await getMe();
  if (me?.role !== "tutor") redirect("/schedule");

  after(() => backupIfDue().catch(() => {})); // weekly backup, after the page is sent
  const today = todayKey();
  const now = nowMs();
  const weekEnd = addDays(mondayOf(today), 7);
  const comingEnd = addDays(today, 8); // "Coming up": the next 7 days after today
  const loadTo = comingEnd > weekEnd ? comingEnd : weekEnd;
  const [lessons, settings, money, students, recent] = await Promise.all([
    getLessons(bkkStartOfDay(addDays(today, -14)).toISOString(), bkkStartOfDay(loadTo).toISOString()),
    getSettings(),
    getMoneyData(),
    getStudents({ activeOnly: true }),
    getReminderLessons(addDays(today, -REMINDER_DAYS)), // narrowed to the tracking date below
  ]);

  const matched = lessons.filter((l) => l.lesson_students.length > 0);
  const todays = matched.filter((l) => bkkDateKey(l.start_at) === today);
  const rest = matched.filter((l) => bkkDateKey(l.start_at) > today && bkkDateKey(l.start_at) < comingEnd);
  // Reminders: from Settings' "start tracking from" date, at most 60 days back (the same on Week and Money).
  const trackFrom = settings.track_from ?? "0000-01-01";
  const since = reminderSince(settings.track_from, today);
  const missing = recent.filter((l) => needsNote(l, since));
  const unmarked = recent.filter((l) => isUnmarked(l, now, since));
  const unsent = recent.filter((l) => needsFeedback(l, today, bkkDateKey, since));
  const lowHours = Number(settings.low_hours_threshold ?? 2);
  const renewWeeks = Number(settings.renew_weeks ?? 2);
  const low = money.accounts.filter((a) => renewSoon(a, today, lowHours, renewWeeks));
  const unmatched = lessons.filter(
    (l) => l.lesson_students.length === 0 && bkkDateKey(l.start_at) >= (trackFrom > addDays(today, -14) ? trackFrom : addDays(today, -14)),
  );
  const unpaid = money.packages.filter((p) => !p.paid_on && p.price_thb != null && Number(p.price_thb) > 0);
  const accountName = new Map(money.accounts.map((a) => [a.id, a.name]));

  // ✅ Before class (today's lessons) and ready or not (every lesson still to come in the next 7 days).
  const [prep, ready] = await Promise.all([
    loadPrep(
      todays,
      students,
      money.accounts.map((a) => ({ studentIds: a.studentIds, leftHours: a.leftHours, low: renewSoon(a, today, lowHours, renewWeeks) })),
    ),
    loadReady([...todays, ...rest], students),
  ]);
  // In To do: lessons in the next 2 days that aren't ready yet.
  const soon = [...todays, ...rest].filter((l) => ready.get(l.id) && !ready.get(l.id)!.ready && Date.parse(l.start_at) < now + 2 * 86_400_000);

  // The header: teaching now, or the next lesson (today or later this week).
  const live = todays.filter((l) => !l.status.startsWith("cancelled"));
  const current = live.find((l) => Date.parse(l.start_at) <= now && Date.parse(l.end_at) > now) ?? null;
  const next = [...live, ...rest.filter((l) => !l.status.startsWith("cancelled"))].find((l) => Date.parse(l.start_at) > now) ?? null;
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "numeric", hourCycle: "h23" }).format(new Date(now)));
  const greeting = `${hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening"}, ${tutorName().replace(/ /g, "\u00a0")}`;

  const byDay = new Map<string, Lesson[]>();
  for (const l of rest) {
    const k = bkkDateKey(l.start_at);
    byDay.set(k, [...(byDay.get(k) ?? []), l]);
  }
  const monthStart = `${today.slice(0, 7)}-01`;
  const nextMonth = new Date(Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)), 1)).toISOString().slice(0, 10);
  const month = sumEarned(money.lessons, monthStart, nextMonth);
  // Family colours, the same as on Week, Students and Money.
  const colours = colourSlots({ students, packages: money.packages, accountNames: accountName });
  const slotOf = (l: Lesson) => (l.lesson_students[0] ? colours.slotOfStudent(l.lesson_students[0].student_id) : 8);
  const shown = current ?? next;
  const family = await familyActivity(students);
  // 📸 Just finished: a big button to add the worksheet photo and send the update (fewest taps on the phone).
  const justDone = matched
    .filter((l) => {
      const end = Date.parse(l.end_at);
      return end <= now && end > now - 12 * 3_600_000 && !l.sent_at && !l.feedback_skipped && !l.status.startsWith("cancelled");
    })
    .sort((a, b) => b.end_at.localeCompare(a.end_at))
    .slice(0, 3)
    .map((l) => ({ id: l.id, names: l.lesson_students.map((ls) => ls.students?.first_name).filter(Boolean).join(" & ") || "Lesson", end: fmtTime(l.end_at) }));
  const weekCount = matched.filter((l) => bkkDateKey(l.start_at) >= mondayOf(today) && bkkDateKey(l.start_at) < addDays(mondayOf(today), 7) && !l.status.startsWith("cancelled")).length;

  return (
    <div className="flex flex-col gap-6">
      <CalendarCatchUp />
      <Hero
        dateLine={fmtLongDay(today)}
        greeting={greeting}
        now={now}
        current={current}
        next={next}
        slot={shown ? slotOf(shown) : 8}
        ready={shown ? ready.get(shown.id) : undefined}
        refresh={settings.calendar_connected ? <RefreshButton /> : null}
        problem={
          !settings.calendar_connected ? (
            <div className="glass rounded-2xl p-4">
              <p className="font-medium">Connect your Google Calendar to see your lessons.</p>
              <p className="mt-1 text-sm text-muted">It takes about 2 minutes. Then add your students so lessons match.</p>
              <Link href="/settings#calendar" className="btn-primary mt-3">
                Connect calendar
              </Link>
            </div>
          ) : settings.last_sync_error ? (
            <p className="rounded-xl bg-danger-soft p-3 text-sm text-danger">{settings.last_sync_error}</p>
          ) : null
        }
      />

      <JustDone lessons={justDone} />

      <FamilyInbox families={family.inbox} />

      {/* Three glass cards side by side on a laptop, one under another on a phone */}
      <div className="grid gap-5 [grid-template-columns:repeat(auto-fit,minmax(300px,1fr))]">
        <TodayTimeline lessons={todays} now={now} prep={prep} ready={ready} />
        <MonthPanel
          month={new Intl.DateTimeFormat("en-GB", { month: "long", timeZone: "UTC" }).format(new Date(`${monthStart}T00:00:00Z`))}
          earned={month.value}
          classes={month.classes}
          hours={month.hours}
          week={weekCount}
        />
        <TodoPanel
          notes={missing}
          unmarked={unmarked}
          feedback={unsent}
          getReady={soon.map((l) => ({ lesson: l, r: ready.get(l.id)! }))}
          renew={low.map((a) => ({
            id: a.id,
            href: a.studentIds[0] ? `/students/${a.studentIds[0]}#hours` : "/students",
            text: `${a.name}, ${a.leftHours > 0 ? `${fmtHours(a.leftHours)} left` : "hours used up"}${a.leftHours > 0 && a.forecast.endDate ? `, until about ${fmtDay(a.forecast.endDate)}` : ""}`,
            danger: a.leftHours <= 0,
          }))}
          unpaid={unpaid.map((p) => ({ id: p.id, href: "/money#unpaid", text: `${accountName.get(p.hour_account_id) ?? "Package"}, ฿${Math.round(Number(p.price_thb)).toLocaleString("en-US")}` }))}
          link={unmatched.length ? <UnmatchedEvents events={unmatched} students={students} /> : null}
          linkCount={unmatched.length}
          seen={family.seen}
        />
      </div>

      <WeekList days={[...byDay.entries()]} ready={ready} slotOf={slotOf} />
    </div>
  );
}

/** Calendar events that aren't linked to a student yet: link one, or hide it. */
function UnmatchedEvents({ events, students }: { events: Lesson[]; students: { id: string; first_name: string }[] }) {
  return (
    <div className="py-3 first:pt-1 last:pb-1">
      <h3 className="px-2 font-semibold">
        Calendar events to link <span className="ml-1 rounded-full bg-white/10 px-2 py-0.5 text-sm tabular-nums text-[var(--th-text-2)]">{events.length}</span>
      </h3>
      <div className="mt-2 space-y-2 px-2">
        {events.map((l) => (
          <div key={l.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
            <div className="text-sm">
              <span className="font-medium">{l.title || "Untitled event"}</span>
              <span className="text-muted">
                {" "}
                {fmtDay(bkkDateKey(l.start_at))} {fmtTime(l.start_at)}
              </span>
            </div>
            <form action={linkEventToStudent} className="mt-2 flex flex-wrap items-center gap-2">
              <input type="hidden" name="lesson_id" value={l.id} />
              <input type="hidden" name="keyword" value={eventName(l.title)} />
              <select name="student_id" className="input min-h-11 w-auto flex-1" required defaultValue="">
                <option value="" disabled>
                  Choose student…
                </option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.first_name}
                  </option>
                ))}
              </select>
              <button className="btn-secondary min-h-11">Link</button>
              {eventName(l.title) ? (
                <span className="w-full text-xs text-muted">Future events called “{eventName(l.title)}” will link to this student by themselves.</span>
              ) : null}
            </form>
            <form action={setIgnored} className="mt-1">
              <input type="hidden" name="lesson_id" value={l.id} />
              <input type="hidden" name="ignored" value="true" />
              <button className="btn-quiet min-h-9 px-0 text-sm text-muted">Not a lesson, hide it{eventName(l.title) ? " (and others like it)" : ""}</button>
            </form>
          </div>
        ))}
        <p className="text-xs text-muted">Preply names events after the account owner, often the parent (e.g. “Chloe L.” for Yina).</p>
      </div>
    </div>
  );
}


/** 💬 New messages from families, and families who opened their page in the last 2 days (none before update 0028). */
async function familyActivity(students: { id: string; first_name: string; hour_account_id: string | null; parent_name: string | null; active: boolean }[]) {
  const supabase = await createClient();
  const [{ data: notes }, { data: seenRows }] = await Promise.all([
    supabase.from("family_notes").select("id, hour_account_id, body, created_at, lesson_id").eq("author", "parent").is("read_at", null).order("created_at", { ascending: false }).limit(20),
    supabase.from("hour_accounts").select("id, family_seen_at").gte("family_seen_at", new Date(Date.now() - 2 * 86_400_000).toISOString()).order("family_seen_at", { ascending: false }).limit(6),
  ]);
  const kids = (id: string) => students.filter((s) => s.hour_account_id === id).sort((a, b) => Number(b.active) - Number(a.active));
  const who = (id: string) => {
    const k = kids(id);
    return k.map((s) => s.parent_name?.trim()).find(Boolean) ?? `${k.filter((s) => s.active).map((s) => s.first_name).join(" & ") || "A"}'s family`;
  };
  const href = (id: string) => (kids(id)[0] ? `/students/${kids(id)[0].id}#messages` : "/students");
  const ago = (iso: string) => {
    const m = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
    return m < 2 ? "just now" : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : "yesterday";
  };
  const rows = ((notes ?? []) as { id: string; hour_account_id: string; body: string; created_at: string; lesson_id: string | null }[]).reverse();
  const lessonIds = [...new Set(rows.map((n) => n.lesson_id).filter(Boolean) as string[])];
  const { data: lessonRows } = lessonIds.length ? await supabase.from("lessons").select("id, start_at").in("id", lessonIds) : { data: [] };
  const lessonDay = new Map(((lessonRows ?? []) as { id: string; start_at: string }[]).map((l) => [l.id, fmtDay(bkkDateKey(l.start_at))]));
  const when = (iso: string) => new Intl.DateTimeFormat("en-GB", { timeZone: TZ, weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));
  const byFamily = new Map<string, InboxFamily>();
  for (const n of rows) {
    const id = n.hour_account_id;
    if (!byFamily.has(id)) byFamily.set(id, { accountId: id, who: who(id), kids: kids(id).filter((s) => s.active).map((s) => s.first_name).join(" & ") || kids(id).map((s) => s.first_name).join(" & "), href: href(id), notes: [] });
    byFamily.get(id)!.notes.push({ id: n.id, body: n.body, when: when(n.created_at), lesson: n.lesson_id ? (lessonDay.get(n.lesson_id) ?? null) : null });
  }
  // Newest conversation first.
  const inbox = [...byFamily.values()].reverse();
  const seen = ((seenRows ?? []) as { id: string; family_seen_at: string }[]).map((a) => ({
    id: a.id,
    href: href(a.id),
    text: `${who(a.id)} opened the family page ${ago(a.family_seen_at)}`,
  }));
  return { inbox, seen };
}
