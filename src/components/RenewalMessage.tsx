"use client";
import { useState } from "react";
import { PromptPayQR } from "./PromptPayQR";

type Props = {
  parentName: string | null;
  names: string[];
  hoursLeft: number;
  lastHours: number | null;
  lastPrice: number | null;
  tutorName: string;
  promptpayId?: string | null;
};

const thb = (n: number) => `฿${Math.round(n).toLocaleString("en-US")}`;
const hrs = (h: number) => `${Math.round(h * 100) / 100} ${Math.abs(h) === 1 ? "hour" : "hours"}`;

export function renewalText(p: Props): string {
  const who = p.names.length > 1 ? `${p.names.slice(0, -1).join(", ")} and ${p.names.at(-1)}` : (p.names[0] ?? "your child");
  const has = p.names.length > 1 ? "have" : "has";
  const status =
    p.hoursLeft > 0
      ? `${who} ${has} ${hrs(p.hoursLeft)} left in the current package.`
      : p.hoursLeft === 0
        ? `${who} ${has} now used all the hours in the current package.`
        : `${who} ${has} used all the package hours, plus ${hrs(-p.hoursLeft)} extra.`;
  const offer =
    p.lastHours && p.lastPrice != null
      ? `Would you like to renew? The same package is ${hrs(p.lastHours)} for ${thb(p.lastPrice)}.`
      : p.lastHours
        ? `Would you like to renew for another ${hrs(p.lastHours)}?`
        : "Would you like to renew the package?";
  const pay = p.promptpayId && p.lastPrice ? " You can pay by scanning the PromptPay QR code." : "";
  return `Hi ${p.parentName?.trim() || "there"},

Just a quick update on lessons: ${status} ${offer}${pay}

Please let me know, and I'll keep the same lesson times. Thank you!

${p.tutorName}`;
}

/** One tap drafts a polite renewal message to paste into WhatsApp or LINE. */
export function RenewalMessage(props: Props) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(() => renewalText(props));
  const [copied, setCopied] = useState(false);
  if (!open) {
    return (
      <button type="button" className="btn-secondary w-full" onClick={() => setOpen(true)}>
        Draft renewal message
      </button>
    );
  }
  return (
    <div className="space-y-2 rounded-xl border border-line p-3">
      <span className="label">Renewal message (edit if you like)</span>
      <textarea className="input min-h-56" value={text} onChange={(e) => setText(e.target.value)} />
      {props.promptpayId && props.lastPrice ? (
        <PromptPayQR promptpayId={props.promptpayId} amount={props.lastPrice} label="PromptPay QR for the next package" />
      ) : null}
      <div className="flex gap-2">
        <button
          type="button"
          className="btn-primary flex-1"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(text);
              setCopied(true);
              setTimeout(() => setCopied(false), 3000);
            } catch {
              /* select the text so it can be copied by hand */
            }
          }}
        >
          {copied ? "Copied ✓" : "Copy message"}
        </button>
        <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>
          Close
        </button>
      </div>
    </div>
  );
}
