import Link from "next/link";
import { fmtTime } from "@/lib/time";
import { lessonMode, lessonNames, lessonPlace, needsNote, type Lesson } from "@/lib/data";

const STATUS: Record<Lesson["status"], { label: string; cls: string } | null> = {
  scheduled: null,
  done: { label: "Done", cls: "chip-ok" },
  cancelled: { label: "Cancelled", cls: "chip" },
  cancelled_charged: { label: "Cancelled · charged", cls: "chip-warn" },
  no_show: { label: "No-show · charged", cls: "chip-warn" },
};

export function LessonCard({ lesson }: { lesson: Lesson }) {
  const mode = lessonMode(lesson);
  const place = lessonPlace(lesson);
  const st = STATUS[lesson.status];
  const missing = needsNote(lesson);
  const unsent = lesson.status === "done" && lesson.final_message && !lesson.sent_at;
  const cancelled = lesson.status === "cancelled";

  return (
    <Link
      href={`/lessons/${lesson.id}`}
      className={`card flex items-center gap-4 transition-colors hover:border-accent ${cancelled ? "opacity-60" : ""}`}
    >
      <div className="w-14 shrink-0 text-center">
        <div className="text-lg font-semibold tabular-nums">{fmtTime(lesson.start_at)}</div>
        <div className="text-xs text-muted tabular-nums">{fmtTime(lesson.end_at)}</div>
      </div>
      <div className="min-w-0 flex-1">
        <div className={`truncate font-medium ${cancelled ? "line-through" : ""}`}>{lessonNames(lesson)}</div>
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-sm text-muted">
          {mode ? <span>{mode === "onsite" ? "Onsite" : "Online"}</span> : null}
          {place ? <span>· {place}</span> : null}
          {lesson.is_preply ? <span className="chip-accent">Preply</span> : null}
          {st ? <span className={st.cls}>{st.label}</span> : null}
          {missing ? <span className="chip-warn">Note missing</span> : null}
          {unsent ? <span className="chip-warn">Feedback not sent</span> : null}
        </div>
      </div>
      <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-muted" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
        <path d="m9 6 6 6-6 6" />
      </svg>
    </Link>
  );
}
