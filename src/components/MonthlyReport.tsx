"use client";
import { useState } from "react";
import { writeFeedbackWithAI } from "@/app/actions/lessons";
import { buildMonthlyPrompt, type MonthlyInput, type ReportMonth } from "@/lib/monthlyReport";

/** One tap writes a monthly progress report for the parent from the month's lesson notes. */
export function MonthlyReport({ months, base, aiEnabled }: { months: ReportMonth[]; base: Omit<MonthlyInput, "month">; aiEnabled: boolean }) {
  const [key, setKey] = useState(months[0]?.key ?? "");
  const [text, setText] = useState("");
  const [state, setState] = useState<string | null>(null);
  const month = months.find((m) => m.key === key);

  if (!months.length) {
    return (
      <section className="space-y-2">
        <h2 className="h2">Monthly report</h2>
        <p className="card text-sm text-muted">Once lessons have notes, you can write a monthly report for the parent here.</p>
      </section>
    );
  }

  const prompt = () => (month ? buildMonthlyPrompt({ ...base, month }) : "");

  async function copy(t: string, done: string) {
    try {
      await navigator.clipboard.writeText(t);
      setState(done);
    } catch {
      setState("Couldn't copy — select the text and copy it.");
    }
  }

  return (
    <section className="space-y-2">
      <h2 className="h2">Monthly report</h2>
      <div className="card space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <select className="input w-auto" value={key} onChange={(e) => (setKey(e.target.value), setText(""), setState(null))}>
            {months.map((m) => (
              <option key={m.key} value={m.key}>
                {m.label} · {m.lessons.length} {m.lessons.length === 1 ? "lesson" : "lessons"}
              </option>
            ))}
          </select>
          {aiEnabled ? (
            <button
              type="button"
              className="btn-primary"
              disabled={state === "Writing…"}
              onClick={async () => {
                if (text && !confirm("Replace the report you have?")) return;
                setState("Writing…");
                const r = await writeFeedbackWithAI(prompt());
                if (r.text) {
                  setText(r.text);
                  setState(null);
                } else setState(r.error ?? "Couldn't write it. Try again.");
              }}
            >
              {state === "Writing…" ? "Writing…" : "✦ Write report"}
            </button>
          ) : null}
          <button type="button" className={aiEnabled ? "btn-quiet text-sm" : "btn-primary"} onClick={() => copy(prompt(), "Prompt copied — paste it into ChatGPT, then paste the report below.")}>
            {aiEnabled ? "Or copy the prompt for ChatGPT" : "Copy prompt for ChatGPT"}
          </button>
        </div>
        <textarea className="input min-h-56" value={text} onChange={(e) => setText(e.target.value)} placeholder="The report appears here. You can edit it before sending." />
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className="btn-secondary" disabled={!text.trim()} onClick={() => copy(text, "Report copied ✓ — paste it into your chat with the parent.")}>
            {state?.startsWith("Report copied") ? "✓ Copied" : "Copy report"}
          </button>
          {state && state !== "Writing…" ? <span className="text-sm text-accent">{state}</span> : null}
        </div>
      </div>
    </section>
  );
}
