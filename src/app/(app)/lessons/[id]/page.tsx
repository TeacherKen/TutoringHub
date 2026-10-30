import Link from "next/link";
import { notFound } from "next/navigation";
import { requireTutor } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getLesson, getProgress, getSettings, getStudents, lessonMode, lessonNames, lessonPlace } from "@/lib/data";
import { MATERIALS_BUCKET, tutorName } from "@/lib/env";
import { bkkDateKey, fmtLongDay, fmtTime, hoursBetween, isPast } from "@/lib/time";
import { LessonNoteForm } from "@/components/LessonNoteForm";
import { Materials, type MaterialView } from "@/components/Materials";
import { RoomControls } from "@/components/RoomControls";
import { aiAvailable } from "@/lib/ai";
import { progressLine } from "@/lib/progress";
import { roomStudent } from "@/lib/roomStudent";
import { addLessonStudent, removeLessonStudent, setUsesHours } from "@/app/actions/lessons";
import { setIgnored } from "@/app/actions/calendar";

export default async function LessonPage({ params }: PageProps<"/lessons/[id]">) {
  await requireTutor();
  const { id } = await params;
  const lesson = await getLesson(id);
  if (!lesson) notFound();

  const supabase = await createClient();
  const studentIds = lesson.lesson_students.map((ls) => ls.student_id);
  const [students, settings, { data: mats }, { data: recentTopics }, prev, progress] = await Promise.all([
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
  ]);

  const materials: MaterialView[] = await Promise.all(
    (mats ?? []).map(async (m) => {
      let href = m.url as string | null;
      if (m.storage_path) {
        const { data } = await supabase.storage.from(MATERIALS_BUCKET).createSignedUrl(m.storage_path, 60 * 10);
        href = data?.signedUrl ?? null;
      }
      return { id: m.id, kind: m.kind, label: m.label ?? "", href };
    }),
  );

  const topicSuggestions = [...new Set((recentTopics ?? []).flatMap((r) => r.topics as string[]))].slice(0, 30);
  const prevPlans = ((prev.data ?? []) as unknown as { lessons: { start_at: string; next_time: string } }[])
    .map((r) => r.lessons)
    .sort((a, b) => b.start_at.localeCompare(a.start_at));
  const lastPlan = prevPlans[0]?.next_time ?? null;

  const inLesson = lesson.lesson_students;
  const notIn = students.filter((s) => !studentIds.includes(s.id));
  const mode = lessonMode(lesson);
  const place = lessonPlace(lesson);
  const firstStudent = inLesson[0]?.students;
  const progressText =
    inLesson
      .map((ls) => {
        const line = progressLine(progress.byStudent.get(ls.student_id) ?? []);
        return line ? (inLesson.length > 1 ? `${ls.students?.first_name ?? ""} — ${line}` : line) : null;
      })
      .filter(Boolean)
      .join(". ") || null;

  return (
    <div className="space-y-6">
      <Link href="/" className="text-sm text-accent">
        ‹ Home
      </Link>
      <header>
        <p className="text-sm text-muted">
          {fmtLongDay(bkkDateKey(lesson.start_at))} · {fmtTime(lesson.start_at)}–{fmtTime(lesson.end_at)}
        </p>
        <h1 className="h1">{lessonNames(lesson)}</h1>
        <div className="mt-2 flex flex-wrap gap-1.5 text-sm text-muted">
          {mode ? <span className="chip">{mode === "onsite" ? "Onsite" : "Online"}</span> : null}
          {place ? <span className="chip">{place}</span> : null}
          {lesson.is_preply ? <span className="chip-accent">Preply</span> : null}
          {lesson.title && lesson.title !== lessonNames(lesson) ? <span className="chip">“{lesson.title}”</span> : null}
        </div>
      </header>

      {inLesson.length ? (
        <RoomControls
          students={students.filter((s) => studentIds.includes(s.id)).map(roomStudent)}
          lessonId={lesson.id}
        />
      ) : null}

      {lastPlan ? (
        <section className="card border-accent bg-accent-soft">
          <h2 className="text-sm font-medium text-accent">Last time you planned</h2>
          <p className="mt-1 whitespace-pre-wrap">{lastPlan}</p>
        </section>
      ) : null}

      <section className="card space-y-3">
        <h2 className="h2">Students in this lesson</h2>
        {inLesson.length === 0 ? <p className="text-sm text-muted">No student linked yet.</p> : null}
        {inLesson.map((ls) => (
          <div key={ls.student_id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-surface-2 p-3">
            <Link href={`/students/${ls.student_id}`} className="font-medium">
              {ls.students?.first_name}
            </Link>
            <div className="flex items-center gap-2">
              <form action={setUsesHours}>
                <input type="hidden" name="lesson_id" value={lesson.id} />
                <input type="hidden" name="student_id" value={ls.student_id} />
                <input type="hidden" name="uses_hours" value={ls.uses_hours ? "false" : "true"} />
                <button className={ls.uses_hours ? "chip-accent" : "chip"} title="Tap to change">
                  {ls.uses_hours ? "Uses package hours" : "Not using hours"}
                </button>
              </form>
              <form action={removeLessonStudent}>
                <input type="hidden" name="lesson_id" value={lesson.id} />
                <input type="hidden" name="student_id" value={ls.student_id} />
                <button className="text-xs text-muted underline">Remove</button>
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
      </section>

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

      <Materials lessonId={lesson.id} items={materials} />

      <form action={setIgnored} className="pb-4">
        <input type="hidden" name="lesson_id" value={lesson.id} />
        <input type="hidden" name="ignored" value={lesson.ignored ? "false" : "true"} />
        <button className="btn-quiet px-0 text-sm text-muted">
          {lesson.ignored ? "Show this event again" : "This isn't a lesson — hide it"}
        </button>
      </form>
    </div>
  );
}
