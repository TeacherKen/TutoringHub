"use client";
import { useActionState, useEffect, useRef, useState } from "react";
import { addCalendar, type ActionState } from "@/app/actions/calendar";
import { addPerson, saveFeedbackSettings, type SettingsState } from "@/app/actions/settings";
import { DEFAULT_TEMPLATE, TONES } from "@/lib/feedbackPrompt";

function Msg({ s }: { s: { ok?: boolean | string; error?: string; message?: string } | null }) {
  if (!s) return null;
  const isErr = Boolean(s.error) || s.ok === false;
  const text = s.error ?? s.message ?? (typeof s.ok === "string" ? s.ok : "");
  return text ? <p className={`text-sm ${isErr ? "text-danger" : "text-ok"}`}>{text}</p> : null;
}

export function CalendarForm({ first }: { first: boolean }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(addCalendar, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);
  return (
    <form ref={ref} action={action} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="sm:col-span-1">
          <span className="label">Name</span>
          <input name="label" className="input" placeholder={first ? "e.g. Lessons" : "e.g. Preply"} maxLength={40} />
        </label>
        <label className="sm:col-span-2">
          <span className="label">Secret address in iCal format</span>
          <input
            name="ical_url"
            type="password"
            autoComplete="off"
            spellCheck={false}
            required
            className="input font-mono text-sm"
            placeholder="https://calendar.google.com/calendar/ical/…/basic.ics"
          />
        </label>
      </div>
      <label className="flex min-h-12 items-center gap-3">
        <input type="checkbox" name="is_preply" className="h-5 w-5 accent-[var(--accent)]" />
        <span>Every lesson in this calendar is a Preply lesson</span>
      </label>
      <Msg s={state} />
      <button className="btn-primary w-full sm:w-auto" disabled={pending}>
        {pending ? "Checking the calendar…" : first ? "Connect calendar" : "Add calendar"}
      </button>
    </form>
  );
}

export function AddPersonForm() {
  const [state, action, pending] = useActionState<SettingsState, FormData>(addPerson, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);
  return (
    <form ref={ref} action={action} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label>
          <span className="label">Google email</span>
          <input name="email" type="email" required className="input" placeholder="name@gmail.com" autoComplete="off" />
        </label>
        <label>
          <span className="label">Name (optional)</span>
          <input name="display_name" className="input" placeholder="e.g. Best" />
        </label>
      </div>
      <label className="block">
        <span className="label">Access</span>
        <select name="role" className="input" defaultValue="viewer">
          <option value="viewer">Family — schedule only</option>
          <option value="tutor">Tutor — full access</option>
        </select>
      </label>
      <Msg s={state} />
      <button className="btn-secondary w-full sm:w-auto" disabled={pending}>
        {pending ? "Adding…" : "Add person"}
      </button>
    </form>
  );
}

export function FeedbackSettingsForm(props: {
  tone: string;
  allowEmoji: boolean;
  template: string | null;
  lowHours: number;
  trackFrom: string | null;
}) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(saveFeedbackSettings, null);
  const [template, setTemplate] = useState(props.template ?? DEFAULT_TEMPLATE);
  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label>
          <span className="label">Default tone</span>
          <select name="tone" className="input" defaultValue={props.tone}>
            {Object.entries(TONES).map(([k, v]) => (
              <option key={k} value={k}>
                {k[0].toUpperCase() + k.slice(1)} — {v}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="label">Warn when hours left are at or below</span>
          <input name="low_hours_threshold" type="number" step="0.5" min="0" className="input" defaultValue={props.lowHours} />
        </label>
        <label>
          <span className="label">Remind me about notes for lessons from</span>
          <input name="track_from" type="date" className="input" defaultValue={props.trackFrom ?? ""} />
          <span className="mt-1 block text-xs text-muted">Older lessons are never flagged as missing a note.</span>
        </label>
      </div>
      <label className="flex min-h-12 items-center gap-3">
        <input type="checkbox" name="allow_emoji" defaultChecked={props.allowEmoji} className="h-5 w-5 accent-[var(--accent)]" />
        <span>Allow one or two emojis in parent messages</span>
      </label>
      <label className="block">
        <span className="label">Prompt template</span>
        <textarea name="prompt_template" className="input min-h-72 font-mono text-sm" value={template} onChange={(e) => setTemplate(e.target.value)} />
        <span className="mt-1 block text-xs text-muted">
          Words in {"{{double brackets}}"} are filled in for you: student, parent, level, tone, tutor, date, learned, how_it_went, topics, homework,
          next_time, emoji_rule, progress.
        </span>
      </label>
      <div className="flex flex-wrap gap-2">
        <button className="btn-primary" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </button>
        <button type="button" className="btn-quiet" onClick={() => setTemplate(DEFAULT_TEMPLATE)}>
          Reset template
        </button>
      </div>
      <Msg s={state} />
    </form>
  );
}
