import { notFound } from "next/navigation";
import { requireTutor } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getLesson, getMoneyData, getProgress, getSettings, getStudents, lessonNames } from "@/lib/data";
import { MATERIALS_BUCKET, tutorName } from "@/lib/env";
import { bkkDateKey, fmtLongDay, fmtTime, hoursBetween, isPast } from "@/lib/time";
import { LessonNoteForm } from "@/components/LessonNoteForm";
import { LessonAISummary } from "@/components/LessonAISummary";
import { cleanSummary, lessonWindow } from "@/lib/lessonSummary";
import { Materials, type MaterialView } from "@/components/Materials";
import { Fold } from "@/components/glass/Fold";
import { ChildTopics } from "@/components/ChildTopics";
import { RoomControls } from "@/components/RoomControls";
import { aiAvailable } from "@/lib/ai";
import { progressLine } from "@/lib/progress";
import { thb } from "@/lib/earnings";
import { roomStudent } from "@/lib/roomStudent";
import { addLessonStudent, removeLessonStudent, setUsesHours } from "@/app/actions/lessons";
import { setIgnored } from "@/app/actions/calendar";
import { loadReady } from "@/lib/readyData";
import { Avatar, ModePill } from "@/components/home/Dashboard";
import { ReadyPill } from "@/components/glass/ReadyPill";
import { SoundLink } from "@/components/glass/SoundLink";
import { colourSlots } from "@/lib/studentColours";
import { FamilyLinkProvider } from "@/components/FamilyLinkContext";
import { LessonTabs } from "@/components/LessonTabs";

