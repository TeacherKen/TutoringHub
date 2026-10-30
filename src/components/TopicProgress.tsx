"use client";
import { useState, useTransition } from "react";
import { removeTopic, setTopicStatus } from "@/app/actions/progress";
import { STATUS_LABEL, TOPIC_STATUSES, type TopicRow, type TopicStatus } from "@/lib/progress";

const GROUP_STYLE: Record<TopicStatus, string> = { got_it: "chip-ok", learning: "chip-warn", next: "chip" };
const ORDER: TopicStatus[] = ["learning", "next", "got_it"];

/** Each student's topics: Learning / Coming up / Got it. Tap a topic to change it. */
export function TopicProgress({ studentId, rows, ready, suggestions }: { studentId: string; rows: TopicRow[]; ready: boolean; suggestions: string[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const [newTopic, setNewTopic] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<{ error?: string } | { ok?: boolean }>) =>
    start(async () => {
      const r = await fn();
      setError("error" in r && r.error ? r.error : null);
      setOpen(null);
    });

  const got = rows.filter((r) => r.status === "got_it").length;
  const known = new Set(rows.map((r) => r.name));
  const ideas = suggestions.filter((s) => !known.has(s) && (!newTopic || s.includes(newTopic.trim().toLowerCase()))).slice(0, 6);

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 className="h2">Topic progress</h2>
        {rows.length ? (
          <span className="text-sm text-muted">
            {got} of {rows.length} got it
          </span>
        ) : null}
      </div>
      <div className={`card space-y-4 ${pending ? "opacity-60" : ""}`}>
        {!ready ? <p className="rounded-xl bg-warn-soft p-3 text-sm text-warn">Run database update 0008 to save topic progress.</p> : null}
        {rows.length === 0 ? (
          <p className="text-sm text-muted">No topics yet. Topics you tag on lesson notes appear here, or add one below.</p>
        ) : null}
        {ORDER.map((status) => {
          const list = rows.filter((r) => r.status === status);
          if (!list.length) return null;
          return (
            <div key={status} className="space-y-2">
              <h3 className="text-sm font-medium">
                {STATUS_LABEL[status]} <span className="text-muted">({list.length})</span>
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {list.map((r) => (
                  <button key={r.name} type="button" className={GROUP_STYLE[status]} onClick={() => setOpen(open === r.name ? null : r.name)}>
                    {status === "got_it" ? "✓ " : ""}
                    {r.name}
                    {r.lessons > 1 ? <span className="opacity-60"> ×{r.lessons}</span> : null}
                  </button>
                ))}
              </div>
              {list.some((r) => r.name === open) ? (
                <div className="flex flex-wrap items-center gap-2 rounded-xl bg-surface-2 p-2 text-sm">
                  <span className="font-medium">{open}:</span>
                  {TOPIC_STATUSES.filter((s) => s !== status).map((s) => (
                    <button key={s} type="button" className="btn-secondary" onClick={() => run(() => setTopicStatus(studentId, open!, s))}>
                      {STATUS_LABEL[s]}
                    </button>
                  ))}
                  {list.find((r) => r.name === open)?.saved ? (
                    <button type="button" className="btn-quiet" onClick={() => run(() => removeTopic(studentId, open!))}>
                      Remove
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
        <form
          className="space-y-2 border-t border-line pt-3"
          onSubmit={(e) => {
            e.preventDefault();
            const t = newTopic;
            setNewTopic("");
            run(() => setTopicStatus(studentId, t, "next"));
          }}
        >
          <span className="label">Add a topic for later</span>
          <div className="flex gap-2">
            <input className="input flex-1" value={newTopic} onChange={(e) => setNewTopic(e.target.value)} placeholder="e.g. fractions of a set" maxLength={40} />
            <button className="btn-secondary" disabled={!newTopic.trim()}>
              Add
            </button>
          </div>
          {ideas.length ? (
            <div className="flex flex-wrap gap-1.5">
              {ideas.map((s) => (
                <button key={s} type="button" className="chip" onClick={() => run(() => setTopicStatus(studentId, s, "next"))}>
                  + {s}
                </button>
              ))}
            </div>
          ) : null}
        </form>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
      </div>
    </section>
  );
}
