import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireTutor } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { tutorName } from "@/lib/env";
import { ReceiptActions } from "@/components/ReceiptActions";
import type { ChatApp } from "@/lib/chat";

export const metadata: Metadata = { title: "Receipt", robots: { index: false, follow: false } };

const PAID_BY: Record<string, string> = { bank_transfer: "Bank transfer", promptpay: "PromptPay", cash: "Cash", preply: "Preply", other: "Other" };
const thb = (n: number) => `฿${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const day = (d: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`));

/** A printable receipt for a paid package. */
export default async function ReceiptPage({ params }: PageProps<"/receipts/[id]">) {
  await requireTutor();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const supabase = await createClient();
  const { data: p } = await supabase.from("packages").select("*").eq("id", id).maybeSingle();
  if (!p) notFound();
  const { data: students } = await supabase.from("students").select("id, first_name, parent_name, contact_app, contact").eq("hour_account_id", p.hour_account_id).order("first_name");
  const names = (students ?? []).map((s) => s.first_name as string);
  const who = names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names.at(-1)}` : (names[0] ?? "");
  const parent = (students ?? []).map((s) => s.parent_name as string | null).find(Boolean) ?? null;
  const price = p.price_thb != null ? Number(p.price_thb) : null;
  const hours = Number(p.hours);
  const tutor = tutorName();
  const back = students?.[0] ? `/students/${students[0].id}#hours` : "/money";

  if (!p.paid_on) {
    return (
      <main className="mx-auto max-w-md space-y-3 px-4 py-10 text-center">
        <h1 className="h1">Not paid yet</h1>
        <p className="text-muted">Mark this package as paid first, then its receipt appears here.</p>
        <Link href={back} className="btn-secondary">
          ‹ Back
        </Link>
      </main>
    );
  }

  const lines = [
    `RECEIPT ${p.receipt_no ?? ""}`.trim(),
    `Date: ${day(p.paid_on)}`,
    `Received from: ${parent ?? "Parent"}${who ? ` (for ${who})` : ""}`,
    `For: ${hours} ${hours === 1 ? "hour" : "hours"} of maths tutoring${p.note ? ` — ${p.note}` : ""}`,
    `Amount: ${price != null ? thb(price) : "—"}`,
    `Paid by: ${PAID_BY[p.paid_by ?? ""] ?? "—"}`,
    `Thank you! — ${tutor}`,
  ];

  return (
    <main className="mx-auto max-w-xl space-y-6 px-4 py-8 print:max-w-none print:p-0">
      <div className="flex items-center justify-between print:hidden">
        <Link href={back} className="text-sm text-accent">
          ‹ Back
        </Link>
        <ReceiptActions
          text={lines.join("\n")}
          contact={students?.[0] ? { app: students[0].contact_app as ChatApp, value: (students[0].contact as string | null) ?? null } : undefined}
        />
      </div>

      <article className="space-y-6 rounded-2xl border border-line bg-white p-8 text-black print:rounded-none print:border-0">
        <header className="flex items-start justify-between gap-4 border-b border-gray-200 pb-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Receipt</h1>
            <p className="text-sm text-gray-600">Maths tutoring · {tutor}</p>
          </div>
          <div className="text-right text-sm">
            {p.receipt_no ? <p className="font-semibold">No. {p.receipt_no}</p> : null}
            <p className="text-gray-600">{day(p.paid_on)}</p>
          </div>
        </header>

        <dl className="grid grid-cols-[8rem_1fr] gap-y-3 text-sm">
          <dt className="text-gray-600">Received from</dt>
          <dd>{parent ?? "—"}</dd>
          <dt className="text-gray-600">Student</dt>
          <dd>{who || "—"}</dd>
          <dt className="text-gray-600">For</dt>
          <dd>
            {hours} {hours === 1 ? "hour" : "hours"} of maths tutoring{p.note ? ` — ${p.note}` : ""}
          </dd>
          <dt className="text-gray-600">Paid by</dt>
          <dd>{PAID_BY[p.paid_by ?? ""] ?? "—"}</dd>
        </dl>

        <div className="flex items-baseline justify-between border-t border-gray-200 pt-4">
          <span className="text-sm text-gray-600">Amount received</span>
          <span className="text-2xl font-semibold tabular-nums">{price != null ? thb(price) : "—"}</span>
        </div>

        <p className="text-sm text-gray-600">Thank you!</p>
      </article>
    </main>
  );
}
