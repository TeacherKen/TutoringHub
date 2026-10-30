"use client";
import { useState } from "react";
import { SendButton } from "./SendButton";
import type { ChatApp } from "@/lib/chat";

export function ReceiptActions({ text, contact }: { text: string; contact?: { app: ChatApp; value: string | null } }) {
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
      {contact ? <SendButton app={contact.app} contact={contact.value} text={text} className="btn-secondary" /> : null}
    </div>
  );
}
