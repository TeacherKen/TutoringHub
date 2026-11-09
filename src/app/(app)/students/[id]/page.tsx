import Link from "next/link";
import { ConfirmButton } from "@/components/ConfirmButton";
import { notFound } from "next/navigation";
import { requireTutor } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getAccountSummaries, getMoneyData, getProgress, getSettings, getStudents, getTimesTables, type Lesson } from "@/lib/data";
import { TimesTablesCard } from "@/components/TimesTablesCard";
import { WorksheetPhotos } from "@/components/WorksheetPhotos";
import { cleanMode, cleanTables } from "@/lib/facts";
import { renewSoon, thb as baht } from "@/lib/earnings";
import { TopicProgress } from "@/components/TopicProgress";
import { MonthlyReport } from "@/components/MonthlyReport";
import { groupByMonth } from "@/lib/monthlyReport";
import { progressLine } from "@/lib/progress";
import { aiAvailable } from "@/lib/ai";
import { lessonLength } from "@/lib/hours";
import { bkkDateKey, fmtDate, fmtDay, fmtHours, fmtTime, isPast, todayKey } from "@/lib/time";
import { StudentForm } from "@/components/StudentForm";
import { RoomControls } from "@/components/RoomControls";
import { Avatar } from "@/components/home/Dashboard";
import { SoundLink } from "@/components/glass/SoundLink";
import { famTint } from "@/lib/glassTint";
import { colourSlots } from "@/lib/studentColours";
import { RenewalMessage } from "@/components/RenewalMessage";
import { FamilyLink } from "@/components/FamilyLink";
import { FamilyLinkProvider } from "@/components/FamilyLinkContext";
import { NoteForm, NoteThread } from "@/components/FamilyNotes";
import { MarkNotesRead } from "@/components/MarkNotesRead";
import { Fold } from "@/components/glass/Fold";
import { cleanPriceOptions } from "@/lib/prices";
import { tutorName } from "@/lib/env";
import { roomStudent } from "@/lib/roomStudent";
import { AdjustmentForm, PackageForm } from "@/components/HoursForms";
import { deleteAdjustment, deletePackage, deleteStudent, markPackagePaid, setHourSharing, updateStudent } from "@/app/actions/students";

const PAID_BY: Record<string, string> = { bank_transfer: "Bank transfer", promptpay: "PromptPay", cash: "Cash", preply: "Preply", other: "Other" };
const CONTACT: Record<string, string> = { whatsapp: "WhatsApp", line: "LINE", wechat: "WeChat", other: "Contact" };
const fmtSeen = (iso: string) => {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 2) return "just now";
  if (mins < 60) return `${mins} min ago`;
  if (mins < 24 * 60) return `${Math.round(mins / 60)} h ago`;
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Bangkok", day: "numeric", month: "short" }).format(new Date(iso));
};
const thb = (n: number) => `฿${Number(n).toLocaleString("en-US")}`;

