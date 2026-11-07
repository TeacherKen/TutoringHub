import { PromptPayQR } from "@/components/PromptPayQR";
import { MasteryGrid } from "@/components/MasteryGrid";
import { parseFact } from "@/lib/facts";
import { TrophyShelf } from "@/components/Trophies";
import type { FamilyNote, FamilyPage } from "@/lib/family";
import { NoteForm, NoteThread } from "@/components/FamilyNotes";
import { bkkDateKey, fmtDay, fmtTime } from "@/lib/time";

const thb = (n: number) => `฿${Math.round(n).toLocaleString("en-US")}`;
const hrs = (h: number) => `${Math.round(h * 100) / 100} ${Math.abs(h) === 1 ? "hour" : "hours"}`;

/** What a family sees on their private page. */
export function FamilyView({ f, tutor, token }: { f: FamilyPage; tutor: string; token: string }) {
  // Replies under a lesson update stay with it; everything else is in "Messages with Mr Ken".
  const shownLessons = new Set(f.messages.map((m) => m.lessonId));
  const under = (lessonId: string) => f.notes.filter((n) => n.lessonId === lessonId);
  const general = f.notes.filter((n) => !n.lessonId || !shownLessons.has(n.lessonId));
  const family = f.parentName ?? "You";
  const talk = { tutor, family, token };
  return (
    <main className="mx-auto max-w-2xl space-y-8 px-4 pb-12 pt-6">
      <header>
        <p className="text-sm text-muted">Maths with {tutor}</p>
        <h1 className="h1">{f.familyName}</h1>
      </header>

      {f.messages[0] ? (
        <section className="card space-y-3 border-accent" aria-labelledby="latest-h">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">Latest lesson update</p>
            <h2 id="latest-h" className="h2 mt-1">
              {fmtDay(f.messages[0].date)}
              {f.children.length > 1 ? <span className="font-normal text-muted"> · {f.messages[0].names.join(" & ")}</span> : null}
            </h2>
          </div>
          <UpdateBody m={f.messages[0]} />
          <Replies notes={under(f.messages[0].lessonId)} lessonId={f.messages[0].lessonId} {...talk} />
        </section>
      ) : null}

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

      {f.children.some((c) => c.facts.length || c.trophies.length) ? (
        <section className="space-y-3">
          <h2 className="h2">⚽ Times tables</h2>
          <p className="text-sm text-muted">Every square is one fact. Green means they know it quickly; red means it needs more practice.</p>
          {f.children
            .filter((c) => c.facts.length || c.trophies.length)
            .map((c) => {
              const tables = [...new Set(c.facts.map((x) => parseFact(x.fact)?.[0]).filter((t): t is number => t != null))].sort((a, b) => a - b);
              return (
                <div key={c.id} className="card space-y-2">
                  {f.children.length > 1 ? <h3 className="font-medium">{c.name}</h3> : null}
                  {tables.length ? <MasteryGrid progress={c.facts} tables={tables} /> : null}
                  {c.trophies.length ? (
                    <div className="space-y-2 pt-2">
                      <p className="text-sm font-medium">
                        Trophies won <span className="font-normal text-muted">· {c.stars} stars collected</span>
                      </p>
                      <TrophyShelf items={c.trophies} />
                    </div>
                  ) : null}
                </div>
              );
            })}
        </section>
      ) : null}

      {f.messages.length > 1 ? (
        <section className="space-y-3">
          <h2 className="h2">Earlier updates</h2>
          {f.messages.slice(1).map((m, i) => (
            <details key={i} className="card group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                <span className="font-medium">
                  {fmtDay(m.date)}
                  {f.children.length > 1 ? <span className="font-normal text-muted"> · {m.names.join(" & ")}</span> : null}
                </span>
                <span className="text-sm text-accent group-open:hidden">Read</span>
                <span className="hidden text-sm text-accent group-open:inline">Close</span>
              </summary>
              <div className="mt-3 space-y-3">
                <UpdateBody m={m} />
                <Replies notes={under(m.lessonId)} lessonId={m.lessonId} {...talk} />
              </div>
            </details>
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
                <span className="block px-2 py-1 text-xs text-muted">
                  <span className="font-medium text-ink">{w.label}</span> · {fmtDay(w.date)}
                </span>
              </a>
            ))}
          </div>
        </section>
      ) : null}

      <section id="messages" className="card space-y-3" aria-labelledby="msg-h">
        <div>
          <h2 id="msg-h" className="h2">
            💬 Messages with {tutor}
          </h2>
          <p className="mt-1 text-sm text-muted">Questions, news, or anything you&apos;d like {tutor} to know. He&apos;ll reply here.</p>
        </div>
        <NoteThread notes={general} me="parent" tutor={tutor} family={family} />
        <NoteForm who="parent" token={token} placeholder={`Write to ${tutor}…`} />
      </section>

      <p className="text-center text-xs text-muted">This page is private to your family. Please don&apos;t share the link.</p>
    </main>
  );
}

/** One lesson update: Mr Ken's message, then what was covered, homework and pictures of the work. */
function UpdateBody({ m }: { m: FamilyPage["messages"][number] }) {
  return (
    <div className="space-y-3">
      <p className="whitespace-pre-wrap leading-relaxed">{m.text}</p>
      {m.topics.length ? (
        <div className="space-y-1.5">
          <p className="text-sm font-medium">What we worked on</p>
          <div className="flex flex-wrap gap-1.5">
            {m.topics.map((t) => (
              <span key={t} className="chip-accent">
                {t}
              </span>
            ))}
          </div>
        </div>
      ) : null}
      {m.homework ? (
        <div className="rounded-xl bg-warn-soft p-3 text-sm">
          <span className="font-medium text-warn">Homework: </span>
          {m.homework}
        </div>
      ) : null}
      {m.photos.length
        ? // One group per child ("IP's worksheet", "IQ's worksheet"), so parents of siblings can see whose work is whose.
          Object.entries(
            m.photos.reduce<Record<string, typeof m.photos>>((g, p) => ({ ...g, [p.label]: [...(g[p.label] ?? []), p] }), {}),
          ).map(([label, pics]) => (
            <div key={label} className="space-y-1.5">
              <p className="text-sm font-semibold">
                📄 {label}
                {pics.length > 1 ? <span className="font-normal text-muted"> · {pics.length} photos</span> : null}
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {pics.map((p) => (
                  <a key={p.url} href={p.url} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-xl border border-line bg-white">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.url} alt={p.label} className="aspect-video w-full object-cover" loading="lazy" />
                  </a>
                ))}
              </div>
            </div>
          ))
        : null}
    </div>
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

/** Under a lesson update: the replies so far, and a small box to reply to it. */
function Replies({ notes, lessonId, tutor, family, token }: { notes: FamilyNote[]; lessonId: string; tutor: string; family: string; token: string }) {
  return (
    <div className="space-y-2 border-t border-line pt-3">
      <NoteThread notes={notes} me="parent" tutor={tutor} family={family} />
      <details className="group" open={notes.length > 0}>
        <summary className="cursor-pointer list-none text-sm font-medium text-accent group-open:hidden">💬 Reply to {tutor}</summary>
        <NoteForm who="parent" token={token} lessonId={lessonId} placeholder={`Reply to ${tutor} about this lesson…`} />
      </details>
    </div>
  );
}
