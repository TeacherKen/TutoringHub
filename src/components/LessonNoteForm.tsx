"use client";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { saveFinalMessage, saveLessonNote, setSent, type NoteInput } from "@/app/actions/lessons";
import { buildFeedbackPrompt, type PromptInput } from "@/lib/feedbackPrompt";

type Initial = NoteInput & { final_message: string; sent_at: string | null; updated_at: string | null };

type Props = {
  lessonId: string;
  initial: Initial;
  defaultLength: number;
  isPast: boolean;
  topicSuggestions: string[];
  promptContext: Omit<PromptInput, "learned" | "nextTime" | "homework" | "howItWent" | "topics">;
};

const STATUS_OPTIONS = [
  { value: "done", label: "Done" },
  { value: "cancelled", label: "Cancelled — not charged" },
  { value: "cancelled_charged", label: "Cancelled — charged" },
  { value: "no_show", label: "No-show — charged" },
  { value: "scheduled", label: "Not happened yet" },
];
const HOW = [
  { value: "great", label: "Great" },
  { value: "good", label: "Good" },
  { value: "needs_practice", label: "Needs more practice" },
];

type Draft = { v: NoteInput; t: number };

function readDraft(key: string): Draft | null {
  try {
    const raw = window.localStorage.getItem(key);
    const d = raw ? (JSON.parse(raw) as Draft) : null;
    return d && d.v && typeof d.t === "number" ? d : null;
  } catch {
    return null;
  }
}
function writeDraft(key: string, v: NoteInput | null) {
  try {
    if (v) window.localStorage.setItem(key, JSON.stringify({ v, t: Date.now() }));
    else window.localStorage.removeItem(key);
  } catch {
    /* storage not available — the server save still works */
  }
}

async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  }
}

