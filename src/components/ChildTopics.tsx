"use client";
import { useState, useTransition } from "react";
import { setChildTopics } from "@/app/actions/lessons";
import { play } from "@/lib/sounds";

// 👦👦 Brothers and sisters in one lesson often work on different things (one on times tables, one on
// fractions). Tap a topic under a child's name to say whether they worked on it. This is what each
// child's Progress (and the family page) shows.

type Kid = { id: string; name: string; topics: string[] | null };

export function ChildTopics({ lessonId, kids, lessonTopics }: { lessonId: string; kids: Kid[]; lessonTopics: string[] }) {
  // Nothing chosen yet for a child = every lesson topic counts for them (how it worked before).
  const [mine, setMine] = useState<Record<string, string[]>>(() => Object.fromEntries(kids.map((k) => [k.id, k.topics?.length ? k.topics : lessonTopics])));
  const [, start] = useTransition();
  const all = [...new Set([...lessonTopics, ...Object.values(mine).flat()])];
  if (kids.length < 2 || !all.length) return null;

  function toggle(kid: string, t: string) {
    const now = mine[kid] ?? [];
    const next = now.includes(t) ? now.filter((x) => x !== t) : [...now, t];
    play("toggle");
    setMine((m) => ({ ...m, [kid]: next }));
    start(async () => {
      const r = await setChildTopics(lessonId, kid, next).catch(() => ({ ok: false }));
      if (!r?.ok) {
        setMine((m) => ({ ...m, [kid]: now }));
        alert("Couldn't save that — check the internet and try again.");
      }
    });
  }

  return (
    <section className="card space-y-3">
      <div>
        <h2 className="h2">Who worked on what</h2>
        <p className="mt-1 text-sm text-muted">Tap to switch a topic on or off for each child. Their Progress and the family page follow this.</p>
      </div>
      {kids.map((k) => (
        <div key={k.id} className="space-y-1.5">
          <p className="font-semibold">{k.name}</p>
          <div className="flex flex-wrap gap-1.5">
            {all.map((t) => {
              const on = (mine[k.id] ?? []).includes(t);
              return (
                <button key={t} type="button" aria-pressed={on} onClick={() => toggle(k.id, t)} className={`press min-h-11 ${on ? "chip-accent" : "chip opacity-60 line-through"}`}>
                  {on ? "✓ " : ""}
                  {t}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </section>
  );
}
