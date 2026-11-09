"use client";
import { useEffect, useRef, useState } from "react";
import { clockHint, hhmm, ampm, same, STEP, type Time } from "@/lib/clock";
import { HEARTS, HEROES, HITS, longHint, newQuest, questQ, stageKey, stageOpen, STAGES, starsFor, story, totalStars, TOWNS, townDone, townOpen, type QuestQ, type QuestSave } from "@/lib/games/clockQuest";
import { Choices, ClockFace } from "./ClockRescue";
import { NumberPad } from "./NumberPad";
import { useSaves } from "./useSaves";

// 🏰 Clock Tower Quest: a hero walks from Sunny Village to Dragon Castle. Each monster is beaten with
// 3 right answers about time; a wrong answer and the monster hits back (lose a heart, get a hint).
// Clear a town and a pet joins your team. Progress is saved per player on this device.

type Save = QuestSave & { name: string };
type Fight = { town: number; stage: number; q: QuestQ; story: string; hits: number; hearts: number; set: Time; answer: string; wrong: boolean; wrongPick: number | null; hit: "hero" | "foe" | null };

const ANIM = `@keyframes cq-shake{0%,100%{transform:none}20%{transform:translateX(-8px) rotate(-6deg)}40%{transform:translateX(8px) rotate(6deg)}60%{transform:translateX(-5px)}80%{transform:translateX(5px)}}
@keyframes cq-pop{0%{transform:scale(.6);opacity:0}60%{transform:scale(1.15);opacity:1}100%{transform:scale(1)}}
@keyframes cq-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}`;

function Hearts({ n, max = HEARTS }: { n: number; max?: number }) {
  return (
    <span aria-label={`${n} hearts left`}>
      {"❤️".repeat(n)}
      <span className="opacity-25">{"🖤".repeat(Math.max(0, max - n))}</span>
    </span>
  );
}

