"use client";
import { useEffect, useRef } from "react";
import { play } from "@/lib/sounds";

/**
 * A section folded away under one line (opened with a tap). Opens by itself when asked to (e.g. hours
 * running low) or when the page is opened at its #id (the Money page's "Draft message" link).
 */
export function Fold({ id, open = false, summary, children }: { id?: string; open?: boolean; summary: React.ReactNode; children: React.ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (id && window.location.hash === `#${id}` && ref.current) {
      ref.current.open = true;
      ref.current.scrollIntoView({ block: "start" });
    }
  }, [id]);
  return (
    <details ref={ref} id={id} open={open} className="glass group scroll-mt-24 rounded-[24px]" onToggle={() => play("flip")}>
      <summary className="flex min-h-16 cursor-pointer list-none items-center gap-3 px-5 py-4 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 flex-1">{summary}</span>
        <span aria-hidden className="text-accent transition-transform group-open:rotate-90">
          ›
        </span>
      </summary>
      <div className="px-5 pb-5">{children}</div>
    </details>
  );
}
