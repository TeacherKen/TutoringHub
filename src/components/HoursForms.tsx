"use client";
import { useActionState, useRef, useEffect, useState } from "react";
import { addAdjustment, addPackage, type FormState } from "@/app/actions/students";

function useResetOnOk(state: FormState) {
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);
  return ref;
}

export function PackageForm({ accountId, today }: { accountId: string; today: string }) {
  const [state, action, pending] = useActionState(addPackage, null);
  const ref = useResetOnOk(state);
  const [paid, setPaid] = useState(true);
  return (
    <form ref={ref} action={action} className="space-y-3">
      <input type="hidden" name="hour_account_id" value={accountId} />
      <div className="grid grid-cols-2 gap-3">
        <label>
          <span className="label">Hours bought</span>
          <input name="hours" type="number" step="0.25" min="0.25" inputMode="decimal" required className="input" placeholder="12" />
        </label>
        <label>
          <span className="label">Price (฿)</span>
          <input name="price_thb" type="number" step="1" min="0" inputMode="numeric" className="input" placeholder="33600" />
        </label>
        <label>
          <span className="label">Counts lessons from</span>
          <input name="start_date" type="date" required className="input" defaultValue={today} />
        </label>
        <label>
          <span className="label">Payment</span>
          <select name="payment" className="input" value={paid ? "paid" : "unpaid"} onChange={(e) => setPaid(e.target.value === "paid")}>
            <option value="paid">Paid</option>
            <option value="unpaid">Not paid yet</option>
          </select>
        </label>
        {paid ? (
          <>
            <label>
              <span className="label">Date paid</span>
              <input name="paid_on" type="date" className="input" defaultValue={today} />
            </label>
            <label>
              <span className="label">Paid by</span>
              <select name="paid_by" className="input" defaultValue="bank_transfer">
                <option value="bank_transfer">Bank transfer</option>
                <option value="promptpay">PromptPay</option>
                <option value="cash">Cash</option>
                <option value="preply">Preply</option>
                <option value="other">Other</option>
              </select>
            </label>
          </>
        ) : (
          <p className="col-span-2 self-center text-sm text-muted">It will show under &quot;Waiting for payment&quot; until you mark it paid.</p>
        )}
        <label className="col-span-2">
          <span className="label">Note (optional)</span>
          <input name="note" className="input" placeholder="e.g. Term 2 renewal" />
        </label>
      </div>
      {state?.error ? <p className="text-sm text-danger">{state.error}</p> : null}
      {state?.ok ? <p className="text-sm text-ok">{state.ok}</p> : null}
      <button className="btn-primary w-full" disabled={pending}>
        {pending ? "Saving…" : "Add package"}
      </button>
    </form>
  );
}

export function AdjustmentForm({ accountId }: { accountId: string }) {
  const [state, action, pending] = useActionState(addAdjustment, null);
  const ref = useResetOnOk(state);
  return (
    <form ref={ref} action={action} className="space-y-3">
      <input type="hidden" name="hour_account_id" value={accountId} />
      <div className="grid grid-cols-3 gap-3">
        <label>
          <span className="label">Hours</span>
          <input name="hours" type="number" step="0.25" inputMode="decimal" required className="input" placeholder="+1 or -0.5" />
        </label>
        <label className="col-span-2">
          <span className="label">Reason</span>
          <input name="reason" required className="input" placeholder="e.g. Free make-up lesson" />
        </label>
      </div>
      {state?.error ? <p className="text-sm text-danger">{state.error}</p> : null}
      {state?.ok ? <p className="text-sm text-ok">{state.ok}</p> : null}
      <button className="btn-secondary w-full" disabled={pending}>
        {pending ? "Saving…" : "Save adjustment"}
      </button>
    </form>
  );
}
