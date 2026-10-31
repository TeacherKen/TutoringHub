"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { addMaterialFile, addMaterialLink, removeMaterial } from "@/app/actions/lessons";
import { MATERIALS_BUCKET } from "@/lib/constants";
import { WorksheetPhotos } from "./WorksheetPhotos";

export type MaterialView = { id: string; kind: "canva" | "pdf" | "photo" | "link"; label: string; href: string | null };

const ICON: Record<MaterialView["kind"], string> = { canva: "Canva", pdf: "PDF", photo: "Photo", link: "Link" };
const MAX_MB = 15;
const EXT_BY_TYPE: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/heic": "heic",
  "image/heif": "heif",
  "image/webp": "webp",
};

export function Materials({ lessonId, items }: { lessonId: string; items: MaterialView[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();
  const pdfRef = useRef<HTMLInputElement>(null);
  const linkForm = useRef<HTMLFormElement>(null);

  async function upload(file: File, kind: "pdf" | "photo") {
    setError(null);
    if (file.size > MAX_MB * 1024 * 1024) return setError(`That file is over ${MAX_MB} MB.`);
    if (kind === "pdf" && file.type !== "application/pdf") return setError("Please choose a PDF file.");
    if (kind === "photo" && (!file.type.startsWith("image/") || !EXT_BY_TYPE[file.type])) {
      return setError("Please choose a JPG, PNG or HEIC photo.");
    }
    setBusy(kind === "pdf" ? "Uploading worksheet…" : "Uploading photo…");
    try {
      const ext = EXT_BY_TYPE[file.type];
      if (!ext) throw new Error("type");
      const path = `${lessonId}/${crypto.randomUUID()}.${ext}`;
      const supabase = createClient();
      const { error: upErr } = await supabase.storage.from(MATERIALS_BUCKET).upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) throw upErr;
      const label = kind === "pdf" ? file.name.replace(/\.pdf$/i, "").slice(0, 120) : "Photo of work";
      const r = await addMaterialFile(lessonId, path, kind, label);
      if (r.error) throw new Error(r.error);
      start(() => router.refresh());
    } catch {
      setError("Upload didn't work. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="card space-y-4">
      <h2 className="h2">Worksheets and materials</h2>
      {items.length ? (
        <ul className="space-y-2">
          {items.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-3 rounded-xl bg-surface-2 p-3">
              {m.href ? (
                <a href={m.href} target="_blank" rel="noopener noreferrer" className="flex min-w-0 items-center gap-2">
                  <span className="chip-accent shrink-0">{ICON[m.kind]}</span>
                  <span className="truncate underline-offset-2 hover:underline">{m.label || ICON[m.kind]}</span>
                </a>
              ) : (
                <span className="text-sm text-muted">{m.label} (unavailable)</span>
              )}
              <form action={removeMaterial}>
                <input type="hidden" name="id" value={m.id} />
                <button className="text-xs text-muted underline">Remove</button>
              </form>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">No materials yet.</p>
      )}

      <form
        ref={linkForm}
        action={async (fd) => {
          setError(null);
          const r = await addMaterialLink(fd);
          if (r.error) setError(r.error);
          else linkForm.current?.reset();
        }}
        className="flex gap-2"
      >
        <input type="hidden" name="lesson_id" value={lessonId} />
        <input name="url" type="url" inputMode="url" required className="input" placeholder="Paste a Canva link" />
        <button className="btn-secondary shrink-0">Add link</button>
      </form>

      <div className="flex flex-wrap items-start gap-2">
        <button type="button" className="btn-secondary" onClick={() => pdfRef.current?.click()} disabled={Boolean(busy)}>
          Upload PDF
        </button>
        <WorksheetPhotos lessonId={lessonId} compact />
      </div>
      <input
        ref={pdfRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) upload(f, "pdf");
          e.target.value = "";
        }}
      />
      {busy ? <p className="text-sm text-muted">{busy}</p> : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <p className="text-xs text-muted">Files are private. Links to open them only work for a few minutes.</p>
    </section>
  );
}
