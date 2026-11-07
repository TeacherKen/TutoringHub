"use client";
import { isHeic, isPhoto, photoToJpeg } from "@/lib/photo";
import { netFail } from "@/lib/netFail";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { addMaterialFile } from "@/app/actions/lessons";
import { setAiPictures } from "@/app/actions/settings";
import { postJson } from "@/lib/postJson";
import { MATERIALS_BUCKET } from "@/lib/constants";
import { randomId } from "@/lib/randomId";
import { lessonWriting, type BoardPoll } from "@/lib/boardShared";
import type { LessonSummary } from "@/lib/lessonSummary";
import { pagePicture } from "./Whiteboard";

type BoardRef = { id: string; name: string };
type SheetRef = { id: string; title: string; created_at: string };

/**
 * ✨ After the lesson: turn this lesson's smart-slide pages into pictures, then let AI read them
 * (with worksheet photos and notes) and write the parent message and the next worksheet prompt.
 */
export function LessonAISummary({
  lessonId,
  aiEnabled,
  pictures,
  boards,
  window: win,
  savedLabels,
  photoCount,
  initial,
  worksheets = [],
  kids = [],
}: {
  /** First names of the children in the lesson: brothers and sisters each get their own photo button. */
  kids?: string[];
  lessonId: string;
  aiEnabled: boolean;
  /** May the AI read pictures of the work? (Settings) */
  pictures: boolean;
  boards: BoardRef[];
  window: { from: string; to: string };
  savedLabels: string[];
  photoCount: number;
  initial: LessonSummary | null;
  /** Worksheets already made for this lesson, newest first. */
  worksheets?: SheetRef[];
}) {
  const router = useRouter();
  const [summary, setSummary] = useState<LessonSummary | null>(initial);
  const [message, setMessage] = useState(initial?.parent_message ?? "");
  const [step, setStep] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [used, setUsed] = useState<string | null>(null);
  const [sheetStep, setSheetStep] = useState<string | null>(null);
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [photos, setPhotos] = useState(photoCount);
  // "Jaian's worksheet ×2 · Nivaan's worksheet" from the saved photo names.
  const photoNames = Object.entries(
    savedLabels.filter((l) => /worksheet|photo/i.test(l)).reduce<Record<string, number>>((m, l) => ({ ...m, [l]: (m[l] ?? 0) + 1 }), {}),
  ).map(([l, n]) => (n > 1 ? `${l} ×${n}` : l));
  const [readPics, setReadPics] = useState(pictures);

  /** 📷 Worksheet photos straight from the iPhone/iPad camera or photo library. Made smaller (and JPG) first. */
  async function addPhotos(files: FileList | null, who?: string) {
    if (!files?.length) return;
    setError(null);
    const sb = createClient();
    let added = 0;
    let problem = "";
    for (const [i, file] of [...files].slice(0, 6).entries()) {
      if (!isPhoto(file)) {
        problem = `"${file.name}" isn't a photo.`;
        continue;
      }
      setStep(isHeic(file) ? `Changing iPhone photo ${i + 1} to JPG…` : `Adding photo ${i + 1} of ${Math.min(files.length, 6)}…`);
      const blob = await photoToJpeg(file).catch(() => null);
      if (!blob) {
        problem = `"${file.name}" couldn't be opened. Try a screenshot of it, or save it as a JPG.`;
        continue;
      }
      const path = `${lessonId}/${randomId()}.jpg`;
      const { error: upErr } = await sb.storage.from(MATERIALS_BUCKET).upload(path, blob, { contentType: "image/jpeg" });
      if (upErr) {
        problem = "The photo didn't upload. Check the internet and try again.";
        continue;
      }
      const r = await addMaterialFile(lessonId, path, "photo", who ? `${who}'s worksheet` : "Worksheet photo").catch(netFail);
      if (r.error) problem = r.error;
      else added++;
    }
    setStep(null);
    if (!added) return setError(problem || "The photo didn't upload. Try again.");
    setPhotos((n) => n + added);
    router.refresh();
  }

  async function allowPictures(on: boolean) {
    setReadPics(on);
    const r = await setAiPictures(on);
    if (r.error) {
      setReadPics(!on);
      setError(r.error);
    } else router.refresh();
  }

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
      if (readPics) {
        setStep("Looking at the smart slides from this lesson…");
        await savePages();
      }
      setStep(readPics ? "Reading the lesson… this takes about 20–40 seconds." : "Reading your notes… this takes about 15–30 seconds.");
      // Its own web address (not a Server Action), so other buttons don't wait behind the AI.
      const r = await postJson<{ summary?: LessonSummary }>("/api/ai/summary", { lessonId });
      if (r.summary) {
        setSummary(r.summary);
        setMessage(r.summary.parent_message);
        // Straight into the note boxes (only the empty ones) and the parent message box, ready to check and send.
        fill(r.summary, r.summary.parent_message);
      } else setError(r.error ?? "Something went wrong. Try again.");
      router.refresh();
    } catch {
      setError("The internet dropped. Try again.");
    } finally {
      setStep(null);
    }
  }

  async function makeSheet() {
    if (!summary) return;
    setSheetError(null);
    setSheetStep("Writing the worksheet and checking the answers… about 30–60 seconds.");
    try {
      const r = await postJson<{ id?: string }>("/api/ai/worksheet", { lessonId, brief: summary.worksheet_prompt });
      if (r.id) {
        window.open(`/print/worksheet/${r.id}`, "_blank");
        router.refresh();
      } else setSheetError(r.error ?? "Couldn't make the worksheet. Try again.");
    } catch {
      setSheetError("The internet dropped. Try again.");
    } finally {
      setSheetStep(null);
    }
  }

  function copy(text: string, what: string) {
    void navigator.clipboard?.writeText(text).then(() => {
      setCopied(what);
      setTimeout(() => setCopied(null), 2000);
    });
  }

  function fill(s: LessonSummary, msg: string) {
    window.dispatchEvent(
      new CustomEvent("tutoringhub:use-notes", { detail: { learned: s.what_we_did, next_time: s.next_time, homework: s.homework, how_it_went: s.how_it_went, topics: s.topics } }),
    );
    window.dispatchEvent(new CustomEvent("tutoringhub:use-message", { detail: msg }));
    setUsed("both");
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

  const sources = readPics
    ? [boards.length ? `the smart slides (${boards.map((b) => b.name).join(", ")})` : null, photos ? `${photos} work ${photos === 1 ? "photo" : "photos"}` : null].filter(Boolean)
    : [];

  return (
    <section className="card space-y-4 border-accent/40">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="h2">✨ Write my note and parent message</h2>
          <p className="mt-1 text-sm text-muted">
            {readPics
              ? sources.length
                ? `Reads ${sources.join(" and ")} from this lesson, plus your notes and any times tables played. Names are never sent.`
                : "Add a photo of the worksheet (or write on the smart slides in the lesson), then press the button."
              : "Reads your lesson notes and any times tables played. Names are never sent."}
          </p>
        </div>
      </div>

      {aiEnabled ? (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {(kids.length > 1 ? kids : [undefined]).map((who) => (
              <label key={who ?? "one"} className={`btn-secondary flex-1 cursor-pointer ${step ? "pointer-events-none opacity-50" : ""}`}>
                📷 {who ? `${who}'s worksheet` : photos ? "Add another worksheet photo" : "Add worksheet photo"}
                {who && savedLabels.some((l) => l.startsWith(`${who}'s worksheet`)) ? <span className="text-ok">✓</span> : null}
                <input type="file" accept="image/*,.heic,.heif" multiple className="sr-only" onChange={(e) => void addPhotos(e.target.files, who).finally(() => (e.target.value = ""))} />
              </label>
            ))}
            <button type="button" className="btn-primary w-full" onClick={run} disabled={!!step}>
              {step ? "Working…" : summary ? "✨ Write again" : "✨ Write note & parent message"}
            </button>
          </div>
          {photos ? (
            <p className="text-sm text-muted">
              {photoNames.length ? photoNames.join(" · ") : `${photos} ${photos === 1 ? "photo" : "photos"} of work`} — the AI reads each child&apos;s work separately.
            </p>
          ) : null}
          {!readPics ? (
            <label className="flex items-start gap-3 rounded-xl border border-[var(--th-todo,var(--warn))]/40 bg-warn-soft p-3 text-sm">
              <input type="checkbox" className="mt-0.5 h-5 w-5" checked={readPics} onChange={(e) => void allowPictures(e.target.checked)} />
              <span>
                <span className="font-medium">Let the AI read worksheet photos</span>
                <span className="block text-muted">
                  Needed to write from a photo. Names are never sent, but cover a name if a child wrote it on the page. (Same switch as in Settings.)
                </span>
              </span>
            </label>
          ) : null}
        </div>
      ) : null}
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
              {summary.pictures_read
                ? `Read from ${summary.pictures_read} ${summary.pictures_read === 1 ? "picture" : "pictures"}. AI can misread handwriting, so check before sending.`
                : "Written from your notes. Check before sending."}
            </p>
            <button type="button" className="btn-secondary" onClick={useNotes}>
              {used === "notes" || used === "both" ? "✓ In the empty note boxes below" : "Fill in the lesson notes"}
            </button>
          </div>

          <div className="space-y-2">
            <h3 className="font-medium">Part 1 · Message to the parent</h3>
            <textarea className="input min-h-48" value={message} onChange={(e) => setMessage(e.target.value)} />
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-primary" onClick={useMessage}>
                {used === "message" || used === "both" ? "✓ In the parent message box below" : "Put in the parent message box"}
              </button>
              <button type="button" className="btn-secondary" onClick={() => copy(message, "message")}>
                {copied === "message" ? "Copied ✓" : "Copy"}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="font-medium">Part 2 · The next worksheet</h3>
            <p className="text-sm text-muted">
              Aimed at today&apos;s mistakes. Make it here as a printable A4 page with an answer key (about 5 US cents), or copy the prompt into ChatGPT, Claude or
              Gemini.
            </p>
            <div className="flex flex-wrap gap-2">
              {aiEnabled ? (
                <button type="button" className="btn-primary" onClick={makeSheet} disabled={!!sheetStep}>
                  {sheetStep ? "Working…" : worksheets.length ? "📝 Make another worksheet" : "📝 Make the worksheet"}
                </button>
              ) : null}
              <button type="button" className="btn-secondary" onClick={() => copy(summary.worksheet_prompt, "prompt")}>
                {copied === "prompt" ? "Copied ✓" : "Copy worksheet prompt"}
              </button>
            </div>
            {sheetStep ? (
              <p role="status" className="rounded-xl bg-accent-soft p-3 text-sm text-accent">
                {sheetStep}
              </p>
            ) : null}
            {sheetError ? <p className="text-sm text-danger">{sheetError}</p> : null}
            {worksheets.length ? (
              <ul className="space-y-1">
                {worksheets.map((w) => (
                  <li key={w.id}>
                    <a href={`/print/worksheet/${w.id}`} target="_blank" rel="noopener" className="flex min-h-11 items-center justify-between rounded-xl bg-surface-2 px-3 text-sm">
                      <span>📝 {w.title}</span>
                      <span className="text-muted">Open to print ↗</span>
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
            <details className="text-sm">
              <summary className="cursor-pointer text-muted">See the worksheet prompt</summary>
              <textarea className="input mt-2 min-h-56 font-mono text-xs" value={summary.worksheet_prompt} readOnly />
            </details>
          </div>
        </div>
      ) : null}
    </section>
  );
}

/** A phone photo made smaller and turned into a JPG (quicker to upload; every format the AI can read). */
