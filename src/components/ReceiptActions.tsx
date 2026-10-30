"use client";
import { useState } from "react";

export function ReceiptActions({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-wrap gap-2 print:hidden">
      <button type="button" className="btn-primary" onClick={() => window.print()}>
        Print or save as PDF
      </button>
      <button
        type="button"
        className="btn-secondary"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 3000);
          } catch {
            /* select and copy by hand */
          }
        }}
      >
        {copied ? "Copied ✓" : "Copy as text"}
      </button>
    </div>
  );
}
