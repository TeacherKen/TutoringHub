"use client";
import { useActionState } from "react";
import type { Student } from "@/lib/data";
import type { FormState } from "@/app/actions/students";

type Props = {
  student?: Student;
  action: (state: FormState, form: FormData) => Promise<FormState>;
  submitLabel: string;
};

export function StudentForm({ student, action, submitLabel }: Props) {
  const [state, formAction, pending] = useActionState(action, null);
  const s = student;
  return (
    <form action={formAction} className="space-y-4">
      {s ? <input type="hidden" name="id" value={s.id} /> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="First name or nickname" hint="No surnames.">
          <input name="first_name" className="input" required defaultValue={s?.first_name} autoComplete="off" />
        </Field>
        <Field label="Level">
          <input name="level" className="input" placeholder="e.g. P2, Grade 5" defaultValue={s?.level ?? ""} />
        </Field>
        <Field label="Parent's name">
          <input name="parent_name" className="input" placeholder="e.g. Ms Aradhana" defaultValue={s?.parent_name ?? ""} />
        </Field>
        <Field label="Parent contact app">
          <select name="contact_app" className="input" defaultValue={s?.contact_app ?? "whatsapp"}>
            <option value="whatsapp">WhatsApp</option>
            <option value="line">LINE</option>
            <option value="wechat">WeChat</option>
            <option value="other">Other</option>
          </select>
        </Field>
        <Field label="Parent contact" hint="Phone number or ID. Only you can see this.">
          <input name="contact" className="input" defaultValue={s?.contact ?? ""} autoComplete="off" />
        </Field>
        <Field label="Usual place">
          <input name="place" className="input" placeholder="e.g. Nana" defaultValue={s?.place ?? ""} />
        </Field>
        <Field label="Lesson type">
          <select name="mode" className="input" defaultValue={s?.mode ?? "onsite"}>
            <option value="onsite">Onsite</option>
            <option value="online">Online</option>
          </select>
        </Field>
        <Field label="Student from">
          <select name="source" className="input" defaultValue={s?.source ?? "private"}>
            <option value="private">Private</option>
            <option value="preply">Preply</option>
          </select>
        </Field>
      </div>
      <Field
        label="Calendar keywords"
        hint="Words in your Google Calendar event title that mean this student. Separate with commas, e.g. Alice, Alice Prep"
      >
        <input name="keywords" className="input" defaultValue={s?.keywords.join(", ") ?? ""} placeholder="Leave empty to use the first name" />
      </Field>
      <Field label="Price per hour (฿)" hint="Only for students without a package, e.g. Preply: what you receive per hour after Preply's cut. Used on the Money page.">
        <input
          name="hourly_rate_thb"
          type="number"
          min="0"
          step="1"
          inputMode="numeric"
          className="input"
          placeholder="e.g. 600"
          defaultValue={(s as { hourly_rate_thb?: number | null } | undefined)?.hourly_rate_thb ?? ""}
        />
      </Field>
      <Field label="Book or syllabus">
        <input name="book" className="input" placeholder="e.g. My Pals Are Here! Maths 2B" defaultValue={s?.book ?? ""} />
      </Field>
      <Field label="Private notes (only you)">
        <textarea name="private_notes" className="input" placeholder="e.g. Careless with mental maths — remind him to write working" defaultValue={s?.private_notes ?? ""} />
      </Field>
      {s ? (
        <label className="flex items-center gap-3">
          <input type="checkbox" name="active" value="on" defaultChecked={s.active} className="h-5 w-5 accent-[var(--accent)]" />
          <input type="hidden" name="active" value="off" />
          <span>Active student</span>
        </label>
      ) : null}
      {state?.error ? <p className="text-sm text-danger">{state.error}</p> : null}
      {state?.ok ? <p className="text-sm text-ok">{state.ok}</p> : null}
      <button className="btn-primary w-full sm:w-auto" disabled={pending}>
        {pending ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-muted">{hint}</span> : null}
    </label>
  );
}
