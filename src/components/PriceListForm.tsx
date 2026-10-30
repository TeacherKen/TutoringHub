"use client";
import { useState, useTransition } from "react";
import { savePriceOptions } from "@/app/actions/settings";
import type { PriceOption } from "@/lib/prices";

const newId = () => Math.random().toString(36).slice(2, 10);

/** Settings: the packages Mr Ken offers, used in renewal messages and PromptPay QR codes. */
export function PriceListForm({ initial }: { initial: PriceOption[] }) {
  const [rows, setRows] = useState<{ id: string; label: string; hours: string; price: string }[]>(() =>
    initial.length ? initial.map((o) => ({ id: o.id, label: o.label, hours: String(o.hours), price: String(o.price) })) : [{ id: newId(), label: "", hours: "", price: "" }],
  );
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = (i: number, k: "label" | "hours" | "price", v: string) => setRows((r) => r.map((x, j) => (j === i ? { ...x, [k]: v } : x)));

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {rows.map((r, i) => (
          <div key={r.id} className="grid grid-cols-[1fr_5rem_7rem_2.5rem] items-end gap-2">
            <label>
              {i === 0 ? <span className="label">Name (optional)</span> : null}
              <input className="input" value={r.label} onChange={(e) => set(i, "label", e.target.value)} placeholder="e.g. Onsite" maxLength={40} />
            </label>
            <label>
              {i === 0 ? <span className="label">Hours</span> : null}
              <input className="input" type="number" min="0.5" step="0.5" inputMode="decimal" value={r.hours} onChange={(e) => set(i, "hours", e.target.value)} placeholder="12" />
            </label>
            <label>
              {i === 0 ? <span className="label">Price (฿)</span> : null}
              <input className="input" type="number" min="0" step="1" inputMode="numeric" value={r.price} onChange={(e) => set(i, "price", e.target.value)} placeholder="33600" />
            </label>
            <button type="button" className="btn-quiet h-12 px-0" aria-label="Remove" onClick={() => setRows((x) => x.filter((_, j) => j !== i))}>
              ✕
            </button>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn-secondary" onClick={() => setRows((r) => [...r, { id: newId(), label: "", hours: "", price: "" }])}>
          + Add a package option
        </button>
        <button
          type="button"
          className="btn-primary"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await savePriceOptions(
                rows.filter((x) => x.hours && x.price).map((x) => ({ id: x.id, label: x.label, hours: Number(x.hours), price: Number(x.price) })),
              );
              setMsg(r.ok ?? r.error ?? null);
            })
          }
        >
          {pending ? "Saving…" : "Save price list"}
        </button>
        {msg ? <span className="text-sm text-accent">{msg}</span> : null}
      </div>
    </div>
  );
}
