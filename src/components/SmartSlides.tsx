"use client";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { MATERIALS_BUCKET } from "@/lib/constants";
import { createBoard, deleteBoard, listBoards, setCurrentBoard, type BoardSummary } from "@/app/actions/boards";
import { Whiteboard } from "./Whiteboard";

const MAX_MB = 40;

/** Mr Ken's controls for a student's smart slides: upload a PDF, watch and write live. */
export function SmartSlides({ studentId, name, currentId, lessonId }: { studentId: string; name: string; currentId: string | null; lessonId?: string | null }) {
  const [current, setCurrent] = useState<string | null>(currentId);
  const [boards, setBoards] = useState<BoardSummary[]>([]);
  const [ready, setReady] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = async () => {
    const r = await listBoards(studentId);
    setBoards(r.boards);
    setReady(r.ready);
  };
  useEffect(() => {
    let alive = true;
    listBoards(studentId).then((r) => {
      if (!alive) return;
      setBoards(r.boards);
      setReady(r.ready);
    });
    return () => {
      alive = false;
    };
  }, [studentId]);

  async function upload(file: File) {
    setError(null);
    if (file.type !== "application/pdf") return setError("Please choose a PDF. In Canva: Share → Download → PDF Standard.");
    if (file.size > MAX_MB * 1024 * 1024) return setError(`That PDF is over ${MAX_MB} MB.`);
    try {
      setBusy("Reading the PDF…");
      const { pdfToImages } = await import("@/lib/pdfPages");
      const pages = await pdfToImages(file, (d, t) => setBusy(`Preparing page ${d} of ${t}…`));
      if (!pages.length) throw new Error("empty");
      const boardId = crypto.randomUUID();
      const supabase = createClient();
      for (let i = 0; i < pages.length; i++) {
        setBusy(`Uploading page ${i + 1} of ${pages.length}…`);
        const { error: upErr } = await supabase.storage
          .from(MATERIALS_BUCKET)
          .upload(`boards/${studentId}/${boardId}/${i + 1}.jpg`, pages[i].blob, { contentType: "image/jpeg", upsert: true });
        if (upErr) throw upErr;
      }
      setBusy("Saving…");
      const r = await createBoard(studentId, boardId, file.name.replace(/\.pdf$/i, ""), pages.length, pages[0].height / pages[0].width);
      if (r.error) throw new Error(r.error);
      setCurrent(boardId);
      setOpen(true);
      await refresh();
    } catch (e) {
      setError(e instanceof Error && e.message.includes("0009") ? e.message : "That didn't work. Please try again, or try a smaller PDF.");
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const cur = boards.find((b) => b.id === current);

  return (
    <div className="space-y-2">
      <span className="label">Smart slides ({name} can write on them, you watch live)</span>
      {!ready ? <p className="rounded-xl bg-warn-soft p-3 text-sm text-warn">Run database update 0009 to use smart slides.</p> : null}
      {cur ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="chip-accent max-w-full truncate">
            {cur.title} · {cur.pages} {cur.pages === 1 ? "page" : "pages"}
          </span>
          <button type="button" className={open ? "btn-secondary min-h-10 px-3 text-sm" : "btn-primary min-h-10 px-3 text-sm"} onClick={() => setOpen(!open)}>
            {open ? "Hide" : "Watch & write"}
          </button>
        </div>
      ) : (
        <p className="text-sm text-muted">In Canva: Share → Download → PDF. Then upload it here.</p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <input ref={fileRef} type="file" accept="application/pdf" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
        <button type="button" className="btn-secondary min-h-10 px-3 text-sm" disabled={!!busy || !ready} onClick={() => fileRef.current?.click()}>
          {cur ? "Upload new PDF" : "Upload PDF"}
        </button>
        {cur ? (
          <button
            type="button"
            className="text-xs text-muted underline"
            onClick={async () => {
              if ((await setCurrentBoard(studentId, null)).ok) {
                setCurrent(null);
                setOpen(false);
              }
            }}
          >
            Stop showing in {name}&apos;s room
          </button>
        ) : null}
      </div>
      {busy ? <p className="text-sm text-accent">{busy}</p> : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}

      {open && cur ? (
        <div className="rounded-xl border border-line bg-bg p-2">
          <Whiteboard key={cur.id} api={`/api/board/${cur.id}`} me="tutor" otherName={name} saveLessonId={lessonId} />
        </div>
      ) : null}

      {boards.filter((b) => b.id !== current).length ? (
        <details className="text-sm">
          <summary className="cursor-pointer text-muted">Earlier smart slides ({boards.filter((b) => b.id !== current).length})</summary>
          <ul className="mt-2 space-y-1">
            {boards
              .filter((b) => b.id !== current)
              .map((b) => (
                <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-surface p-2">
                  <span className="truncate">
                    {b.title} · {new Date(b.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                  </span>
                  <span className="flex gap-3">
                    <button
                      type="button"
                      className="text-accent underline"
                      onClick={async () => {
                        if ((await setCurrentBoard(studentId, b.id)).ok) {
                          setCurrent(b.id);
                          setOpen(true);
                        }
                      }}
                    >
                      Show again
                    </button>
                    <button
                      type="button"
                      className="text-muted underline"
                      onClick={async () => {
                        if (confirm(`Delete "${b.title}" and ${name}'s writing on it?`) && (await deleteBoard(b.id)).ok) await refresh();
                      }}
                    >
                      Delete
                    </button>
                  </span>
                </li>
              ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