export function ClockQuest() {
  const winTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (winTimer.current) clearTimeout(winTimer.current);
  }, []);

  const { all, save, remove } = useSaves<Save>("clock-quest");
  const [player, setPlayer] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newHero, setNewHero] = useState<string>(HEROES[0]);
  const [fight, setFight] = useState<Fight | null>(null);
  const [result, setResult] = useState<null | { won: boolean; stars: number; coins: number; pet?: string }>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const s = player ? all[player] : null;

  // ---- Choose or make a hero ----
  if (!player || !s) {
    const names = Object.keys(all);
    return (
      <div className="space-y-4">
        <style>{ANIM}</style>
        <p className="text-center text-6xl" style={{ animation: "cq-bob 2s ease-in-out infinite" }} aria-hidden>
          🏰
        </p>
        <p className="text-muted">The Clock Dragon has broken every clock in the kingdom! Travel from town to town, beat the monsters with your time skills, and save the castle.</p>
        {names.length ? (
          <div className="grid gap-2">
            {names.map((n) => (
              <div key={n} className="flex items-center gap-2">
                <button type="button" className="flex min-h-14 flex-1 items-center justify-between rounded-xl border border-line bg-surface px-4 text-left hover:border-accent" onClick={() => setPlayer(n)}>
                  <span className="font-semibold">
                    <span className="mr-2 text-2xl" aria-hidden>
                      {all[n].hero}
                    </span>
                    {all[n].name}
                  </span>
                  <span className="text-sm text-muted">{totalStars(all[n])} ⭐</span>
                </button>
                {confirmDelete === n ? (
                  <button type="button" className="btn-danger h-14 px-3 text-sm" onClick={() => (remove(n), setConfirmDelete(null))}>
                    Delete?
                  </button>
                ) : (
                  <button type="button" className="h-14 px-2 text-sm text-muted" aria-label={`Delete ${n}`} onClick={() => setConfirmDelete(n)}>
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : null}
        <form
          className="space-y-2 rounded-2xl border border-dashed border-line p-3"
          onSubmit={(e) => {
            e.preventDefault();
            const name = newName.trim().slice(0, 14);
            if (!name) return;
            if (!all[name]) save(name, { ...newQuest(newHero), name });
            setPlayer(name);
            setNewName("");
          }}
        >
          <p className="text-sm font-semibold">New hero</p>
          <div className="flex flex-wrap gap-1.5">
            {HEROES.map((h) => (
              <button key={h} type="button" aria-pressed={newHero === h} onClick={() => setNewHero(h)} className={`grid h-12 w-12 place-items-center rounded-xl border-2 text-3xl ${newHero === h ? "border-accent bg-accent-soft" : "border-line bg-surface"}`}>
                {h}
              </button>
            ))}
          </div>
          <input className="input w-full" placeholder="Hero name" value={newName} maxLength={14} onChange={(e) => setNewName(e.target.value)} aria-label="Hero name" />
          <button className="btn-primary w-full" disabled={!newName.trim()}>
            Start the quest
          </button>
        </form>
      </div>
    );
  }

  const pets = TOWNS.filter((_, i) => townDone(s, i)).map((t) => t.pet);

  function begin(town: number, stage: number) {
    if (winTimer.current) clearTimeout(winTimer.current);
    const q = questQ(TOWNS[town].level);
    setResult(null);
    setFight({ town, stage, q, story: story(q, TOWNS[town]), hits: 0, hearts: HEARTS, set: { h: 12, m: 0 }, answer: "", wrong: false, wrongPick: null, hit: null });
  }

  function right(f: Fight) {
    const hits = f.hits + 1;
    if (hits >= HITS) {
      const stars = starsFor(f.hearts);
      const key = stageKey(f.town, f.stage);
      const before = s!.stars[key] ?? 0;
      const coins = stars * 10;
      const next = { ...s!, stars: { ...s!.stars, [key]: Math.max(before, stars) }, coins: s!.coins + coins };
      const newlyDone = !townDone(s!, f.town) && townDone(next, f.town);
      save(player!, next);
      setFight({ ...f, hits, hit: "foe" });
      winTimer.current = setTimeout(() => {
        setFight(null);
        setResult({ won: true, stars, coins, pet: newlyDone ? `${TOWNS[f.town].pet} ${TOWNS[f.town].petName}` : undefined });
      }, 700);
      return;
    }
    const q = questQ(TOWNS[f.town].level, Math.random, f.q);
    setFight({ ...f, hits, q, story: story(q, TOWNS[f.town]), set: { h: 12, m: 0 }, answer: "", wrong: false, wrongPick: null, hit: "foe" });
  }

  function wrong(f: Fight, pick: number | null = null) {
    const hearts = f.hearts - 1;
    if (hearts <= 0) {
      setFight(null);
      setResult({ won: false, stars: 0, coins: 0 });
      return;
    }
    setFight({ ...f, hearts, wrong: true, wrongPick: pick, answer: "", hit: "hero" });
  }

  // ---- A fight ----
  if (fight) {
    const town = TOWNS[fight.town];
    const q = fight.q;
    const level = town.level === "castle" ? "five" : town.level;
    return (
      <div className="space-y-3">
        <style>{ANIM}</style>
        <div className="flex items-center justify-between text-sm">
          <button type="button" className="text-muted underline" onClick={() => setFight(null)}>
            ‹ Run away
          </button>
          <span className="text-muted">
            {town.emoji} {town.name} · Monster {fight.stage + 1}
          </span>
        </div>
        <div className="flex items-end justify-between rounded-2xl px-4 py-3" style={{ background: "linear-gradient(#2c3e66,#4a6b8a 60%,#6f8f5a 60%,#55733f)" }}>
          <div className="text-center text-white">
            <span key={`h${fight.hearts}`} className="block text-6xl leading-none" style={fight.hit === "hero" ? { animation: "cq-shake .5s" } : { animation: "cq-bob 2s ease-in-out infinite" }} aria-hidden>
              {s.hero}
            </span>
            <span className="mt-1 block text-sm font-semibold">{s.name}</span>
            <Hearts n={fight.hearts} />
            {pets.length ? <span className="block text-xl" aria-label="Pets">{pets.join("")}</span> : null}
          </div>
          <span className="pb-6 text-3xl text-white/80" aria-hidden>
            ⚔️
          </span>
          <div className="text-center text-white">
            <span key={`f${fight.hits}`} className="block text-6xl leading-none" style={fight.hit === "foe" ? { animation: "cq-shake .5s" } : undefined} aria-hidden>
              {town.monster}
            </span>
            <span className="mt-1 block text-sm font-semibold">{town.foe}</span>
            <div className="mx-auto mt-1 h-2.5 w-24 overflow-hidden rounded-full bg-black/40" aria-label={`Monster health ${HITS - fight.hits} of ${HITS}`}>
              <div className="h-full rounded-full bg-red-500 transition-all" style={{ width: `${((HITS - fight.hits) / HITS) * 100}%` }} />
            </div>
          </div>
        </div>

        <p className="rounded-2xl bg-surface-2 px-4 py-3 text-center text-lg font-semibold">{fight.story}</p>

        {q.kind === "set" ? (
          <>
            <ClockFace time={fight.set} onChange={(t) => setFight({ ...fight, set: t })} step={STEP[level]} size={230} />
            <button type="button" className="btn-primary w-full" onClick={() => (same(fight.set, q.target) ? right(fight) : wrong(fight))}>
              ⚔️ Attack!
            </button>
          </>
        ) : q.kind === "read" || q.kind === "later" ? (
          <>
            <ClockFace time={q.kind === "read" ? q.time : q.start} size={q.kind === "read" ? 210 : 170} />
            <Choices options={q.options} wrongPick={fight.wrongPick} onPick={(i) => (i === q.answer ? right(fight) : wrong(fight, i))} />
          </>
        ) : q.kind === "between" ? (
          <>
            <div className="flex items-center justify-center gap-3">
              <ClockFace time={q.from} size={120} />
              <span className="text-2xl text-muted" aria-hidden>
                →
              </span>
              <ClockFace time={q.to} size={120} />
            </div>
            <p className="text-center text-sm text-muted">Type the number of minutes, then press ✓.</p>
            <NumberPad value={fight.answer} onChange={(v) => setFight({ ...fight, answer: v })} onSubmit={() => fight.answer && (Number(fight.answer) === q.answer ? right(fight) : wrong(fight))} max={3} wrong={fight.wrong && !fight.answer} />
          </>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2 text-center">
              {[q.from, q.to].map((m, i) => (
                <div key={i} className="rounded-2xl bg-surface-2 p-2">
                  <p className="text-xs uppercase text-muted">{i ? (q.to <= q.from ? "Wakes · next day" : "Wakes") : "Sleeps"}</p>
                  <p className="text-3xl font-bold tabular-nums">{hhmm(m)}</p>
                  <p className="text-sm text-muted">
                    {m >= 720 ? "🌙" : "☀️"} {ampm(m)}
                  </p>
                </div>
              ))}
            </div>
            <Choices options={q.options} wrongPick={fight.wrongPick} onPick={(i) => (i === q.answer ? right(fight) : wrong(fight, i))} />
          </>
        )}

        {fight.wrong ? (
          <p className="rounded-2xl bg-surface-2 p-3 text-center text-danger">
            Ouch! {town.foe} hit you. {q.kind === "long" ? longHint(q) : clockHint(q)}
          </p>
        ) : null}
      </div>
    );
  }

  // ---- The map ----
  return (
    <div className="space-y-4">
      <style>{ANIM}</style>
      <div className="flex items-center justify-between rounded-2xl bg-surface-2 px-4 py-2.5">
        <span className="font-semibold">
          <span className="mr-1.5 text-2xl" aria-hidden>
            {s.hero}
          </span>
          {s.name} {pets.length ? <span aria-label="Pets">{pets.join("")}</span> : null}
        </span>
        <span className="text-sm tabular-nums">
          ⭐ {totalStars(s)} · 🪙 {s.coins}
        </span>
      </div>

      {result ? (
        <div className="rounded-2xl border-2 border-accent bg-accent-soft p-4 text-center" style={{ animation: "cq-pop .45s ease" }}>
          {result.won ? (
            <>
              <p className="text-xl font-bold">Monster beaten! 🎉</p>
              <p className="text-3xl">
                {"⭐".repeat(result.stars)}
                <span className="opacity-25">{"⭐".repeat(Math.max(0, 3 - result.stars))}</span>
              </p>
              <p className="text-sm">+{result.coins} coins</p>
              {result.pet ? <p className="mt-1 font-semibold">Town saved! {result.pet} joined your team!</p> : null}
            </>
          ) : (
            <>
              <p className="text-xl font-bold">Out of hearts! 💫</p>
              <p className="text-sm">Read the hints carefully and try again. You can do it!</p>
            </>
          )}
        </div>
      ) : null}

      <ol className="space-y-2">
        {TOWNS.map((t, ti) => {
          const open = townOpen(s, ti);
          return (
            <li key={t.id} className={`rounded-2xl border p-3 ${open ? "border-line bg-surface" : "border-dashed border-line opacity-55"}`}>
              <div className="flex items-center gap-3">
                <span className="text-4xl" aria-hidden>
                  {open ? t.emoji : "🔒"}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{t.name}</span>
                  <span className="block text-xs text-muted">
                    {t.level === "castle" ? "24-hour times, overnight · P4–P5" : { hour: "O'clock and half past", quarter: "Quarter past and to", five: "Every 5 minutes", later: "How much later?" }[t.level]}
                    {townDone(s, ti) ? ` · ${t.pet} saved!` : ""}
                  </span>
                </span>
              </div>
              {open ? (
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {Array.from({ length: STAGES }, (_, si) => {
                    const st = Math.min(3, Math.max(0, Number(s.stars?.[stageKey(ti, si)]) || 0));
                    const can = stageOpen(s, ti, si);
                    return (
                      <button key={si} type="button" disabled={!can} onClick={() => begin(ti, si)} className={`min-h-16 rounded-xl border-2 px-2 text-center ${st ? "border-accent/40 bg-accent-soft" : can ? "border-accent bg-surface hover:bg-accent-soft" : "border-line bg-surface-2"}`}>
                        <span className="block text-2xl" aria-hidden>
                          {can ? t.monster : "🔒"}
                        </span>
                        <span className="block text-xs">
                          {st ? (
                            <>
                              {"⭐".repeat(st)}
                              <span className="opacity-25">{"⭐".repeat(Math.max(0, 3 - st))}</span>
                            </>
                          ) : can ? (
                            "Fight!"
                          ) : (
                            "Locked"
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>
      <button type="button" className="text-sm text-muted underline" onClick={() => (setPlayer(null), setResult(null))}>
        ‹ Change hero
      </button>
    </div>
  );
}

