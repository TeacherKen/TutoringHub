"use client";
import { useActionState, useState } from "react";
import { savePreplyStats, type PreplyFormState } from "@/app/actions/preply";
import type { PreplyStats } from "@/lib/preply";

/** Copy one student's numbers from Preply. Picking a student fills in what's saved now. */
export function PreplyForm({ students, current }: { students: { id: string; name: string }[]; current: PreplyStats[] }) {
  const [state, action, pending] = useActionState<PreplyFormState, FormData>(savePreplyStats, null);
  const [id, setId] = useState(students[0]?.id ?? "");
  const c = current.find((r) => r.student_id === id);
  const field = (name: string, label: string, value: string | number | null | undefined, opts: { type?: string; step?: string; hint?: string } = {}) => (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-[var(--th-text-2)]">{label}</span>
      <input name={name} type={opts.type ?? "text"} inputMode={opts.type ? undefined : "decimal"} step={opts.step} defaultValue={value ?? ""} placeholder={opts.hint} className="input min-h-11" />
    </label>
  );
  if (!students.length) return <p className="text-sm text-muted">Mark a student as Preply in their details first.</p>;
  return (
    <form action={action} key={id} className="space-y-3">
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-[var(--th-text-2)]">Student</span>
        <select name="student_id" className="input min-h-11" value={id} onChange={(e) => setId(e.target.value)}>
          {students.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {field("account_name", "Name on Preply", c?.account_name, { hint: "e.g. Alice L." })}
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-[var(--th-text-2)]">Type</span>
          <select name="plan" defaultValue={c?.plan ?? "subscription"} className="input min-h-11">
            <option value="subscription">Subscription</option>
            <option value="package">Package</option>
            <option value="trial">Trial</option>
          </select>
        </label>
        {field("income_usd", "Income earned ($)", c?.income_usd, { hint: "5761.80" })}
        {field("lessons", "Lessons", c?.lessons)}
        {field("months", "Months", c?.months)}
        {field("lesson_price_usd", "Lesson price ($)", c?.lesson_price_usd)}
        {field("list_price_usd", "Your usual price ($)", c?.list_price_usd, { hint: "80" })}
        {field("per_four_weeks", "Lessons every 4 weeks", c?.per_four_weeks, { hint: "subscriptions" })}
        {field("booked", "Scheduled or completed", c?.booked, { hint: "13" })}
        {field("booked_of", "… of", c?.booked_of, { hint: "13" })}
        {field("renews_on", "Renewal date", c?.renews_on, { type: "date" })}
      </div>
      <div className="flex items-center gap-3">
        <button className="btn-primary min-h-11" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </button>
        {state?.ok ? <span className="text-sm text-ok">{state.ok}</span> : null}
        {state?.error ? <span className="text-sm text-danger">{state.error}</span> : null}
      </div>
    </form>
  );
}
