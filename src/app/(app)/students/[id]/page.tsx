import Link from "next/link";
import { notFound } from "next/navigation";
import { requireTutor } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getAccountSummaries, getSettings, getStudents, type Lesson } from "@/lib/data";
import { lessonLength } from "@/lib/hours";
import { bkkDateKey, fmtDate, fmtDay, fmtHours, fmtTime, isPast, todayKey } from "@/lib/time";
import { StudentForm } from "@/components/StudentForm";
import { RoomControls } from "@/components/RoomControls";
import { RenewalMessage } from "@/components/RenewalMessage";
import { tutorName } from "@/lib/env";
import { roomStudent } from "@/lib/roomStudent";
import { AdjustmentForm, PackageForm } from "@/components/HoursForms";
import { deleteAdjustment, deletePackage, deleteStudent, setHourSharing, updateStudent } from "@/app/actions/students";

const PAID_BY: Record<string, string> = { bank_transfer: "Bank transfer", cash: "Cash", preply: "Preply", other: "Other" };
const CONTACT: Record<string, string> = { whatsapp: "WhatsApp", line: "LINE", wechat: "WeChat", other: "Contact" };
const thb = (n: number) => `฿${Number(n).toLocaleString("en-US")}`;

export default async function StudentPage({ params }: PageProps<"/students/[id]">) {
  await requireTutor();
  const { id } = await params;
  const [students, accounts, settings] = await Promise.all([getStudents(), getAccountSummaries(), getSettings()]);
  const student = students.find((s) => s.id === id);
  if (!student) notFound();
  const account = accounts.find((a) => a.id === student.hour_account_id);

  const supabase = await createClient();
  const { data: links } = await supabase
    .from("lesson_students")
    .select("lessons(id, start_at, end_at, status, length_hours, learned, next_time, homework, topics, ignored, in_calendar, sent_at)")
    .eq("student_id", id);
  const lessons = ((links ?? []).map((l) => l.lessons) as unknown as Lesson[])
    .filter((l) => l && !l.ignored && (l.in_calendar || l.status !== "scheduled"))
    .sort((a, b) => b.start_at.localeCompare(a.start_at));
  const past = lessons.filter((l) => isPast(l.start_at));
  const upcoming = lessons.filter((l) => !isPast(l.start_at)).reverse();
  const latestPlan = past.find((l) => l.next_time)?.next_time;
  const others = students.filter((s) => s.id !== id && s.active);
  const sharingWith = account?.students.filter((s) => s.id !== id) ?? [];
  const bal = account?.balance;
  const low = bal && account.packages.length > 0 && bal.left <= Number(settings.low_hours_threshold);

  return (
    <div className="space-y-6">
      <Link href="/students" className="text-sm text-accent">
        ‹ Students
      </Link>
      <header>
        <h1 className="h1">{student.first_name}</h1>
        <p className="mt-1 text-muted">
          {[student.level, student.mode === "onsite" ? `Onsite${student.place ? ` · ${student.place}` : ""}` : "Online", student.source === "preply" ? "Preply" : null]
            .filter(Boolean)
            .join(" · ")}
        </p>
        {student.parent_name || student.contact ? (
          <p className="mt-1 text-sm text-muted">
            Parent: {student.parent_name ?? "—"}
            {student.contact ? ` · ${CONTACT[student.contact_app ?? "other"]}: ${student.contact}` : ""}
          </p>
        ) : null}
      </header>

      <RoomControls students={[roomStudent(student)]} showGames={false} />

      {latestPlan ? (
        <section className="card border-accent bg-accent-soft">
          <h2 className="text-sm font-medium text-accent">Next time</h2>
          <p className="mt-1 whitespace-pre-wrap">{latestPlan}</p>
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

      <section id="hours" className="space-y-3">
        <h2 className="h2">Package hours</h2>
        {account && bal ? (
          <div className="card space-y-4">
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
            {account.packages.length ? (
              <RenewalMessage
                parentName={student.parent_name}
                names={account.students.map((x) => x.first_name)}
                hoursLeft={bal.left}
                lastHours={account.packages.at(-1)?.hours != null ? Number(account.packages.at(-1)!.hours) : null}
                lastPrice={account.packages.at(-1)?.price_thb != null ? Number(account.packages.at(-1)!.price_thb) : null}
                tutorName={tutorName()}
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
                      </div>
                    </div>
                    <form action={deletePackage}>
                      <input type="hidden" name="id" value={p.id} />
                      <button className="text-xs text-muted underline">Remove</button>
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
                      <button className="text-xs text-muted underline">Remove</button>
                    </form>
                  </div>
                ))}
              </div>
            ) : null}

            <details className="rounded-xl border border-line p-3">
              <summary className="cursor-pointer font-medium">Add a package</summary>
              <div className="mt-3">
                <PackageForm accountId={account.id} today={todayKey()} />
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
      </section>

      {upcoming.length ? (
        <section className="space-y-2">
          <h2 className="h2">Coming up</h2>
          {upcoming.slice(0, 5).map((l) => (
            <Link key={l.id} href={`/lessons/${l.id}`} className="card flex justify-between text-sm hover:border-accent">
              <span>{fmtDay(bkkDateKey(l.start_at))}</span>
              <span className="tabular-nums text-muted">
                {fmtTime(l.start_at)}–{fmtTime(l.end_at)}
              </span>
            </Link>
          ))}
        </section>
      ) : null}

      <section className="space-y-2">
        <h2 className="h2">Past lessons</h2>
        {past.length === 0 ? <p className="card text-sm text-muted">No past lessons yet.</p> : null}
        {past.map((l) => (
          <Link key={l.id} href={`/lessons/${l.id}`} className="card block space-y-1 text-sm hover:border-accent">
            <div className="flex justify-between">
              <span className="font-medium">{fmtDay(bkkDateKey(l.start_at))}</span>
              <span className="text-muted">
                {l.status === "scheduled" ? "No note yet" : `${fmtHours(lessonLength(l))}${l.status !== "done" ? ` · ${l.status === "cancelled" ? "cancelled" : "charged"}` : ""}`}
              </span>
            </div>
            {l.learned ? <p className="line-clamp-2">{l.learned}</p> : null}
            {l.next_time ? <p className="line-clamp-1 text-muted">Next: {l.next_time}</p> : null}
          </Link>
        ))}
      </section>

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
          <button className="btn-danger">Yes, delete {student.first_name}</button>
        </form>
      </details>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "accent" | "warn" | "danger" }) {
  const cls = tone === "danger" ? "text-danger" : tone === "warn" ? "text-warn" : tone === "accent" ? "text-accent" : "";
  return (
    <div className="rounded-xl bg-surface-2 p-3">
      <div className={`text-2xl font-semibold tabular-nums ${cls}`}>{Math.round(value * 100) / 100}</div>
      <div className="text-xs text-muted">{label}</div>
    </div>
  );
}
