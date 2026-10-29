"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { addMaterialFile, addMaterialLink, removeMaterial } from "@/app/actions/lessons";

export type MaterialView = { id: string; kind: "canva" | "pdf" | "photo" | "link"; label: string; href: string | null };

const ICON: Record<MaterialView["kind"], string> = { canva: "Canva", pdf: "PDF", photo: "Photo", link: "Link" };
const MAX_MB = 15;

export function Materials({ lessonId, items }: { lessonId: string; items: MaterialView[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();
  const pdfRef = useRef<HTMLInputElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const linkForm = useRef<HTMLFormElement>(null);

  async function upload(file: File, kind: "pdf" | "photo") {
    setError(null);
    if (file.size > MAX_MB * 1024 * 1024) return setError(`That file is over ${MAX_MB} MB.`);
    if (kind === "pdf" && file.type !== "application/pdf") return setError("Please choose a PDF file.");
    if (kind === "photo" && !file.type.startsWith("image/")) return setError("Please choose a photo.");
    setBusy(kind === "pdf" ? "Uploading worksheet…" : "Uploading photo…");
    try {
      const ext = (file.name.split(".").pop() || (kind === "pdf" ? "pdf" : "jpg")).toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5) || "bin";
      const path = `${lessonId}/${crypto.randomUUID()}.${ext}`;
      const supabase = createClient();
      const { error: upErr } = await supabase.storage.from("materials").upload(path, file, { contentType: file.type, upsert: false });
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

      <div className="grid grid-cols-2 gap-2">
        <button type="button" className="btn-secondary" onClick={() => pdfRef.current?.click()} disabled={Boolean(busy)}>
          Upload PDF
        </button>
        <button type="button" className="btn-secondary" onClick={() => photoRef.current?.click()} disabled={Boolean(busy)}>
          Photo of work
        </button>
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
      <input
        ref={photoRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) upload(f, "photo");
          e.target.value = "";
        }}
      />
      {busy ? <p className="text-sm text-muted">{busy}</p> : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <p className="text-xs text-muted">Files are private. Links to open them only work for a few minutes.</p>
    </section>
  );
}
