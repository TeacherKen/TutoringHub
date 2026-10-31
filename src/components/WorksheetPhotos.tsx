"use client";
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
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas
      .getContext("2d")!
      .drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    return await new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/jpeg", 0.85),
    );
  } catch {
    return null; // this browser can't read the photo
  }
}

export function WorksheetPhotos({
  lessonId,
  label = "Worksheet",
  compact = false,
}: {
  lessonId: string;
  label?: string;
  compact?: boolean;
}) {
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
        if (
          !file.type.startsWith("image/") &&
          !/\.(heic|heif)$/i.test(file.name)
        )
          continue;
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
          files.length > 1 ? `${label} (${n + 1})` : label,
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
      <button
        type="button"
        className={compact ? "btn-secondary" : "btn-primary w-full sm:w-auto"}
        onClick={() => input.current?.click()}
        disabled={!!status?.startsWith("Saving")}
      >
        📸 Add worksheet photos
      </button>
      <input
        ref={input}
        type="file"
        accept="image/*"
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
