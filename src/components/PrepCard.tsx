import Link from "next/link";
import type { PrepStudent } from "@/lib/prep";
import { bkkDateKey, fmtDay, fmtHours } from "@/lib/time";

/** ✅ Before class: last time's plan, slides or worksheet, practice at home, hours left. */
export function PrepCard({ lessonId, students }: { lessonId: string; students: PrepStudent[] }) {
  if (!students.length) return null;
  // Brothers and sisters on one package: show the hours once, at the end.
  const first = students[0].hours;
  const shared = students.length > 1 && !!first && students.every((s) => s.hours && s.hours.left === first.left && s.hours.low === first.low);
  return (
    <div className="space-y-3 rounded-2xl border border-line bg-surface px-4 py-3 text-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">Before class</p>
      {students.map((s) => (
        <div key={s.id} className="space-y-1.5">
          {students.length > 1 ? <p className="font-medium">{s.name}</p> : null}

          {s.last ? (
            s.last.nextTime || s.last.homework ? (
              <Row icon="📝">
                <span className="text-muted">Plan from {fmtDay(bkkDateKey(s.last.date))}:</span> {s.last.nextTime ?? "(no plan written)"}
                {s.last.homework ? (
                  <>
                    {" "}
                    <span className="text-muted">· Homework:</span> {s.last.homework}
                  </>
                ) : null}
              </Row>
            ) : (
              <Row icon="📝" warn>
                No plan written last time ({fmtDay(bkkDateKey(s.last.date))}).{" "}
                <Link href={`/lessons/${s.last.lessonId}`} className="text-accent underline">
                  Open that lesson
                </Link>
              </Row>
            )
          ) : (
            <Row icon="📝">First lesson with {s.name} in TutoringHub.</Row>
          )}

          {s.slides ? (
            s.slides.kind === "none" ? (
              <Row icon="🖥" warn>
                Nothing in {s.name}&apos;s room yet.{" "}
                {s.sheet ? (
                  <a href={`/print/worksheet/${s.sheet.id}`} target="_blank" rel="noopener" className="text-accent underline">
                    Put the worksheet on their smart slides
                  </a>
                ) : (
                  <Link href={`/lessons/${lessonId}#room`} className="text-accent underline">
                    Add slides
                  </Link>
                )}
              </Row>
            ) : (
              <Row icon="🖥">
                <span className="text-muted">{s.slides.kind === "board" ? "Smart slides:" : "Canva:"}</span> {s.slides.title}
              </Row>
            )
          ) : null}

          {s.sheet ? (
            <Row icon={s.slides ? "📝" : "🖨"}>
              <span className="text-muted">{s.slides ? "Worksheet made:" : "To print:"}</span>{" "}
              <a href={`/print/worksheet/${s.sheet.id}`} target="_blank" rel="noopener" className="text-accent underline">
                {s.sheet.title}
              </a>
            </Row>
          ) : null}

          {s.practice ? (
            s.practice.rounds ? (
              <Row icon="⚽">
                {s.practice.rounds} football {s.practice.rounds === 1 ? "round" : "rounds"} since last lesson
                {s.practice.best ? <span className="text-muted"> · best {s.practice.best}</span> : null}
              </Row>
            ) : (
              <Row icon="⚽" warn>
                No times tables practice since last lesson.
              </Row>
            )
          ) : null}

          {s.hours && !shared ? (
            <Row icon="⏱" warn={s.hours.low}>
              {s.hours.left > 0 ? `${fmtHours(s.hours.left)} left in the package` : "Package hours used up"}
              {s.hours.low ? " — time to renew" : ""}
            </Row>
          ) : null}
        </div>
      ))}
      {shared && first ? (
        <Row icon="⏱" warn={first.low}>
          {first.left > 0 ? `${fmtHours(first.left)} left in their shared package` : "Package hours used up"}
          {first.low ? " — time to renew" : ""}
        </Row>
      ) : null}
    </div>
  );
}

function Row({ icon, warn, children }: { icon: string; warn?: boolean; children: React.ReactNode }) {
  return (
    <p className={`flex gap-2 ${warn ? "text-warn" : ""}`}>
      <span aria-hidden className="w-5 shrink-0 text-center">
        {icon}
      </span>
      <span className="min-w-0">{children}</span>
    </p>
  );
}
