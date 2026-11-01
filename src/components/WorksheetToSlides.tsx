"use client";
import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { MATERIALS_BUCKET } from "@/lib/constants";
import { createBoard } from "@/app/actions/boards";
import { randomId } from "@/lib/randomId";
import type { Worksheet } from "@/lib/worksheet";

/** 📤 Put the worksheet on the student's smart slides, ready to write on in the next lesson. */
export function WorksheetToSlides({ ws, studentId, name, lessonHref }: { ws: Worksheet; studentId: string; name: string; lessonHref: string }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    setError(null);
    try {
      setBusy("Making the pages…");
      const { worksheetToSlides, PAGE_W, PAGE_H } = await import("@/lib/worksheetSlides");
      const pages = await worksheetToSlides(ws);
      const boardId = randomId();
      const supabase = createClient();
      for (let i = 0; i < pages.length; i++) {
        setBusy(`Uploading page ${i + 1} of ${pages.length}…`);
        const { error: upErr } = await supabase.storage
          .from(MATERIALS_BUCKET)
          .upload(`boards/${studentId}/${boardId}/${i + 1}.jpg`, pages[i], { contentType: "image/jpeg", upsert: true });
        if (upErr) throw upErr;
      }
      setBusy("Saving…");
      const r = await createBoard(studentId, boardId, `Worksheet: ${ws.title}`, pages.length, PAGE_H / PAGE_W);
      if (r.error) throw new Error(r.error);
      setDone(true);
    } catch (e) {
      setError(e instanceof Error && e.message.includes("0009") ? e.message : "That didn't work. Check the internet and try again.");
    } finally {
      setBusy(null);
    }
  }

  if (done) {
    return (
      <p role="status" className="rounded-xl bg-accent-soft px-3 py-2 text-sm text-accent">
        ✓ On {name}&apos;s smart slides (without the answers). It shows in their room under Lesson.{" "}
        <Link href={lessonHref} className="underline">
          Back to the lesson
        </Link>
      </p>
    );
  }
  return (
    <div className="flex flex-col items-end gap-1">
      <button type="button" className="btn-secondary" onClick={send} disabled={!!busy}>
        {busy ? "Working…" : `📤 Put on ${name}'s smart slides`}
      </button>
      {busy ? <span className="text-xs text-muted">{busy}</span> : null}
      {error ? <span className="text-xs text-danger">{error}</span> : null}
    </div>
  );
}