export default async function LessonPage({ params, searchParams }: PageProps<"/lessons/[id]">) {
  const [sp, , { id }, supabase] = await Promise.all([searchParams, requireTutor(), params, createClient()]);
  const lesson = await getLesson(id);
  if (!lesson) notFound();

  const studentIds = lesson.lesson_students.map((ls) => ls.student_id);
  // Everything that doesn't depend on anything else is asked for at the same time (one wait, not ten).
  const [students, settings, { data: mats }, { data: recentTopics }, prev, progress, money, { data: kidBoards }, savedRes, { data: sheetRows }] =
    await Promise.all([
      getStudents({ activeOnly: true }),
      getSettings(),
      supabase.from("lesson_materials").select("*").eq("lesson_id", id).order("created_at"),
      supabase.from("lessons").select("topics").neq("topics", "{}").order("start_at", { ascending: false }).limit(60),
      studentIds.length
        ? supabase
            .from("lesson_students")
            .select("lessons!inner(id, start_at, next_time)")
            .in("student_id", studentIds)
            .lt("lessons.start_at", lesson.start_at)
            .not("lessons.next_time", "is", null)
        : Promise.resolve({ data: [] }),
      getProgress(studentIds),
      getMoneyData(),
      // ✨ AI summary: the students' smart slides, any summary already made, and worksheets (update 0020).
      studentIds.length ? supabase.from("boards").select("id, student_id").in("student_id", studentIds) : Promise.resolve({ data: [] }),
      supabase.from("lessons").select("ai_summary").eq("id", id).maybeSingle(),
      supabase.from("worksheets").select("id, title, created_at").eq("lesson_id", id).order("created_at", { ascending: false }),
    ]);
  const earned = money.lessons.find((l) => l.id === lesson.id);

  // Second (and last) wait: private links for the files, and which slides were written on in this lesson.
  const win = lessonWindow(lesson.start_at, lesson.end_at);
  const fileRows = (mats ?? []).filter((m) => m.storage_path);
  const boardIds = ((kidBoards ?? []) as { id: string; student_id: string }[]).map((b) => b.id);
  const parentOf = students.find((s) => s.id === lesson.lesson_students[0]?.student_id);
  const accountId = parentOf?.hour_account_id ?? null;
  const [{ data: signed }, { data: active }, readyMap, { data: famRow }] = await Promise.all([
    fileRows.length
      ? supabase.storage.from(MATERIALS_BUCKET).createSignedUrls(
          fileRows.map((m) => m.storage_path as string),
          60 * 10,
        )
      : Promise.resolve({ data: [] as { signedUrl: string | null }[] }),
    boardIds.length
      ? supabase.from("board_marks").select("board_id").in("board_id", boardIds).gte("created_at", win.from).lte("created_at", win.to).limit(2000)
      : Promise.resolve({ data: [] }),
    // A lesson still to come: is it ready? (Upload smart slides below, or tick it after printing the worksheet.)
    loadReady([lesson], students),
    // The family page link for this lesson's family (for the tick box on "Send on WhatsApp / LINE").
    accountId ? supabase.from("hour_accounts").select("family_token").eq("id", accountId).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const urlFor = new Map(fileRows.map((m, i) => [m.id as string, signed?.[i]?.signedUrl ?? null]));
  const materials: MaterialView[] = (mats ?? []).map((m) => ({
    id: m.id,
    kind: m.kind,
    label: m.label ?? "",
    href: m.storage_path ? (urlFor.get(m.id as string) ?? null) : (m.url as string | null),
  }));

  const activeIds = new Set(((active ?? []) as { board_id: string }[]).map((r) => r.board_id));
  const nameOfStudent = new Map(lesson.lesson_students.map((ls) => [ls.student_id, ls.students?.first_name ?? "Student"]));
  const summaryBoards = ((kidBoards ?? []) as { id: string; student_id: string }[])
    .filter((b) => activeIds.has(b.id))
    .map((b) => ({ id: b.id, name: nameOfStudent.get(b.student_id) ?? "Student" }));
  const saved = savedRes.data as { ai_summary?: { pictures_read?: number } } | null;
  const savedSummary = savedRes.error ? null : cleanSummary(saved?.ai_summary);
  if (savedSummary) savedSummary.pictures_read = Number((saved?.ai_summary ?? {}).pictures_read) || 0;
  const photoLabels = materials.filter((m) => m.kind === "photo").map((m) => m.label);
  const worksheets = (sheetRows ?? []) as { id: string; title: string; created_at: string }[];

  const topicSuggestions = [...new Set((recentTopics ?? []).flatMap((r) => r.topics as string[]))].slice(0, 30);
  const prevPlans = ((prev.data ?? []) as unknown as { lessons: { start_at: string; next_time: string } }[])
    .map((r) => r.lessons)
    .sort((a, b) => b.start_at.localeCompare(a.start_at));
  const lastPlan = prevPlans[0]?.next_time ?? null;

  const inLesson = lesson.lesson_students;
  const ready = readyMap.get(lesson.id) ?? null;
  // The family colour, the same as on Home, Week, Students and Money.
  const colours = colourSlots({ students, packages: money.packages, accountNames: new Map(money.accounts.map((a) => [a.id, a.name])) });
  const slot = inLesson[0] ? colours.slotOfStudent(inLesson[0].student_id) : 8;
  const notIn = students.filter((s) => !studentIds.includes(s.id));
  const firstStudent = inLesson[0]?.students;
  const progressText =
    inLesson
      .map((ls) => {
        const line = progressLine(progress.byStudent.get(ls.student_id) ?? []);
        return line ? (inLesson.length > 1 ? `${ls.students?.first_name ?? ""} — ${line}` : line) : null;
      })
      .filter(Boolean)
      .join(". ") || null;

  const famToken = (famRow as { family_token?: string | null } | null)?.family_token ?? null;
  const famNames = students
    .filter((s) => accountId && s.hour_account_id === accountId)
    .map((s) => s.first_name)
    .join(" & ");

  // Once the lesson has started, the page is about "after the lesson": photos → ✨ → check → send.
  const ended = isPast(lesson.start_at);
  // Before and during class: Teach. After it ends: After class. Either can be chosen.
  const view: "teach" | "after" = sp.view === "teach" || sp.view === "after" ? sp.view : isPast(lesson.end_at) ? "after" : "teach";

  const page = (
    <div className="flex flex-col gap-5">
      <SoundLink href="/" sound="nav" className="inline-flex min-h-11 items-center gap-1 self-start px-1.5 font-medium text-accent">
        ‹ Home
      </SoundLink>
      <header className="glass-hi relative -mt-3 overflow-hidden rounded-[30px] px-6 py-6 sm:px-8 sm:py-7">
        <div aria-hidden className="glass-grid" />
        <div className="relative flex flex-wrap items-center gap-5">
          {inLesson.length ? <Avatar name={lessonNames(lesson)} slot={slot} size={64} /> : null}
          <div className="min-w-0 flex-1">
            <p className="text-base text-[var(--th-text-3)]">
              {fmtLongDay(bkkDateKey(lesson.start_at))} ·{" "}
              <span className="font-semibold tabular-nums text-accent">
                {fmtTime(lesson.start_at)}–{fmtTime(lesson.end_at)}
              </span>
            </p>
            <h1 className="font-display text-[34px] font-semibold leading-tight tracking-[-0.015em] sm:text-[44px]">{lessonNames(lesson)}</h1>
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              {inLesson.length ? <ModePill lesson={lesson} slot={slot} /> : null}
              {lesson.title && lesson.title !== lessonNames(lesson) ? <span className="tag">“{lesson.title}”</span> : null}
              {ready ? <ReadyPill lessonId={lesson.id} r={ready} who={lessonNames(lesson)} /> : null}
            </div>
            {ready && !ready.ready && ready.hint ? <p className="mt-2 text-sm text-[var(--th-text-3)]">{ready.hint}</p> : null}
          </div>
        </div>
      </header>

      <LessonTabs
        initial={view}
        sent={Boolean(lesson.sent_at)}
        teach={
        <>
          {lastPlan ? (
            <section
              className="glass rounded-[24px] p-5"
              style={{ borderColor: "var(--th-accent-line)", background: "color-mix(in srgb, var(--th-accent) 9%, transparent)" }}
            >
              <h2 className="text-xs font-semibold tracking-[0.16em] text-accent">LAST TIME YOU PLANNED</h2>
              <p className="mt-2 whitespace-pre-wrap text-[17px] leading-relaxed">{lastPlan}</p>
            </section>
          ) : null}
          {inLesson.length ? (
            <RoomControls students={students.filter((s) => studentIds.includes(s.id)).map(roomStudent)} lessonId={lesson.id} />
          ) : (
            <p className="card text-muted">Add a student under Lesson settings below to open their room, slides and games.</p>
          )}
          <Fold
            summary={
              <span className="flex flex-wrap items-baseline gap-x-3">
                <span className="h2">Worksheets and materials</span>
                <span className="text-sm text-[var(--th-text-3)]">{materials.length ? `${materials.length} saved` : "none yet"}</span>
              </span>
            }
          >
            <Materials lessonId={lesson.id} items={materials} bare kids={inLesson.map((ls) => ls.students?.first_name ?? "").filter(Boolean)} />
          </Fold>
        </>
        }
        after={
        <>
          <StepLabel id="send-update" n={1} text="Add worksheet photos, then let ✨ write the note and message" />
          <LessonAISummary
            lessonId={lesson.id}
            aiEnabled={aiAvailable()}
            pictures={settings.ai_pictures === true}
            worksheets={worksheets}
            kids={inLesson.map((ls) => ls.students?.first_name ?? "").filter(Boolean)}
            boards={summaryBoards}
            window={win}
            savedLabels={photoLabels}
            photoCount={photoLabels.length}
            initial={savedSummary}
          />

          <StepLabel n={2} text="Check the note and the parent message, then tap 📮 Send lesson update" />
          <LessonNoteForm
            lessonId={lesson.id}
            initial={{
              learned: lesson.learned ?? "",
              next_time: lesson.next_time ?? "",
              homework: lesson.homework ?? "",
              how_it_went: lesson.how_it_went,
              topics: lesson.topics ?? [],
              status: lesson.status,
              length_hours: lesson.length_hours != null ? Number(lesson.length_hours) : null,
              final_message: lesson.final_message ?? "",
              sent_at: lesson.sent_at,
              updated_at: lesson.note_updated_at,
            }}
            defaultLength={hoursBetween(lesson.start_at, lesson.end_at)}
            isPast={isPast(lesson.start_at)}
            aiEnabled={aiAvailable()}
            aiAbove={ended && aiAvailable()}
            contact={parentOf ? { app: parentOf.contact_app, value: parentOf.contact } : undefined}
            topicSuggestions={topicSuggestions}
            promptContext={{
              studentNames: inLesson.map((ls) => ls.students?.first_name ?? "").filter(Boolean),
              parentName: firstStudent?.parent_name ?? null,
              level: firstStudent?.level ?? null,
              date: fmtLongDay(bkkDateKey(lesson.start_at)),
              tutorName: tutorName(),
              progress: progressText,
              tone: settings.tone,
              allowEmoji: settings.allow_emoji,
              template: settings.prompt_template,
            }}
          />
          <ChildTopics
            lessonId={lesson.id}
            lessonTopics={lesson.topics ?? []}
            kids={inLesson.map((ls) => ({ id: ls.student_id, name: ls.students?.first_name ?? "Student", topics: ls.topics ?? null }))}
          />
        </>
        }
      />

      {/* Things about the booking, not the teaching: who's in it, hours, price. Closed, at the bottom. */}
      <Fold
        summary={
          <span className="flex flex-wrap items-baseline gap-x-3">
            <span className="h2">Lesson settings</span>
            <span className="text-sm text-[var(--th-text-3)]">students, hours{earned?.value != null ? ", price" : ""}</span>
          </span>
        }
        open={inLesson.length === 0}
      >
        <div className="space-y-4">
          {earned?.value != null ? <p className="text-sm">This class earns <strong>{thb(earned.value)}</strong>.</p> : null}
                <div className="space-y-3">
                  {inLesson.length === 0 ? <p className="text-sm text-muted">No student linked yet.</p> : null}
                  {inLesson.map((ls) => (
                    <div key={ls.student_id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                      <SoundLink href={`/students/${ls.student_id}`} sound="open" className="flex items-center gap-3 font-semibold hover:text-accent">
                        <Avatar name={ls.students?.first_name ?? "?"} slot={colours.slotOfStudent(ls.student_id)} size={36} />
                        {ls.students?.first_name}
                      </SoundLink>
                      <div className="flex items-center gap-2">
                        <form action={setUsesHours}>
                          <input type="hidden" name="lesson_id" value={lesson.id} />
                          <input type="hidden" name="student_id" value={ls.student_id} />
                          <input type="hidden" name="uses_hours" value={ls.uses_hours ? "false" : "true"} />
                          <button className={`pill press min-h-11 ${ls.uses_hours ? "ok" : ""}`} title="Tap to change">
                            {ls.uses_hours ? "Uses package hours" : "Not using hours"}
                          </button>
                        </form>
                        <form action={removeLessonStudent}>
                          <input type="hidden" name="lesson_id" value={lesson.id} />
                          <input type="hidden" name="student_id" value={ls.student_id} />
                          <button className="min-h-11 px-2 text-xs text-muted underline">Remove</button>
                        </form>
                      </div>
                    </div>
                  ))}
                  {notIn.length ? (
                    <form action={addLessonStudent} className="flex gap-2">
                      <input type="hidden" name="lesson_id" value={lesson.id} />
                      <select name="student_id" className="input flex-1" defaultValue="" required>
                        <option value="" disabled>
                          Add a student…
                        </option>
                        {notIn.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.first_name}
                          </option>
                        ))}
                      </select>
                      <button className="btn-secondary">Add</button>
                    </form>
                  ) : null}
                </div>
          <form action={setIgnored} className="pb-4">
            <input type="hidden" name="lesson_id" value={lesson.id} />
            <input type="hidden" name="ignored" value={lesson.ignored ? "false" : "true"} />
            <button className="btn-quiet px-0 text-sm text-muted">{lesson.ignored ? "Show this event again" : "This isn't a lesson — hide it"}</button>
          </form>
        </div>
      </Fold>
    </div>
  );
  return accountId ? (
    <FamilyLinkProvider accountId={accountId} names={famNames || lessonNames(lesson)} initialToken={famToken}>
      {page}
    </FamilyLinkProvider>
  ) : (
    page
  );
}

/** "① Add worksheet photos…": the order to do things in after a lesson. */
function StepLabel({ n, text, id }: { n: number; text: string; id?: string }) {
  return (
    <p id={id} className="-mb-2 mt-1 flex scroll-mt-28 items-center gap-2.5 px-1.5 text-sm font-semibold text-[var(--th-text-2)]">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent font-display text-[15px] font-bold text-[var(--th-accent-ink)]">
        {n}
      </span>
      {text}
    </p>
  );
}
