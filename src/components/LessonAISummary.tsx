"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { addMaterialFile, summariseLessonWithAI } from "@/app/actions/lessons";
import { MATERIALS_BUCKET } from "@/lib/constants";
import { randomId } from "@/lib/randomId";
import { lessonWriting, type BoardPoll } from "@/lib/boardShared";
import type { LessonSummary } from "@/lib/lessonSummary";
import { pagePicture } from "./Whiteboard";

type BoardRef = { id: string; name: string };

/**
 * ✨ After the lesson: turn this lesson's smart-slide pages into pictures, then let AI read them
 * (with worksheet photos and notes) and write the parent message and the next worksheet prompt.
 */
export function LessonAISummary({
  lessonId,
  aiEnabled,
  boards,
  window: win,
  savedLabels,
  photoCount,
  initial,
}: {
  lessonId: string;
  aiEnabled: boolean;
  boards: BoardRef[];
  window: { from: string; to: string };
  savedLabels: string[];
  photoCount: number;
  initial: LessonSummary | null;
}) {
  const router = useRouter();
  const [summary, setSummary] = useState<LessonSummary | null>(initial);
  const [message, setMessage] = useState(initial?.parent_message ?? "");
  const [step, setStep] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [used, setUsed] = useState<string | null>(null);

  /** Pictures of the pages written on in this lesson, added to the lesson (skips ones already saved). */
  async function savePages(): Promise<number> {
    const sb = createClient();
    let saved = 0;
    for (const b of boards) {
      const res = await fetch(`/api/board/${b.id}?after=0&urls=1`, { cache: "no-store" });
      if (!res.ok) continue;
      const poll = (await res.json()) as BoardPoll;
      if (!poll.board) continue;
      const board = poll.board;
      const { marks: inLesson, pages } = lessonWriting(poll.marks, board.layout, win.from, win.to);
      for (const id of pages) {
        const pos = board.layout.indexOf(id) + 1;
        const label = `${b.name}'s work · ${board.title} · page ${pos}`.slice(0, 120);
        if (savedLabels.includes(label)) continue;
        setStep(`Turning ${b.name}'s page ${pos} into a picture…`);
        const blob = await pagePicture(
          board,
          id,
          inLesson.filter((m) => m.page === id),
          (k) => `/api/board/${b.id}/image?k=${encodeURIComponent(k)}`,
        );
        const path = `${lessonId}/${randomId()}.jpg`;
        const { error: upErr } = await sb.storage.from(MATERIALS_BUCKET).upload(path, blob, { contentType: "image/jpeg" });
        if (upErr) continue;
        const r = await addMaterialFile(lessonId, path, "photo", label);
        if (!r.error) saved++;
      }
    }
    return saved;
  }

  async function run() {
    setError(null);
    setUsed(null);
    try {
      setStep("Looking at the smart slides from this lesson…");
      await savePages();
      setStep("Reading the lesson… this takes about 20–40 seconds.");
      const r = await summariseLessonWithAI(lessonId);
      if (r.summary) {
        setSummary(r.summary);
        setMessage(r.summary.parent_message);
      } else setError(r.error ?? "Something went wrong. Try again.");
      router.refresh();
    } catch {
      setError("The internet dropped. Try again.");
    } finally {
      setStep(null);
    }
  }

  function copy(text: string, what: string) {
    void navigator.clipboard?.writeText(text).then(() => {
      setCopied(what);
      setTimeout(() => setCopied(null), 2000);
    });
  }

  function useMessage() {
    window.dispatchEvent(new CustomEvent("tutoringhub:use-message", { detail: message }));
    setUsed("message");
  }

  function useNotes() {
    if (!summary) return;
    window.dispatchEvent(
      new CustomEvent("tutoringhub:use-notes", {
        detail: { learned: summary.what_we_did, next_time: summary.next_time, homework: summary.homework, how_it_went: summary.how_it_went, topics: summary.topics },
      }),
    );
    setUsed("notes");
  }

  const sources = [boards.length ? `the smart slides (${boards.map((b) => b.name).join(", ")})` : null, photoCount ? `${photoCount} work ${photoCount === 1 ? "photo" : "photos"}` : null].filter(Boolean);

  return (
    <section className="card space-y-4 border-accent/40">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="h2">✨ AI lesson summary</h2>
          <p className="mt-1 text-sm text-muted">
            {sources.length ? `Reads ${sources.join(" and ")} from this lesson, plus your notes and any times tables played.` : "Write on the smart slides during the lesson or add worksheet photos, then press the button."}
          </p>
        </div>
        {aiEnabled ? (
          <button type="button" className="btn-primary" onClick={run} disabled={!!step}>
            {step ? "Working…" : summary ? "Summarise again" : "✨ Summarise this lesson"}
          </button>
        ) : null}
      </div>

      {!aiEnabled ? (
        <p className="rounded-xl bg-[var(--warn-soft)] p-3 text-sm text-warn">
          To turn this on, add your Anthropic key in Vercel: Project → Settings → Environment Variables → name <b>ANTHROPIC_API_KEY</b>. Then redeploy.
        </p>
      ) : null}
      {step ? (
        <p role="status" className="rounded-xl bg-accent-soft p-3 text-sm text-accent">
          {step}
        </p>
      ) : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}

      {summary ? (
        <div className="space-y-5">
          <div className="space-y-2 text-sm">
            {summary.what_we_did ? <p>{summary.what_we_did}</p> : null}
            {summary.went_well.length ? (
              <div>
                <p className="font-medium">Went well</p>
                <ul className="list-disc pl-5 text-muted">
                  {summary.went_well.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {summary.mistakes.length ? (
              <div>
                <p className="font-medium">Got stuck on</p>
                <ul className="space-y-1">
                  {summary.mistakes.map((m, i) => (
                    <li key={i} className="rounded-lg bg-surface-2 px-3 py-2">
                      <span className="font-medium">{m.question}</span>
                      {m.what_happened ? <span className="text-muted"> · {m.what_happened}</span> : null}
                      {m.why ? <span className="block text-xs text-muted">Why: {m.why}</span> : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <p className="text-xs text-muted">
              Read from {summary.pictures_read} {summary.pictures_read === 1 ? "picture" : "pictures"}. AI can misread handwriting, so check before sending.
            </p>
            <button type="button" className="btn-secondary" onClick={useNotes}>
              {used === "notes" ? "✓ Added to the empty note boxes" : "Fill in the lesson notes"}
            </button>
          </div>

          <div className="space-y-2">
            <h3 className="font-medium">Part 1 · Message to the parent</h3>
            <textarea className="input min-h-48" value={message} onChange={(e) => setMessage(e.target.value)} />
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-primary" onClick={useMessage}>
                {used === "message" ? "✓ In the parent message box" : "Put in the parent message box"}
              </button>
              <button type="button" className="btn-secondary" onClick={() => copy(message, "message")}>
                {copied === "message" ? "Copied ✓" : "Copy"}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="font-medium">Part 2 · Prompt for the next worksheet</h3>
            <p className="text-sm text-muted">Paste into ChatGPT, Claude or Gemini to get a printable PDF worksheet aimed at today&apos;s mistakes.</p>
            <textarea className="input min-h-56 font-mono text-xs" value={summary.worksheet_prompt} readOnly />
            <button type="button" className="btn-primary" onClick={() => copy(summary.worksheet_prompt, "prompt")}>
              {copied === "prompt" ? "Copied ✓" : "Copy worksheet prompt"}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