export function LessonNoteForm({ lessonId, initial, defaultLength, isPast, topicSuggestions, promptContext }: Props) {
  const draftKey = `th-note-${lessonId}`;
  const [note, setNote] = useState<NoteInput>(() => ({
    learned: initial.learned,
    next_time: initial.next_time,
    homework: initial.homework,
    how_it_went: initial.how_it_went,
    topics: initial.topics,
    status: isPast && initial.status === "scheduled" && !initial.learned ? "done" : initial.status,
    length_hours: initial.length_hours,
  }));
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">(initial.updated_at ? "saved" : "idle");
  const [topicInput, setTopicInput] = useState("");
  const [finalMsg, setFinalMsg] = useState(initial.final_message);
  const [finalState, setFinalState] = useState<"idle" | "saving" | "saved">(initial.final_message ? "saved" : "idle");
  const [sentAt, setSentAt] = useState(initial.sent_at);
  const [flash, setFlash] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // What the server already has. Autosave only runs when the note differs from this.
  // (Built from the server's status, so a past lesson defaulting to "Done" is saved.)
  const lastSaved = useRef(JSON.stringify({ ...note, status: initial.status }));
  const latest = useRef(note);

  // Restore an unsaved draft from this device (e.g. phone lost signal),
  // but only if it is newer than what the server has.
  useEffect(() => {
    const d = readDraft(draftKey);
    const serverTime = initial.updated_at ? new Date(initial.updated_at).getTime() : 0;
    if (!d) return;
    if (d.t > serverTime && JSON.stringify(d.v) !== lastSaved.current) {
      // Reading this device's saved draft can only happen after the page loads.
      setNote(d.v);
    } else {
      writeDraft(draftKey, null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = useCallback(
    async (v: NoteInput) => {
      setSaveState("saving");
      try {
        const r = await saveLessonNote(lessonId, v);
        if (r.ok) {
          lastSaved.current = JSON.stringify(v);
          // Only clear the backup if nothing new was typed while saving.
          if (latest.current === v) {
            setSaveState("saved");
            writeDraft(draftKey, null);
          }
        } else setSaveState("error");
      } catch {
        setSaveState("error");
      }
    },
    [lessonId, draftKey],
  );

  // Autosave 1 second after you stop typing.
  useEffect(() => {
    latest.current = note;
    if (JSON.stringify(note) === lastSaved.current) return;
    writeDraft(draftKey, note);
    setSaveState("saving");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => startTransition(() => save(note)), 1000);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [note, save, draftKey]);

  // Save straight away if you leave the page or switch apps before the 1-second wait.
  useEffect(() => {
    const flush = () => {
      if (JSON.stringify(latest.current) === lastSaved.current) return;
      if (timer.current) clearTimeout(timer.current);
      void save(latest.current);
    };
    const onHide = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onHide);
      flush();
    };
  }, [save]);

  const set = <K extends keyof NoteInput>(k: K, v: NoteInput[K]) => setNote((n) => ({ ...n, [k]: v }));

  function addTopic(t: string) {
    const v = t.trim().toLowerCase();
    if (!v || note.topics.includes(v)) return;
    set("topics", [...note.topics, v].slice(0, 12));
    setTopicInput("");
  }

  async function preparePrompt() {
    const prompt = buildFeedbackPrompt({
      ...promptContext,
      learned: note.learned,
      nextTime: note.next_time,
      homework: note.homework,
      howItWent: note.how_it_went as PromptInput["howItWent"],
      topics: note.topics,
    });
    const ok = await copy(prompt);
    setFlash(ok ? "Prompt copied. Open ChatGPT and paste it." : "Couldn't copy — please try again.");
    setTimeout(() => setFlash(null), 5000);
  }

  async function saveFinal() {
    setFinalState("saving");
    const r = await saveFinalMessage(lessonId, finalMsg);
    setFinalState(r.ok ? "saved" : "idle");
  }

  const charged = ["done", "cancelled_charged", "no_show"].includes(note.status);
  const notesEmpty = !note.learned.trim() && !note.next_time.trim();
  const suggestions = topicSuggestions.filter((t) => !note.topics.includes(t) && (!topicInput || t.includes(topicInput.toLowerCase()))).slice(0, 8);

  return (
    <>
      <section className="card space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="h2">Lesson note</h2>
          <span className={`text-xs ${saveState === "error" ? "text-danger" : "text-muted"}`} role="status">
            {saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved ✓" : saveState === "error" ? "Not saved — check your connection" : ""}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="col-span-2 sm:col-span-1">
            <span className="label">Lesson status</span>
            <select className="input" value={note.status} onChange={(e) => set("status", e.target.value)}>
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="col-span-2 sm:col-span-1">
            <span className="label">Length (hours){charged ? " — uses package hours" : ""}</span>
            <input
              className="input"
              type="number"
              step="0.25"
              min="0"
              inputMode="decimal"
              value={note.length_hours ?? ""}
              placeholder={String(defaultLength)}
              onChange={(e) => set("length_hours", e.target.value === "" ? null : Number(e.target.value))}
            />
          </label>
        </div>

        <label className="block">
          <span className="label">Learned today</span>
          <textarea className="input" value={note.learned} onChange={(e) => set("learned", e.target.value)} placeholder="e.g. Long division with remainders, checked using multiplication" />
        </label>
        <label className="block">
          <span className="label">Next time</span>
          <textarea className="input" value={note.next_time} onChange={(e) => set("next_time", e.target.value)} placeholder="e.g. Word problems with division" />
        </label>
        <label className="block">
          <span className="label">Homework set (optional)</span>
          <input className="input" value={note.homework} onChange={(e) => set("homework", e.target.value)} placeholder="e.g. Worksheet page 3, Q1–8" />
        </label>

        <fieldset>
          <legend className="label">How it went</legend>
          <div className="grid grid-cols-3 gap-2">
            {HOW.map((h) => (
              <button
                key={h.value}
                type="button"
                aria-pressed={note.how_it_went === h.value}
                onClick={() => set("how_it_went", note.how_it_went === h.value ? null : h.value)}
                className={`min-h-12 rounded-xl border px-2 text-sm ${note.how_it_went === h.value ? "border-accent bg-accent-soft font-medium text-accent" : "border-line bg-surface"}`}
              >
                {h.label}
              </button>
            ))}
          </div>
        </fieldset>

        <div>
          <span className="label">Topics</span>
          <div className="flex flex-wrap gap-1.5">
            {note.topics.map((t) => (
              <button key={t} type="button" onClick={() => set("topics", note.topics.filter((x) => x !== t))} className="chip-accent" aria-label={`Remove ${t}`}>
                {t} ✕
              </button>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <input
              className="input"
              value={topicInput}
              onChange={(e) => setTopicInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === ",") {
                  e.preventDefault();
                  addTopic(topicInput);
                }
              }}
              placeholder="e.g. fractions"
            />
            <button type="button" className="btn-secondary" onClick={() => addTopic(topicInput)}>
              Add
            </button>
          </div>
          {suggestions.length ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {suggestions.map((t) => (
                <button key={t} type="button" className="chip" onClick={() => addTopic(t)}>
                  + {t}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      <section className="card space-y-4">
        <h2 className="h2">Parent feedback</h2>
        <ol className="list-decimal space-y-1 pl-5 text-sm text-muted">
          <li>Tap “Copy prompt for ChatGPT”.</li>
          <li>Open ChatGPT, paste, and send.</li>
          <li>Paste ChatGPT’s message below, check it, and save.</li>
        </ol>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button type="button" className="btn-primary flex-1" onClick={preparePrompt} disabled={notesEmpty}>
            Copy prompt for ChatGPT
          </button>
          <a href="https://chatgpt.com/" target="_blank" rel="noopener noreferrer" className="btn-secondary flex-1">
            Open ChatGPT ↗
          </a>
        </div>
        {notesEmpty ? <p className="text-xs text-muted">Write “Learned today” or “Next time” first.</p> : null}
        {flash ? (
          <p role="status" className="rounded-xl bg-accent-soft p-3 text-sm text-accent">
            {flash}
          </p>
        ) : null}

        <label className="block">
          <span className="label">Final message (what the parent will receive)</span>
          <textarea
            className="input min-h-48"
            value={finalMsg}
            onChange={(e) => {
              setFinalMsg(e.target.value);
              setFinalState("idle");
            }}
            placeholder="Paste the polished message from ChatGPT here, then check and edit it."
          />
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button type="button" className="btn-primary flex-1" onClick={saveFinal} disabled={finalState !== "idle"}>
            {finalState === "saving" ? "Saving…" : finalState === "saved" ? "Saved ✓" : "Save message"}
          </button>
          <button
            type="button"
            className="btn-secondary flex-1"
            disabled={!finalMsg.trim()}
            onClick={async () => {
              const ok = await copy(finalMsg);
              setFlash(ok ? "Message copied — paste it into the parent's chat." : "Couldn't copy.");
              setTimeout(() => setFlash(null), 4000);
            }}
          >
            Copy final message
          </button>
        </div>
        <label className="flex min-h-12 items-center gap-3 rounded-xl bg-surface-2 px-3">
          <input
            type="checkbox"
            className="h-5 w-5 accent-[var(--accent)]"
            checked={Boolean(sentAt)}
            disabled={!finalMsg.trim() || finalState !== "saved"}
            onChange={async (e) => {
              const r = await setSent(lessonId, e.target.checked);
              if (r.ok) setSentAt(r.sent_at);
            }}
          />
          <span className="text-sm">
            {sentAt
              ? `Sent to parent · ${new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Bangkok", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(sentAt))}`
              : "Sent to parent"}
          </span>
        </label>
      </section>
    </>
  );
}
