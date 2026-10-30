"use client";
import { useMemo, useState } from "react";
import { PromptPayQR } from "./PromptPayQR";
import { SendButton } from "./SendButton";
import { addUnpaidPackage } from "@/app/actions/students";
import type { ChatApp } from "@/lib/chat";
import type { PriceOption } from "@/lib/prices";

type Offer = { hours: number; price: number | null; label?: string };
type Props = {
  parentName: string | null;
  names: string[];
  hoursLeft: number;
  lastHours: number | null;
  lastPrice: number | null;
  tutorName: string;
  promptpayId?: string | null;
  /** Packages to offer (from the price list); defaults to the last package. */
  offers?: Offer[];
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
  const offers = p.offers ?? (p.lastHours ? [{ hours: p.lastHours, price: p.lastPrice }] : []);
  const priced = offers.filter((o) => o.price != null);
  const offer =
    offers.length > 1
      ? `Would you like to renew? The packages are:\n${offers.map((o) => `• ${hrs(o.hours)}${o.price != null ? ` for ${thb(o.price)}` : ""}`).join("\n")}`
      : offers.length === 1
        ? offers[0].price != null
          ? p.offers
            ? `Would you like to renew? The package is ${hrs(offers[0].hours)} for ${thb(offers[0].price)}.`
            : `Would you like to renew? The same package is ${hrs(offers[0].hours)} for ${thb(offers[0].price)}.`
          : `Would you like to renew for another ${hrs(offers[0].hours)}?`
        : "Would you like to renew the package?";
  const pay = p.promptpayId && priced.length ? ` You can pay by scanning the PromptPay QR code${priced.length > 1 ? " for the package you choose" : ""}.` : "";
  return `Hi ${p.parentName?.trim() || "there"},

Just a quick update on lessons: ${status} ${offer}${pay}

Please let me know, and I'll keep the same lesson times. Thank you!

${p.tutorName}`;
}

/** Drafts a renewal message with the package options, PromptPay QR and a button to send it. */
export function RenewalMessage(
  props: Props & { priceList?: PriceOption[]; accountId?: string; contactApp?: ChatApp; contact?: string | null },
) {
  const choices = useMemo(() => {
    const list: (Offer & { key: string })[] = (props.priceList ?? []).map((o) => ({ key: o.id, hours: o.hours, price: o.price, label: o.label }));
    if (props.lastHours && !list.some((o) => o.hours === props.lastHours && o.price === props.lastPrice)) {
      list.unshift({ key: "last", hours: props.lastHours, price: props.lastPrice, label: "Same as last time" });
    }
    return list;
  }, [props.priceList, props.lastHours, props.lastPrice]);
  const [picked, setPicked] = useState<string[]>(() => (props.priceList?.length ? props.priceList.map((o) => o.id) : choices.slice(0, 1).map((c) => c.key)));
  const offers = choices.filter((c) => picked.includes(c.key));
  const [open, setOpen] = useState(false);
  const [edited, setEdited] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [added, setAdded] = useState<string | null>(null);
  const draft = renewalText({ ...props, offers });
  const text = edited ?? draft;

  if (!open) {
    return (
      <button type="button" className="btn-secondary w-full" onClick={() => setOpen(true)}>
        Draft renewal message
      </button>
    );
  }
  return (
    <div className="space-y-3 rounded-xl border border-line p-3">
      {choices.length ? (
        <div className="space-y-1">
          <span className="label">Packages to offer</span>
          <div className="flex flex-wrap gap-1.5">
            {choices.map((c) => {
              const on = picked.includes(c.key);
              return (
                <button
                  key={c.key}
                  type="button"
                  aria-pressed={on}
                  className={on ? "chip-accent min-h-9 px-3" : "chip min-h-9 px-3"}
                  onClick={() => {
                    setPicked((p) => (on ? p.filter((k) => k !== c.key) : [...p, c.key]));
                    setEdited(null);
                  }}
                >
                  {on ? "✓ " : ""}
                  {c.label ? `${c.label} · ` : ""}
                  {hrs(c.hours)}
                  {c.price != null ? ` · ${thb(c.price)}` : ""}
                </button>
              );
            })}
          </div>
          {!props.priceList?.length ? <p className="text-xs text-muted">Tip: add your package prices in Settings → Price list.</p> : null}
        </div>
      ) : null}
      <label className="block">
        <span className="label">Renewal message (edit if you like)</span>
        <textarea className="input min-h-56" value={text} onChange={(e) => setEdited(e.target.value)} />
      </label>
      {props.promptpayId ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {offers
            .filter((o) => o.price != null && o.price > 0)
            .map((o) => (
              <PromptPayQR key={`${o.hours}-${o.price}`} promptpayId={props.promptpayId!} amount={o.price!} label={`PromptPay · ${hrs(o.hours)}`} />
            ))}
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <SendButton app={props.contactApp} contact={props.contact} text={text} className="btn-primary flex-1" />
        <button
          type="button"
          className={`${copied ? "btn-primary" : "btn-secondary"} flex-1`}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(text);
              setCopied(true);
              setTimeout(() => setCopied(false), 2500);
            } catch {
              /* select the text so it can be copied by hand */
            }
          }}
        >
          {copied ? "✓ Copied" : "Copy message"}
        </button>
        <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>
          Close
        </button>
      </div>
      {props.accountId && offers.some((o) => o.price != null) ? (
        <div className="space-y-1 border-t border-line pt-3">
          <span className="label">When the parent says yes</span>
          <div className="flex flex-wrap gap-2">
            {offers
              .filter((o) => o.price != null)
              .map((o) => {
                const key = `${o.hours}-${o.price}`;
                return (
                  <button
                    key={key}
                    type="button"
                    className={added === key ? "btn-primary min-h-10 text-sm" : "btn-secondary min-h-10 text-sm"}
                    disabled={added === key}
                    onClick={async () => {
                      const r = await addUnpaidPackage(props.accountId!, o.hours, o.price!, o.label && o.label !== "Same as last time" ? o.label : "Renewal");
                      if (r.ok) setAdded(key);
                    }}
                  >
                    {added === key ? `✓ Added — waiting for payment` : `+ Add ${hrs(o.hours)} · ${thb(o.price!)} (not paid yet)`}
                  </button>
                );
              })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
