import { PromptPayQR } from "@/components/PromptPayQR";
import type { FamilyPage } from "@/lib/family";
import { bkkDateKey, fmtDay, fmtTime } from "@/lib/time";

const thb = (n: number) => `฿${Math.round(n).toLocaleString("en-US")}`;
const hrs = (h: number) => `${Math.round(h * 100) / 100} ${Math.abs(h) === 1 ? "hour" : "hours"}`;

/** What a family sees on their private page. */
export function FamilyView({ f, tutor }: { f: FamilyPage; tutor: string }) {
  return (
    <main className="mx-auto max-w-2xl space-y-8 px-4 pb-12 pt-6">
      <header>
        <p className="text-sm text-muted">Maths with {tutor}</p>
        <h1 className="h1">{f.familyName}</h1>
      </header>

      {f.hours ? (
        <section className="card space-y-2">
          <h2 className="h2">Lesson package</h2>
          {f.hours.left > 0 ? (
            <>
              <p className="text-lg">
                <strong>{hrs(f.hours.left)}</strong> left
                <span className="text-muted"> of {hrs(f.hours.bought)}</span>
              </p>
              <div className="h-2.5 overflow-hidden rounded-full bg-surface-2">
                <div className="h-full rounded-full bg-accent" style={{ width: `${Math.max(3, Math.min(100, Math.round((f.hours.left / Math.max(1, f.hours.bought)) * 100)))}%` }} />
              </div>
              {f.hours.endDate ? (
                <p className="text-sm text-muted">
                  About {f.hours.lessonsLeft} more {f.hours.lessonsLeft === 1 ? "lesson" : "lessons"} — until around {fmtDay(f.hours.endDate)}.
                </p>
              ) : null}
            </>
          ) : (
            <p>The current package has been used up.</p>
          )}
          {f.unpaid.map((u) => (
            <div key={`${u.hours}-${u.price}`} className="space-y-2 rounded-xl bg-warn-soft p-3">
              <p className="text-warn">
                Next package: {hrs(u.hours)} · <strong>{thb(u.price)}</strong> — waiting for payment
              </p>
              {f.promptpayId ? (
                <div className="max-w-xs">
                  <PromptPayQR promptpayId={f.promptpayId} amount={u.price} label={`PromptPay · ${thb(u.price)}`} />
                </div>
              ) : null}
            </div>
          ))}
        </section>
      ) : null}

      {f.upcoming.length ? (
        <section className="space-y-2">
          <h2 className="h2">Next lessons</h2>
          <ul className="card divide-y divide-line p-0">
            {f.upcoming.map((l) => (
              <li key={l.start_at} className="flex justify-between gap-3 px-4 py-3 text-sm">
                <span>
                  {fmtDay(bkkDateKey(l.start_at))}
                  {f.children.length > 1 ? <span className="text-muted"> · {l.names.join(" & ")}</span> : null}
                </span>
                <span className="tabular-nums text-muted">
                  {fmtTime(l.start_at)}–{fmtTime(l.end_at)}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted">Times are Bangkok time.</p>
        </section>
      ) : null}

      {f.children.some((c) => c.progress.length) ? (
        <section className="space-y-3">
          <h2 className="h2">Progress</h2>
          {f.children
            .filter((c) => c.progress.length)
            .map((c) => {
              const got = c.progress.filter((r) => r.status === "got_it");
              const learning = c.progress.filter((r) => r.status === "learning");
              const next = c.progress.filter((r) => r.status === "next");
              return (
                <div key={c.id} className="card space-y-3">
                  {f.children.length > 1 ? <h3 className="font-medium">{c.name}</h3> : null}
                  {got.length ? <Topics title={`Confident with (${got.length})`} items={got.map((r) => r.name)} tone="chip-ok" mark="✓ " /> : null}
                  {learning.length ? <Topics title="Practising now" items={learning.map((r) => r.name)} tone="chip-warn" /> : null}
                  {next.length ? <Topics title="Coming up" items={next.map((r) => r.name)} tone="chip" /> : null}
                </div>
              );
            })}
        </section>
      ) : null}

      {f.messages.length ? (
        <section className="space-y-3">
          <h2 className="h2">Messages from {tutor}</h2>
          {f.messages.map((m, i) => (
            <article key={i} className="card space-y-2">
              <p className="text-xs text-muted">
                {fmtDay(m.date)}
                {f.children.length > 1 ? ` · ${m.names.join(" & ")}` : ""}
              </p>
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{m.text}</p>
            </article>
          ))}
        </section>
      ) : null}

      {f.work.length ? (
        <section className="space-y-3">
          <h2 className="h2">Work from lessons</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {f.work.map((w) => (
              <a key={w.url} href={w.url} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-xl border border-line bg-white">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={w.url} alt={`${w.label}, ${fmtDay(w.date)}`} className="aspect-video w-full object-cover" loading="lazy" />
                <span className="block px-2 py-1 text-xs text-muted">{fmtDay(w.date)}</span>
              </a>
            ))}
          </div>
        </section>
      ) : null}

      <p className="text-center text-xs text-muted">This page is private to your family. Please don&apos;t share the link.</p>
    </main>
  );
}

function Topics({ title, items, tone, mark = "" }: { title: string; items: string[]; tone: string; mark?: string }) {
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium">{title}</p>
      <div className="flex flex-wrap gap-1.5">
        {items.map((t) => (
          <span key={t} className={tone}>
            {mark}
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}
