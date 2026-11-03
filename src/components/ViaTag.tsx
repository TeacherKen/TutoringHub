import { lessonVia, type Lesson } from "@/lib/data";

/** A small tag saying how the lesson happens: Preply, Google Meet (or Zoom / Teams), or the onsite place. */
export function ViaTag({ lesson, size = "sm", plainOnsite = true }: { lesson: Lesson; size?: "xs" | "sm"; plainOnsite?: boolean }) {
  const v = lessonVia(lesson);
  return <Via kind={v.kind} label={v.label} size={size} plainOnsite={plainOnsite} />;
}

export function Via({ kind, label, size = "sm", plainOnsite = true }: { kind: ReturnType<typeof lessonVia>["kind"]; label: string | null; size?: "xs" | "sm"; plainOnsite?: boolean }) {
  if (!label) return null;
  const pad = size === "xs" ? "px-1.5 py-0 text-[11px]" : "";
  if (kind === "onsite" && plainOnsite) return <span>{label}</span>;
  if (kind === "preply") return <span className={`chip-accent ${pad}`}>Preply</span>;
  if (kind === "meet" || kind === "zoom" || kind === "teams")
    return (
      <span className={`chip-meet ${pad}`}>
        <svg viewBox="0 0 24 24" className="mr-1 inline h-3 w-3 align-[-1px]" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <rect x="3" y="6" width="12" height="12" rx="2" />
          <path d="m15 10 6-3v10l-6-3" />
        </svg>
        {label}
      </span>
    );
  return <span className={`chip ${pad}`}>{label}</span>;
}
