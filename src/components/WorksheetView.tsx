"use client";
import Link from "next/link";
import { useState } from "react";
import { numbered, type Worksheet, type WsQuestion } from "@/lib/worksheet";

// Calm and clean on purpose: black text, one accent colour, big clear numbers, room to work.
// Sized to fit on two A4 pages, with the answer key on its own page at the end.
const LINE_MM = 8;
const ruled = {
  backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent calc(${LINE_MM}mm - 1px), #d9dde3 calc(${LINE_MM}mm - 1px), #d9dde3 ${LINE_MM}mm)`,
  WebkitPrintColorAdjust: "exact",
  printColorAdjust: "exact",
} as const;

/** A question with ruled space for working and an answer line. */
function Question({ n, item, maxLines = 6 }: { n: number; item: WsQuestion; maxLines?: number }) {
  return (
    <div className="flex h-full break-inside-avoid flex-col py-1.5">
      <div className="flex gap-2">
        <span className="w-6 shrink-0 text-right text-[16px] font-semibold tabular-nums">{n}.</span>
        <p className="text-[15px] leading-snug">{item.q}</p>
      </div>
      <div className="ml-8 mt-1" style={{ ...ruled, height: `${Math.min(item.lines, maxLines) * LINE_MM}mm` }} aria-hidden />
      <p className="ml-8 mt-auto pt-1 text-right text-[13px]">
        Answer: <span className="inline-block w-28 border-b border-gray-500" />
      </p>
    </div>
  );
}

/** A quick warm-up question: just a line for the answer. */
function Quick({ n, item }: { n: number; item: WsQuestion }) {
  return (
    <div className="break-inside-avoid py-1.5">
      <div className="flex gap-2">
        <span className="w-6 shrink-0 text-right text-[16px] font-semibold tabular-nums">{n}.</span>
        <p className="text-[15px] leading-snug">{item.q}</p>
      </div>
      <p className="ml-8 mt-3 text-[13px]">
        <span className="inline-block w-full max-w-36 border-b border-gray-500" />
      </p>
    </div>
  );
}

function Heading({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-1 border-b border-gray-300 pb-1 text-[12px] font-semibold uppercase tracking-[0.12em] text-[#0f6b62]">{children}</h2>;
}

export function WorksheetView({ ws, backHref, tutor }: { ws: Worksheet; backHref: string; tutor: string }) {
  const [withKey, setWithKey] = useState(true);
  const all = numbered(ws);
  const part = (section: string) => all.filter((x) => x.section === section);

  return (
    <main className="min-h-dvh bg-surface-2 px-3 py-6 text-black print:bg-white print:p-0">
      <style>{`@page { size: A4; margin: 14mm 14mm 16mm; }`}</style>
      <div className="mx-auto mb-4 flex max-w-[210mm] flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href={backHref} className="text-sm text-accent">
          ‹ Back to the lesson
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="h-4 w-4" checked={withKey} onChange={(e) => setWithKey(e.target.checked)} />
            Answer key at the end
          </label>
          <button type="button" className="btn-primary" onClick={() => window.print()}>
            🖨 Print / Save as PDF
          </button>
        </div>
      </div>
      <p className="mx-auto mb-4 max-w-[210mm] text-sm text-muted print:hidden">
        AI wrote this, so check the answer key before using it. To use it on the smart slides, choose Save as PDF, then upload the PDF there.
      </p>

      <article className="mx-auto max-w-[210mm] bg-white px-[14mm] py-[12mm] shadow-sm print:max-w-none print:p-0 print:shadow-none">
        <header>
          <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#0f6b62]">Maths worksheet{ws.level ? ` · ${ws.level}` : ""}</p>
          <h1 className="mt-1 text-[26px] font-semibold leading-tight">{ws.title}</h1>
          {ws.intro ? <p className="mt-1 text-[15px] text-gray-700">{ws.intro}</p> : null}
          <div className="mt-4 flex gap-10 text-[15px]">
            <span>
              Name <span className="inline-block w-48 border-b border-gray-500" />
            </span>
            <span>
              Date <span className="inline-block w-32 border-b border-gray-500" />
            </span>
          </div>
        </header>

        {ws.tip ? (
          <p className="mt-5 border-l-4 border-[#0f6b62] bg-[#eef6f5] px-4 py-2.5 text-[15px]" style={{ WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }}>
            <span className="font-semibold">Remember: </span>
            {ws.tip}
          </p>
        ) : null}

        {part("Warm-up").length ? (
          <section className="mt-5 break-inside-avoid">
            <Heading>Warm-up</Heading>
            <div className="grid grid-cols-3 gap-x-4">
              {part("Warm-up").map((x) => (
                <Quick key={x.n} n={x.n} item={x.item} />
              ))}
            </div>
          </section>
        ) : null}

        {ws.example.q ? (
          <section className="mt-5 break-inside-avoid">
            <Heading>Worked example</Heading>
            <div className="py-1.5 text-[15px]">
              <p className="leading-snug">{ws.example.q}</p>
              <ol className="mt-1.5 list-decimal space-y-0.5 pl-6 text-gray-800">
                {ws.example.steps.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ol>
              {ws.example.answer ? <p className="mt-1.5 font-semibold">Answer: {ws.example.answer}</p> : null}
            </div>
          </section>
        ) : null}

        {part("Practice").length ? (
          <section className="mt-5">
            {/* The heading stays on the same page as the first row of questions. */}
            <div className="break-inside-avoid">
              <Heading>Practice</Heading>
              <div className="grid grid-cols-2 gap-x-6">
                {part("Practice")
                  .slice(0, 2)
                  .map((x) => (
                    <Question key={x.n} n={x.n} item={x.item} maxLines={4} />
                  ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-x-6">
              {part("Practice")
                .slice(2)
                .map((x) => (
                  <Question key={x.n} n={x.n} item={x.item} maxLines={4} />
                ))}
            </div>
          </section>
        ) : null}

        {part("Word problems").length ? (
          <section className="mt-5">
            {part("Word problems").map((x, i) => (
              <div key={x.n} className="break-inside-avoid">
                {i === 0 ? <Heading>Word problems</Heading> : null}
                <Question n={x.n} item={x.item} />
              </div>
            ))}
          </section>
        ) : null}

        {part("Challenge").length ? (
          <section className="mt-5 break-inside-avoid">
            <Heading>Challenge ★</Heading>
            {part("Challenge").map((x) => (
              <Question key={x.n} n={x.n} item={x.item} maxLines={5} />
            ))}
          </section>
        ) : null}

        <p className="mt-6 text-right text-[11px] text-gray-500">{tutor} · Maths</p>
      </article>

      {withKey ? (
        <article className="mx-auto mt-6 max-w-[210mm] break-before-page bg-white px-[14mm] py-[12mm] shadow-sm print:mt-0 print:max-w-none print:p-0 print:shadow-none">
          <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#0f6b62]">Answer key</p>
          <h2 className="mt-1 text-[22px] font-semibold">{ws.title}</h2>
          <ol className="mt-4 columns-3 gap-x-8 text-[15px]">
            {all.map((x) => (
              <li key={x.n} className="mb-2 flex gap-2 break-inside-avoid">
                <span className="w-7 shrink-0 text-right font-semibold tabular-nums">{x.n}.</span>
                <span>{x.item.answer}</span>
              </li>
            ))}
          </ol>
        </article>
      ) : null}
    </main>
  );
}
