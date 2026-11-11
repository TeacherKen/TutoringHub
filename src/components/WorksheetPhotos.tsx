"use client";
import { isPhoto, PHOTO_ACCEPT, photoToJpeg } from "@/lib/photo";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { addMaterialFile } from "@/app/actions/lessons";
import { MATERIALS_BUCKET } from "@/lib/constants";
import { randomId } from "@/lib/randomId";

// Photos of printed worksheets: pick several at once (or take them with the iPad camera).
// Each one is made smaller and saved as a normal JPG, so it opens on any phone or computer —
// iPad photos are often HEIC, which many browsers can't show.

const MAX_SIDE = 1800;

async function shrink(file: File): Promise<Blob | null> {
  return photoToJpeg(file, MAX_SIDE).catch(() => null); // null: this browser can't read the photo
}

export function WorksheetPhotos({
  lessonId,
  label = "Worksheet",
  compact = false,
  kids = [],
}: {
  lessonId: string;
  label?: string;
  compact?: boolean;
  /** In a lesson with brothers and sisters: their names, so Mr Ken can say whose work the photos are. */
  kids?: string[];
}) {
  const [who, setWho] = useState<string>(""); // "" = both / everyone
  const [what, setWhat] = useState<"Worksheet" | "Homework">("Worksheet");
  const many = kids.length > 1;
  // e.g. "Jaian · Homework (2)"; one child (or the student page): the label given, as before
  const base = many ? `${who ? `${who} · ` : ""}${what}` : label;
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();

  async function upload(files: File[]) {
    setError(null);
    const supabase = createClient();
    let saved = 0;
    try {
      for (const [n, file] of files.entries()) {
        setStatus(`Saving photo ${n + 1} of ${files.length}…`);
        if (!isPhoto(file)) {
          setError(`"${file.name}" isn't a photo, so it was skipped.`);
          continue;
        }
        const small = await shrink(file);
        const blob =
          small ??
          (file.size < 15 * 1024 * 1024 &&
          /^image\/(jpeg|png|webp)$/.test(file.type)
            ? file
            : null);
        if (!blob) {
          setError(
            "One photo couldn't be read. Try taking it again, or use a JPG.",
          );
          continue;
        }
        const ext =
          blob.type === "image/png"
            ? "png"
            : blob.type === "image/webp"
              ? "webp"
              : "jpg";
        const path = `${lessonId}/${randomId()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from(MATERIALS_BUCKET)
          .upload(path, blob, {
            contentType: blob.type || "image/jpeg",
            upsert: false,
          });
        if (upErr) {
          setError("A photo didn't upload. Check the internet and try again.");
          continue;
        }
        const r = await addMaterialFile(
          lessonId,
          path,
          "photo",
          files.length > 1 ? `${base} (${n + 1})` : base,
        );
        if (r.error) setError(r.error);
        else saved++;
      }
    } catch {
      setError(
        "The internet dropped while saving. Check which photos arrived and try the rest again.",
      );
    }
    setStatus(
      saved
        ? `✓ ${saved} ${saved === 1 ? "photo" : "photos"} saved. Parents can see ${saved === 1 ? "it" : "them"} on the family page.`
        : null,
    );
    start(() => router.refresh());
  }

  return (
    <div className="space-y-1.5">
      {many ? (
        <div className="space-y-2 rounded-2xl bg-white/[0.04] p-2.5 ring-1 ring-white/10">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-sm text-muted">Whose?</span>
            {["", ...kids].map((k) => (
              <button key={k || "both"} type="button" aria-pressed={who === k} onClick={() => setWho(k)} className={`min-h-9 rounded-full px-3 text-sm font-semibold ${who === k ? "bg-accent text-white" : "bg-white/10"}`}>
                {k || "Both"}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-sm text-muted">What?</span>
            {(["Worksheet", "Homework"] as const).map((k) => (
              <button key={k} type="button" aria-pressed={what === k} onClick={() => setWhat(k)} className={`min-h-9 rounded-full px-3 text-sm font-semibold ${what === k ? "bg-accent text-white" : "bg-white/10"}`}>
                {k === "Worksheet" ? "Class work" : "Homework"}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      <button
        type="button"
        className={compact ? "btn-secondary" : "btn-primary w-full sm:w-auto"}
        onClick={() => input.current?.click()}
        disabled={!!status?.startsWith("Saving")}
      >
        {many ? `Add photos: ${who || "both"} · ${what === "Homework" ? "homework" : "class work"}` : "Add worksheet photos"}
      </button>
      <input
        ref={input}
        type="file"
        accept={PHOTO_ACCEPT}
        multiple
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          if (files.length) void upload(files.slice(0, 12));
        }}
      />
      {status ? <p className="text-sm text-muted">{status}</p> : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}