export default async function StudentPage({ params }: PageProps<"/students/[id]">) {
  const [, { id }, supabase] = await Promise.all([requireTutor(), params, createClient()]);
  // Two waits instead of seven: everything that only needs the student's id first...
  const [students, settings, progress, money, tt, { data: links }, { data: recent }] = await Promise.all([
    getStudents(),
    getSettings(),
    getProgress([id]),
    getMoneyData(),
    getTimesTables(id),
    supabase
      .from("lesson_students")
      .select("lessons(id, start_at, end_at, status, length_hours, learned, next_time, homework, topics, how_it_went, ignored, in_calendar, sent_at)")
      .eq("student_id", id),
    supabase.from("lessons").select("topics").neq("topics", "{}").order("start_at", { ascending: false }).limit(80),
  ]);
  const student = students.find((s) => s.id === id);
  if (!student) notFound();
  // ...then everything about the student's family (hours account) at once.
  const acctId = student.hour_account_id;
  const [summaries, { data: noteRows }, { data: seenRow }] = acctId
    ? await Promise.all([
        getAccountSummaries(acctId),
        supabase.from("family_notes").select("id, lesson_id, author, body, created_at, read_at").eq("hour_account_id", acctId).order("created_at", { ascending: false }).limit(40),
        supabase.from("hour_accounts").select("family_seen_at, family_token").eq("id", acctId).maybeSingle(),
      ])
    : [[], { data: null }, { data: null }];
  const account = summaries[0];
  const lessons = ((links ?? []).map((l) => l.lessons) as unknown as Lesson[])
    .filter((l) => l && !l.ignored && (l.in_calendar || l.status !== "scheduled"))
    .sort((a, b) => b.start_at.localeCompare(a.start_at));
  const past = lessons.filter((l) => isPast(l.start_at));
  const upcoming = lessons.filter((l) => !isPast(l.start_at)).reverse();
  const latestPlan = past.find((l) => l.next_time)?.next_time;
  const others = students.filter((s) => s.id !== id && s.active);
  const sharingWith = account?.students.filter((s) => s.id !== id) ?? [];
  const bal = account?.balance;
  // 💬 Messages with this family (none before database update 0028), and when they last opened their page.
  const notes = ((noteRows ?? []) as { id: string; lesson_id: string | null; author: "parent" | "tutor"; body: string; created_at: string; read_at: string | null }[])
    .reverse()
    .map((n) => ({ id: n.id, lessonId: n.lesson_id, author: n.author, body: n.body, created_at: n.created_at, unread: n.author === "parent" && !n.read_at }));
  const unreadNotes = notes.filter((n) => n.unread).length;
  const familySeen = (seenRow as { family_seen_at?: string | null } | null)?.family_seen_at ?? null;
  const topicIdeas = [...new Set((recent ?? []).flatMap((r) => r.topics as string[]))].slice(0, 40);
  const monthOf = (iso: string) => bkkDateKey(iso).slice(0, 7);
  const months = groupByMonth(
    past
      .filter((l) => l.status === "done")
      .map((l) => ({
        month: monthOf(l.start_at),
        monthLabel: new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "Asia/Bangkok" }).format(new Date(l.start_at)),
        date: fmtDay(bkkDateKey(l.start_at)),
        learned: l.learned,
        topics: l.topics ?? [],
        how: l.how_it_went,
        homework: l.homework,
      })),
  );
  const acctMoney = money.accounts.find((a) => a.id === student.hour_account_id);
  const familyToken = account ? ((seenRow as { family_token?: string | null } | null)?.family_token ?? null) : null;
  const curPkg = acctMoney?.packages.find((p) => p.state === "current");
  const low = bal && account.packages.length > 0 && (bal.left <= Number(settings.low_hours_threshold ?? 2) || (acctMoney ? renewSoon(acctMoney, money.today, Number(settings.low_hours_threshold ?? 2), Number(settings.renew_weeks ?? 2)) : false));

  // The family colour (the same on every page), brothers and sisters, and the hours for the header.
  const colours = colourSlots({ students, packages: money.packages, accountNames: new Map(money.accounts.map((a) => [a.id, a.name])) });
  const slot = colours.slotOfStudent(student.id);
  const tint = famTint(slot);
  const family = [student, ...sharingWith.map((s) => students.find((x) => x.id === s.id)).filter((x): x is typeof student => !!x)].slice(0, 3);
  const heroHours = curPkg && curPkg.hours ? { left: Math.max(0, curPkg.hours - curPkg.usedHours), of: curPkg.hours, pct: Math.min(100, Math.round((curPkg.usedHours / curPkg.hours) * 100)) } : null;

  const page = (
    <div className="flex flex-col gap-5">
      <SoundLink href="/students" sound="nav" className="inline-flex min-h-11 items-center gap-1 self-start px-1.5 font-medium text-accent">
        ‹ Students
      </SoundLink>
      <header className="glass-hi relative -mt-3 overflow-hidden rounded-[30px] px-6 py-6 sm:px-8 sm:py-7">
        <div aria-hidden className="glass-grid" />
        <div className="relative flex flex-wrap items-center gap-5">
          <span className="flex shrink-0">
            {family.map((s, i) => (
              <span key={s.id} className={i ? "-ml-4" : ""} style={{ borderRadius: 999, boxShadow: "0 0 0 3px color-mix(in srgb, var(--th-bg), #ffffff 8%)" }}>
                <Avatar name={s.first_name} slot={slot} size={64} />
              </span>
            ))}
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-[34px] font-semibold leading-tight tracking-[-0.015em] sm:text-[44px]">
              {student.first_name}
              {student.level ? <span className="ml-3 align-middle text-lg font-normal text-[var(--th-text-3)]">{student.level}</span> : null}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="pill" style={{ background: tint.bg, borderColor: tint.line, color: tint.text }}>
                <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: tint.colour }} />
                {student.mode === "onsite" ? `Onsite${student.place ? ` · ${student.place}` : ""}` : student.source === "preply" ? "Preply" : "Google Meet"}
              </span>
              {sharingWith.length ? <span className="tag">shares hours with {sharingWith.map((s) => s.first_name).join(" & ")}</span> : null}
              {low ? <span className="pill todo">renew soon</span> : null}
              {!student.active ? <span className="tag">paused</span> : null}
            </div>
            {student.parent_name || student.contact ? (
              <p className="mt-2 text-sm text-[var(--th-text-3)]">
                Parent: {student.parent_name ?? "—"}
                {student.contact ? ` · ${CONTACT[student.contact_app ?? "other"]}: ${student.contact}` : ""}
              </p>
            ) : null}
          </div>
          {heroHours ? (
            <div className="w-full sm:w-64">
              <div className="flex items-baseline justify-between gap-2">
                <span>
                  <strong className="font-display text-2xl tabular-nums">{fmtHours(heroHours.left)}</strong>{" "}
                  <span className="text-[var(--th-text-3)]">left of {heroHours.of} h</span>
                </span>
              </div>
              <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-white/[0.08]" role="progressbar" aria-label="Hours used" aria-valuenow={heroHours.pct} aria-valuemin={0} aria-valuemax={100}>
                <div
                  className="h-full rounded-full"
                  style={{ width: `${heroHours.pct}%`, background: low ? "var(--th-todo)" : tint.colour, boxShadow: `0 0 14px color-mix(in srgb, ${low ? "var(--th-todo)" : tint.colour} 60%, transparent)` }}
                />
              </div>
              {acctMoney?.forecast.endDate && acctMoney.leftHours > 0 ? <p className="mt-1.5 text-sm text-[var(--th-text-3)]">runs out around {fmtDay(acctMoney.forecast.endDate)}</p> : null}
            </div>
          ) : null}
        </div>
      </header>

      <RoomControls students={[roomStudent(student)]} showGames={false} lessonId={past[0]?.id ?? null} />

      {latestPlan ? (
        <section className="glass rounded-[24px] p-5" style={{ borderColor: "var(--th-accent-line)", background: "color-mix(in srgb, var(--th-accent) 9%, transparent)" }}>
          <h2 className="text-xs font-semibold tracking-[0.16em] text-accent">NEXT TIME</h2>
          <p className="mt-2 whitespace-pre-wrap text-[17px] leading-relaxed">{latestPlan}</p>
        </section>
      ) : null}

      <TopicProgress studentId={student.id} rows={progress.byStudent.get(student.id) ?? []} ready={progress.ready} suggestions={topicIdeas} />

      <TimesTablesCard
        studentId={student.id}
        name={student.first_name}
        roomToken={student.room_token ?? null}
        initialTables={cleanTables(student.tt_tables ?? []).length ? cleanTables(student.tt_tables) : [2, 3, 4]}
        progress={tt.progress}
        sessions={tt.sessions}
        ready={tt.ready}
        stats={tt.stats}
        initialMode={cleanMode(student.tt_mode)}
        initialShowFamily={(student as { family_show_tables?: boolean | null }).family_show_tables !== false}
      />

      {past[0] ? (
        <section className="card space-y-2">
          <h2 className="font-medium">📸 Worksheet photos</h2>
          <p className="text-sm text-muted">
            Take photos of the printed worksheets {student.first_name} finished. They&apos;re saved with the lesson on {fmtDay(bkkDateKey(past[0].start_at))} and
            parents see them on the family page.
          </p>
          <WorksheetPhotos lessonId={past[0].id} label={`${student.first_name}'s worksheet`} />
        </section>
      ) : null}

      {student.private_notes || student.book ? (
        <section className="card space-y-2 text-sm">
          {student.book ? (
            <p>
              <span className="text-muted">Book: </span>
              {student.book}
            </p>
          ) : null}
          {student.private_notes ? <p className="whitespace-pre-wrap">{student.private_notes}</p> : null}
        </section>
      ) : null}

      {account ? (
        <FamilyLink
          accountId={account.id}
          names={account.students.map((x) => x.first_name).join(" & ")}
          parentName={student.parent_name}
          contactApp={student.contact_app}
          contact={student.contact}
          initialToken={familyToken}
        />
      ) : null}

      {account ? (
        <Fold
          id="messages"
          open={unreadNotes > 0}
          summary={
            <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="h2">💬 Messages</span>
              {unreadNotes ? <span className="chip-warn">{unreadNotes} new</span> : null}
              <span className="text-sm text-[var(--th-text-3)]">
                {familySeen ? `Family page last opened ${fmtSeen(familySeen)}` : "Family page not opened yet"}
              </span>
            </span>
          }
        >
          <div className="space-y-3 px-5 pb-5">
            <MarkNotesRead accountId={account.id} unread={unreadNotes} />
            {notes.length ? (
              <NoteThread notes={notes} me="tutor" tutor="You" family={student.parent_name?.trim() || "Family"} />
            ) : (
              <p className="text-sm text-[var(--th-text-3)]">No messages yet. When the family writes on their page, it shows here and on Home.</p>
            )}
            <NoteForm who="tutor" accountId={account.id} placeholder={`Reply to ${student.parent_name?.trim() || "the family"} (shows on their page)…`} />
          </div>
        </Fold>
      ) : null}

      <Fold
        id="hours"
        open={Boolean(bal && (bal.left <= 0 || low))}
        summary={
          <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="h2">Package hours</span>
            {account && bal ? (
              <span className={`text-sm ${bal.left < 0 ? "text-danger" : low ? "text-warn" : "text-[var(--th-text-3)]"}`}>
                {fmtHours(Math.max(0, bal.left))} left of {bal.bought + bal.adjusted} h
                {acctMoney?.forecast.endDate && acctMoney.leftHours > 0 ? ` · runs out around ${fmtDay(acctMoney.forecast.endDate)}` : ""}
                {low ? " · time to renew" : ""}
              </span>
            ) : null}
          </span>
        }
      >
        {account && bal ? (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2 text-center">
              <Stat label="Bought" value={bal.bought + bal.adjusted} />
              <Stat label="Used" value={bal.used} />
              <Stat label="Left" value={bal.left} tone={bal.left < 0 ? "danger" : low ? "warn" : "accent"} />
            </div>
            {bal.left < 0 ? (
              <p className="rounded-xl bg-danger-soft p-3 text-sm text-danger">Hours have run out — {fmtHours(-bal.left)} over.</p>
            ) : low ? (
              <p className="rounded-xl bg-warn-soft p-3 text-sm text-warn">Running low — time to send a renewal message.</p>
            ) : null}
            {acctMoney && acctMoney.leftHours > 0 && acctMoney.forecast.endDate ? (
              <p className="text-sm">
                About {acctMoney.forecast.lessonsLeft} more {acctMoney.forecast.lessonsLeft === 1 ? "lesson" : "lessons"} · runs out around{" "}
                <strong>{fmtDay(acctMoney.forecast.endDate)}</strong>
              </p>
            ) : null}
            {curPkg && curPkg.price != null && curPkg.usedValue != null ? (
              <p className="text-sm text-muted">
                This package: {baht(curPkg.usedValue)} of {baht(curPkg.price)} earned · {acctMoney?.earned ? `${baht(acctMoney.earned)} earned from all packages` : ""}
              </p>
            ) : null}
            {account.packages.length ? (
              <RenewalMessage
                parentName={student.parent_name}
                names={account.students.map((x) => x.first_name)}
                hoursLeft={bal.left}
                lastHours={account.packages.at(-1)?.hours != null ? Number(account.packages.at(-1)!.hours) : null}
                lastPrice={account.packages.at(-1)?.price_thb != null ? Number(account.packages.at(-1)!.price_thb) : null}
                tutorName={tutorName()}
                promptpayId={settings.promptpay_id ?? null}
                priceList={cleanPriceOptions(settings.price_options)}
                accountId={account.id}
                contactApp={student.contact_app}
                contact={student.contact}
              />
            ) : null}
            {account.packages.length === 0 ? (
              <p className="text-sm text-muted">
                {student.source === "preply" ? "Preply student — a package is optional." : "No package yet. Add one below."}
              </p>
            ) : null}
            <p className="text-sm text-muted">
              {sharingWith.length ? `Shared with ${sharingWith.map((s) => s.first_name).join(" & ")}.` : "Own hours."}
            </p>

            {account.packages.length || account.adjustments.length ? (
              <div className="space-y-2">
                <h3 className="text-sm font-medium">History</h3>
                {account.packages.map((p) => (
                  <div key={p.id} className="flex items-start justify-between gap-3 rounded-xl bg-surface-2 p-3 text-sm">
                    <div>
                      <div className="font-medium">
                        +{fmtHours(Number(p.hours))}
                        {p.price_thb != null ? ` · ${thb(p.price_thb)}` : ""}
                      </div>
                      <div className="text-muted">
                        From {fmtDate(`${p.start_date}T12:00:00+07:00`)}
                        {p.paid_on ? ` · paid ${fmtDate(`${p.paid_on}T12:00:00+07:00`)}` : ""}
                        {p.paid_by ? ` · ${PAID_BY[p.paid_by]}` : ""}
                        {p.note ? ` · ${p.note}` : ""}
                        {Number((p as { hours_used_before?: number | null }).hours_used_before ?? 0) > 0
                          ? ` · ${Number((p as { hours_used_before?: number | null }).hours_used_before)} h used before TutoringHub`
                          : ""}
                      </div>
                      {!p.paid_on ? (
                        <form action={markPackagePaid} className="mt-2 flex flex-wrap items-center gap-2">
                          <span className="chip-warn">Not paid yet</span>
                          <input type="hidden" name="id" value={p.id} />
                          <select name="paid_by" className="input min-h-9 w-auto py-1 text-sm" defaultValue="promptpay">
                            <option value="promptpay">PromptPay</option>
                            <option value="bank_transfer">Bank transfer</option>
                            <option value="cash">Cash</option>
                            <option value="other">Other</option>
                          </select>
                          <button className="btn-secondary min-h-9 px-3 text-sm">Mark paid today</button>
                        </form>
                      ) : (p as { receipt_no?: string | null }).receipt_no ? (
                        <Link href={`/receipts/${p.id}`} className="mt-1 inline-block text-accent underline">
                          Receipt {(p as { receipt_no?: string | null }).receipt_no}
                        </Link>
                      ) : null}
                    </div>
                    <form action={deletePackage}>
                      <input type="hidden" name="id" value={p.id} />
                      <ConfirmButton message="Remove this package? Its hours will disappear from the balance." className="text-xs text-muted underline">Remove</ConfirmButton>
                    </form>
                  </div>
                ))}
                {account.adjustments.map((a) => (
                  <div key={a.id} className="flex items-start justify-between gap-3 rounded-xl bg-surface-2 p-3 text-sm">
                    <div>
                      <div className="font-medium">
                        {Number(a.hours) > 0 ? "+" : ""}
                        {fmtHours(Number(a.hours))} adjustment
                      </div>
                      <div className="text-muted">
                        {fmtDate(`${a.adjusted_on}T12:00:00+07:00`)} · {a.reason}
                      </div>
                    </div>
                    <form action={deleteAdjustment}>
                      <input type="hidden" name="id" value={a.id} />
                      <ConfirmButton message="Remove this adjustment?" className="text-xs text-muted underline">Remove</ConfirmButton>
                    </form>
                  </div>
                ))}
              </div>
            ) : null}

            <details className="rounded-xl border border-line p-3">
              <summary className="cursor-pointer font-medium">Add a package</summary>
              <div className="mt-3">
                <PackageForm accountId={account.id} today={todayKey()} priceList={cleanPriceOptions(settings.price_options)} />
              </div>
            </details>
            <details className="rounded-xl border border-line p-3">
              <summary className="cursor-pointer font-medium">Adjust hours by hand</summary>
              <div className="mt-3">
                <AdjustmentForm accountId={account.id} />
              </div>
            </details>
            {others.length ? (
              <details className="rounded-xl border border-line p-3">
                <summary className="cursor-pointer font-medium">Share hours with a sibling</summary>
                <form action={setHourSharing} className="mt-3 flex gap-2">
                  <input type="hidden" name="id" value={student.id} />
                  <select name="share_with" className="input flex-1" defaultValue={sharingWith[0]?.id ?? "own"}>
                    <option value="own">Own hours (not shared)</option>
                    {others.map((o) => (
                      <option key={o.id} value={o.id}>
                        Share with {o.first_name}
                      </option>
                    ))}
                  </select>
                  <button className="btn-secondary">Save</button>
                </form>
                <p className="mt-2 text-xs text-muted">When siblings share, a lesson they have together is counted once.</p>
              </details>
            ) : null}
          </div>
        ) : (
          <p className="card text-sm text-muted">No hours account found.</p>
        )}
      </Fold>

      {upcoming.length ? (
        <section className="flex flex-col gap-3">
          <h2 className="h2 px-1.5">Coming up</h2>
          <ul className="glass rounded-[24px] p-2">
            {upcoming.slice(0, 5).map((l) => (
              <li key={l.id}>
                <SoundLink href={`/lessons/${l.id}`} sound="open" className="flex items-center justify-between gap-3 rounded-2xl px-3.5 py-3 transition-colors hover:bg-white/[0.05]">
                  <span className="font-semibold">{fmtDay(bkkDateKey(l.start_at))}</span>
                  <span className="tabular-nums text-[var(--th-text-3)]">
                    {fmtTime(l.start_at)}–{fmtTime(l.end_at)}
                  </span>
                </SoundLink>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="flex flex-col gap-3">
        <h2 className="h2 px-1.5">Past lessons</h2>
        {past.length === 0 ? <p className="glass rounded-[24px] px-5 py-5 text-[var(--th-text-3)]">No past lessons yet.</p> : null}
        {past.length ? (
          <ul className="glass rounded-[24px] p-2">
            {past.map((l) => (
              <li key={l.id}>
                <SoundLink href={`/lessons/${l.id}`} sound="open" className="block space-y-1 rounded-2xl px-3.5 py-3 text-sm transition-colors hover:bg-white/[0.05]">
                  <span className="flex justify-between gap-3">
                    <span className="text-[15px] font-semibold">{fmtDay(bkkDateKey(l.start_at))}</span>
                    {l.status === "scheduled" ? (
                      <span className="pill todo !py-0.5">no note yet</span>
                    ) : (
                      <span className="text-[var(--th-text-3)]">
                        {fmtHours(lessonLength(l))}
                        {l.status !== "done" ? ` · ${l.status === "cancelled" ? "cancelled" : "charged"}` : ""}
                      </span>
                    )}
                  </span>
                  {l.learned ? <span className="line-clamp-2 block text-[var(--th-text-2)]">{l.learned}</span> : null}
                  {l.next_time ? <span className="line-clamp-1 block text-[var(--th-text-3)]">Next: {l.next_time}</span> : null}
                </SoundLink>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <MonthlyReport
        months={months}
        aiEnabled={aiAvailable()}
        contact={{ app: student.contact_app, value: student.contact }}
        base={{
          studentName: student.first_name,
          parentName: student.parent_name,
          level: student.level,
          progress: progressLine(progress.byStudent.get(student.id) ?? []),
          nextPlan: latestPlan ?? null,
          hoursLeft: account && account.packages.length ? (bal?.left ?? null) : null,
          tutorName: tutorName(),
          tone: settings.tone,
          allowEmoji: settings.allow_emoji,
        }}
      />

      <details className="card">
        <summary className="cursor-pointer font-medium">Edit details</summary>
        <div className="mt-4">
          <StudentForm student={student} action={updateStudent} submitLabel="Save changes" />
        </div>
      </details>

      <details className="card">
        <summary className="cursor-pointer text-danger">Delete student</summary>
        <p className="mt-2 text-sm text-muted">
          This removes {student.first_name}, their links to lessons, and their packages if no sibling shares them. To keep the history,
          untick &quot;Active student&quot; instead.
        </p>
        <form action={deleteStudent} className="mt-3">
          <input type="hidden" name="id" value={student.id} />
          <ConfirmButton className="btn-danger" message={`Delete ${student.first_name} for good? Their lessons, notes and packages go too. This can't be undone.`}>
            Yes, delete {student.first_name}
          </ConfirmButton>
        </form>
      </details>
    </div>
  );
  return account ? (
    <FamilyLinkProvider accountId={account.id} names={account.students.map((x) => x.first_name).join(" & ")} initialToken={familyToken}>
      {page}
    </FamilyLinkProvider>
  ) : (
    page
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "accent" | "warn" | "danger" }) {
  const cls = tone === "danger" ? "text-danger" : tone === "warn" ? "text-warn" : tone === "accent" ? "text-accent" : "";
  return (
    <div className="rounded-[18px] border border-white/[0.08] bg-black/20 p-3">
      <div className={`font-display text-[30px] font-bold leading-tight tabular-nums ${cls}`}>{Math.round(value * 100) / 100}</div>
      <div className="text-sm text-muted">{label}</div>
    </div>
  );
}
