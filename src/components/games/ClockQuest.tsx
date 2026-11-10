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
@keyframes cq-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
@keyframes cq-lunge-r{0%,100%{transform:translateX(0)}40%{transform:translateX(70px) scale(1.08)}}
@keyframes cq-lunge-l{0%,100%{transform:translateX(0)}40%{transform:translateX(-70px) scale(1.08)}}
@keyframes cq-hurt{0%,100%{filter:none;transform:none}15%,45%{filter:brightness(2) saturate(0) drop-shadow(0 0 8px #f00);transform:translateX(-6px)}30%,60%{transform:translateX(6px)}}
@keyframes cq-faint{0%{transform:none;opacity:1}100%{transform:translateY(18px) rotate(80deg) scale(.8);opacity:.25}}
@keyframes cq-float-up{0%{transform:translate(-50%,0) scale(.6);opacity:0}25%{transform:translate(-50%,-14px) scale(1.2);opacity:1}100%{transform:translate(-50%,-56px) scale(1);opacity:0}}
@keyframes cq-fly{0%,100%{transform:translate(0,0) rotate(-4deg)}50%{transform:translate(-14px,-10px) rotate(3deg)}}
@keyframes cq-twinkle{0%,100%{opacity:.25}50%{opacity:1}}
@media (prefers-reduced-motion: reduce){.cq-m{animation:none!important}}`;

/** Each town's look: sky, ground, and a few things standing about. */
const THEME: Record<string, { sky: string; ground: string; ink: string; decor: string[]; card: string }> = {
  village: { sky: "linear-gradient(#7cc8f5, #c9ecff)", ground: "linear-gradient(#86cf6f, #5fae4c)", ink: "#1f3d16", decor: ["🏡", "🌻", "🌳"], card: "linear-gradient(135deg, #fff6cc, #c9f0b5)" },
  forest: { sky: "linear-gradient(#1f4a3e, #4f8467)", ground: "linear-gradient(#3f7a3a, #2a5426)", ink: "#e9ffe9", decor: ["🌲", "🍄", "🌲"], card: "linear-gradient(135deg, #2f6a4f, #1d4636)" },
  river: { sky: "linear-gradient(#5fb3e6, #b5e3fa)", ground: "linear-gradient(#3e9de0, #2367a8)", ink: "#0b2a4a", decor: ["🪨", "🌿", "🪷"], card: "linear-gradient(135deg, #d6f1ff, #8fd0f5)" },
  mountain: { sky: "linear-gradient(#7e8db0, #d3dbea)", ground: "linear-gradient(#8a8f9c, #5d6270)", ink: "#1e2433", decor: ["⛰️", "❄️", "🏔️"], card: "linear-gradient(135deg, #e7ecf5, #aab6cc)" },
  castle: { sky: "linear-gradient(#1c1238, #5a2457)", ground: "linear-gradient(#4a2d2d, #2a1717)", ink: "#ffe9e9", decor: ["🏰", "🔥", "🦇"], card: "linear-gradient(135deg, #3a1d4f, #6b1f3a)" },
};

function Hearts({ n, max = HEARTS }: { n: number; max?: number }) {
  return (
    <span className="inline-flex gap-0.5" aria-label={`${n} hearts left`}>
      {Array.from({ length: max }, (_, i) => (
        <svg key={i} viewBox="0 0 24 22" className={`h-5 w-5 ${i < n ? "" : "opacity-30 grayscale"}`} aria-hidden>
          <path d="M12 21 C5 15.5 1 11.8 1 7.3 1 3.8 3.7 1 7 1 c2 0 3.8 1 5 2.6 C13.2 2 15 1 17 1 c3.3 0 6 2.8 6 6.3 0 4.5-4 8.2-11 13.7z" fill={i < n ? "#ef4444" : "#64748b"} stroke="#fff" strokeWidth="1.5" />
          {i < n ? <ellipse cx="7" cy="6" rx="2.2" ry="1.4" fill="#fff" opacity=".55" /> : null}
        </svg>
      ))}
    </span>
  );
}

/** A name plate for the battle screen. */
function Plate({ children, right = false }: { children: React.ReactNode; right?: boolean }) {
  return <div className={`rounded-xl bg-black/45 px-2.5 py-1.5 text-white shadow-lg ring-1 ring-white/15 backdrop-blur-sm ${right ? "text-right" : ""}`}>{children}</div>;
}

/** The battle scene: themed sky and ground, the hero on the left, the monster on the right. */
function Arena(props: { townId: string; hero: string; heroName: string; foe: string; monster: string; hearts: number; hits: number; pets: string[]; hit: "hero" | "foe" | null }) {
  const th = THEME[props.townId] ?? THEME.village;
  const beaten = props.hits >= HITS;
  return (
    <div className="relative h-60 overflow-hidden rounded-3xl shadow-[0_8px_24px_rgba(0,0,0,.25)] sm:h-72" style={{ background: th.sky }}>
      {props.townId === "castle" ? (
        <div aria-hidden>
          {[12, 30, 55, 72, 88, 20, 64].map((x, i) => (
            <span key={i} className="cq-m absolute h-1 w-1 rounded-full bg-white" style={{ left: `${x}%`, top: `${8 + ((i * 13) % 30)}%`, animation: `cq-twinkle ${1.5 + (i % 3) * 0.6}s ease-in-out infinite` }} />
          ))}
        </div>
      ) : null}
      {/* things in the background */}
      <span className="absolute left-[4%] top-[34%] text-4xl opacity-80 sm:text-5xl" aria-hidden>
        {th.decor[0]}
      </span>
      <span className="absolute right-[5%] top-[30%] text-3xl opacity-70 sm:text-4xl" aria-hidden>
        {th.decor[2]}
      </span>
      {/* ground */}
      <div className="absolute inset-x-0 bottom-0 h-[38%]" style={{ background: th.ground }}>
        <span className="absolute left-[44%] top-2 text-2xl opacity-80" aria-hidden>
          {th.decor[1]}
        </span>
      </div>

      {/* hero */}
      <div className="absolute bottom-[14%] left-[10%] flex flex-col items-center">
        <div className="relative">
          {props.hit === "hero" ? (
            <span key={`ow${props.hearts}`} className="cq-m absolute left-1/2 top-0 z-10 text-3xl" style={{ animation: "cq-float-up .9s ease-out forwards" }} aria-hidden>
              💢
            </span>
          ) : null}
          <span
            key={`h${props.hearts}-${props.hits}`}
            className="cq-m relative block text-7xl leading-none drop-shadow-[0_4px_4px_rgba(0,0,0,.35)] sm:text-8xl"
            style={{ animation: props.hit === "hero" ? "cq-hurt .6s" : props.hit === "foe" ? "cq-lunge-r .45s ease-out" : "cq-bob 2.2s ease-in-out infinite" }}
            aria-hidden
          >
            {props.hero}
          </span>
        </div>
        <span className="mt-1 h-3 w-20 rounded-[50%] bg-black/30 blur-[2px]" aria-hidden />
        {props.pets.length ? (
          <span className="absolute -right-10 bottom-3 text-2xl" aria-label="Pets">
            {props.pets.slice(-2).join("")}
          </span>
        ) : null}
      </div>

      {/* monster */}
      <div className="absolute bottom-[14%] right-[10%] flex flex-col items-center">
        <div className="relative">
          {props.hit === "foe" ? (
            <>
              <span key={`boom${props.hits}`} className="cq-m absolute left-1/2 top-2 z-10 text-4xl" style={{ animation: "cq-float-up .8s ease-out forwards" }} aria-hidden>
                💥
              </span>
              <span key={`dmg${props.hits}`} className="cq-m absolute -top-4 left-1/2 z-10 text-2xl font-black text-[#ffd84d] [text-shadow:0_2px_0_#7a2b00]" style={{ animation: "cq-float-up 1s ease-out .15s both" }} aria-hidden>
                −1
              </span>
            </>
          ) : null}
          <span
            key={`f${props.hits}-${props.hearts}`}
            className="cq-m block text-7xl leading-none drop-shadow-[0_4px_4px_rgba(0,0,0,.35)] sm:text-8xl"
            style={{
              transform: "scaleX(-1)",
              animation: beaten ? "cq-faint .7s ease-in forwards" : props.hit === "foe" ? "cq-hurt .6s .2s" : props.hit === "hero" ? "cq-lunge-l .45s ease-out" : "cq-bob 1.8s ease-in-out infinite",
            }}
            aria-hidden
          >
            <span className="inline-block" style={{ transform: "scaleX(-1)" }}>
              {props.monster}
            </span>
          </span>
        </div>
        <span className="mt-1 h-3 w-20 rounded-[50%] bg-black/30 blur-[2px]" aria-hidden />
      </div>

      {/* name plates */}
      <div className="absolute left-3 top-3">
        <Plate>
          <p className="text-sm font-bold leading-tight">{props.heroName}</p>
          <Hearts n={props.hearts} />
        </Plate>
      </div>
      <div className="absolute right-3 top-3">
        <Plate right>
          <p className="text-sm font-bold leading-tight">{props.foe}</p>
          <div className="mt-1 flex justify-end gap-1" aria-label={`Monster health ${HITS - props.hits} of ${HITS}`}>
            {Array.from({ length: HITS }, (_, i) => (
              <span key={i} className={`h-3 w-7 rounded-sm transition-colors duration-300 ${i < HITS - props.hits ? "bg-gradient-to-b from-[#ff7a7a] to-[#d61f1f]" : "bg-white/15"}`} />
            ))}
          </div>
        </Plate>
      </div>
    </div>
  );
}

/** The title picture: a castle with a broken clock tower at night, and the dragon flying past. */
function TitleScene() {
  return (
    <div className="relative h-48 overflow-hidden rounded-3xl sm:h-56" style={{ background: "linear-gradient(#141a3d, #3b2b6b 65%, #6b3f7a)" }} aria-hidden>
      {[8, 18, 27, 40, 52, 63, 78, 90, 33, 70].map((x, i) => (
        <span key={i} className="cq-m absolute h-1 w-1 rounded-full bg-white" style={{ left: `${x}%`, top: `${6 + ((i * 17) % 40)}%`, animation: `cq-twinkle ${1.4 + (i % 4) * 0.5}s ease-in-out infinite` }} />
      ))}
      <span className="absolute right-[10%] top-[10%] h-10 w-10 rounded-full bg-[#fff6d5] shadow-[0_0_30px_#fff3b0]" />
      <div className="absolute inset-x-0 bottom-0 h-[26%] rounded-t-[50%_40%] bg-[#241a45]" />
      <svg viewBox="0 0 400 160" className="absolute bottom-0 left-1/2 h-[86%] -translate-x-1/2" preserveAspectRatio="xMidYMax meet">
        {/* castle */}
        <g fill="#1a1233">
          <rect x="140" y="70" width="120" height="70" />
          <rect x="120" y="85" width="30" height="55" />
          <rect x="250" y="85" width="30" height="55" />
          <path d="M120 85 l0-8 6 0 0 6 6 0 0-6 6 0 0 6 6 0 0-6 6 0 0 8z M250 85 l0-8 6 0 0 6 6 0 0-6 6 0 0 6 6 0 0-6 6 0 0 8z" />
          <rect x="182" y="22" width="36" height="60" />
          <path d="M176 24 L200 0 L224 24Z" />
        </g>
        <circle cx="200" cy="44" r="13" fill="#fdf3c4" stroke="#c9a227" strokeWidth="2.5" />
        <path d="M200 44 L200 35 M200 44 L207 49" stroke="#3b2b0b" strokeWidth="2.2" strokeLinecap="round" />
        <path d="M193 37 L198 43 L195 46 L201 52" stroke="#7a2b00" strokeWidth="1" fill="none" />
        <rect x="190" y="112" width="20" height="28" rx="10" fill="#f5c451" />
        <rect x="156" y="92" width="10" height="14" rx="5" fill="#f5c451" opacity=".8" />
        <rect x="234" y="92" width="10" height="14" rx="5" fill="#f5c451" opacity=".8" />
      </svg>
      <span className="cq-m absolute right-[22%] top-[34%] text-5xl" style={{ animation: "cq-fly 3s ease-in-out infinite" }}>
        🐉
      </span>
      <p className="absolute left-4 top-3 font-sport text-2xl font-bold leading-none tracking-wide text-[#ffd84d] [text-shadow:0_3px_0_#7a2b00] sm:text-3xl">
        CLOCK TOWER
        <br />
        QUEST
      </p>
    </div>
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
        <TitleScene />
        <p className="text-muted">The Clock Dragon has broken every clock in the kingdom! Travel from town to town, beat the monsters with your time skills, and save the castle.</p>
        {names.length ? (
          <div className="grid gap-2">
            {names.map((n) => (
              <div key={n} className="flex items-center gap-2">
                <button type="button" className="flex min-h-16 flex-1 items-center justify-between rounded-2xl border-2 border-[#e2c46a] bg-gradient-to-r from-[#fff8e1] to-[#ffefc2] px-4 text-left text-[#4a3410] shadow-sm transition hover:-translate-y-0.5 hover:shadow-md" onClick={() => setPlayer(n)}>
                  <span className="font-semibold">
                    <span className="mr-2 text-2xl" aria-hidden>
                      {all[n].hero}
                    </span>
                    {all[n].name}
                  </span>
                  <span className="rounded-full bg-white/70 px-2.5 py-1 text-sm font-semibold">{totalStars(all[n])} ⭐ · ▶ Play</span>
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
          className="space-y-3 rounded-2xl border-2 border-dashed border-[#c9b27a] bg-[#fffaf0] p-4 text-[#4a3410]"
          onSubmit={(e) => {
            e.preventDefault();
            const name = newName.trim().slice(0, 14);
            if (!name) return;
            if (!all[name]) save(name, { ...newQuest(newHero), name });
            setPlayer(name);
            setNewName("");
          }}
        >
          <p className="font-semibold">✨ New hero — pick your character</p>
          <div className="flex flex-wrap gap-1.5">
            {HEROES.map((h) => (
              <button key={h} type="button" aria-pressed={newHero === h} onClick={() => setNewHero(h)} className={`grid h-14 w-14 place-items-center rounded-2xl border-2 text-4xl transition ${newHero === h ? "-translate-y-1 border-[#d4a52c] bg-[#ffe9a8] shadow-md" : "border-[#eadfc4] bg-white"}`}>
                {h}
              </button>
            ))}
          </div>
          <input className="input w-full" placeholder="Hero name" value={newName} maxLength={14} onChange={(e) => setNewName(e.target.value)} aria-label="Hero name" />
          <button className="w-full rounded-2xl py-4 text-lg font-bold text-[#3b2a00] bg-[linear-gradient(#ffd84d,#f0c22e)] shadow-[0_5px_0_#9c7a12] transition active:translate-y-1 active:shadow-none disabled:opacity-50" disabled={!newName.trim()}>
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
          <button type="button" className="rounded-full bg-surface-2 px-3 py-1.5 font-medium text-muted" onClick={() => setFight(null)}>
            🏃 Run away
          </button>
          <span className="rounded-full bg-surface-2 px-3 py-1.5 font-medium">
            {town.emoji} {town.name} · Monster {fight.stage + 1} of {STAGES}
          </span>
        </div>
        <Arena townId={town.id} hero={s.hero} heroName={s.name} foe={town.foe} monster={town.monster} hearts={fight.hearts} hits={fight.hits} pets={pets} hit={fight.hit} />
        <p key={fight.story} className="cq-m relative rounded-2xl border-2 border-[#e8d9b0] bg-[#fdf6e3] px-4 py-3 text-center text-lg font-semibold text-[#4a3b1f] shadow-sm" style={{ animation: "cq-pop .35s ease-out" }}>
          <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#7a2b00] px-3 py-0.5 text-xs font-bold tracking-wide text-[#ffd84d]">
            ⚔️ YOUR MOVE
          </span>
          {fight.story}
        </p>

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
          <p className="cq-m rounded-2xl bg-danger-soft p-3 text-center font-medium text-danger" style={{ animation: "cq-shake .4s" }}>
            💢 Ouch! {town.foe} hit you. {q.kind === "long" ? longHint(q) : clockHint(q)}
          </p>
        ) : null}
      </div>
    );
  }

  // ---- The map ----
  return (
    <div className="space-y-4">
      <style>{ANIM}</style>
      <div className="flex items-center justify-between rounded-2xl bg-gradient-to-r from-[#2b1d4a] to-[#4a2a6b] px-4 py-3 text-white shadow-md">
        <span className="flex items-center gap-2 font-semibold">
          <span className="grid h-12 w-12 place-items-center rounded-xl bg-white/15 text-3xl" aria-hidden>
            {s.hero}
          </span>
          <span>
            <span className="block leading-tight">{s.name}</span>
            {pets.length ? <span className="text-lg" aria-label="Pets">{pets.join("")}</span> : <span className="text-xs text-white/60">Save a town to find a pet</span>}
          </span>
        </span>
        <span className="flex gap-2 text-sm font-bold tabular-nums">
          <span className="rounded-full bg-black/30 px-2.5 py-1">⭐ {totalStars(s)}</span>
          <span className="rounded-full bg-black/30 px-2.5 py-1">🪙 {s.coins}</span>
        </span>
      </div>

      {result ? (
        <div className={`cq-m rounded-3xl border-2 p-5 text-center shadow-lg ${result.won ? "border-[#e2c46a] bg-gradient-to-b from-[#fff8dc] to-[#ffe8a3] text-[#4a3410]" : "border-line bg-surface-2"}`} style={{ animation: "cq-pop .45s ease" }}>
          {result.won ? (
            <>
              <p className="text-xl font-bold">Monster beaten! 🎉</p>
              <p className="my-1 text-4xl">
                {Array.from({ length: 3 }, (_, i) => (
                  <span key={i} className={`cq-m inline-block ${i < result.stars ? "" : "opacity-25 grayscale"}`} style={i < result.stars ? { animation: `cq-pop .45s ease ${0.15 + i * 0.18}s both` } : undefined}>
                    ⭐
                  </span>
                ))}
              </p>
              <p className="font-semibold">+{result.coins} 🪙</p>
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

      <ol className="relative space-y-4">
        {/* the road between the towns */}
        <span className="absolute bottom-6 left-[2.35rem] top-6 border-l-4 border-dotted border-[#c9a96b]" aria-hidden />
        {TOWNS.map((t, ti) => {
          const open = townOpen(s, ti);
          const th = THEME[t.id] ?? THEME.village;
          const done = townDone(s, ti);
          return (
            <li key={t.id} className={`relative overflow-hidden rounded-3xl p-3 shadow-md ring-1 ring-black/5 ${open ? "" : "grayscale"}`} style={{ background: th.card, color: th.ink, opacity: open ? 1 : 0.6 }}>
              <span className="pointer-events-none absolute -right-2 -top-3 text-7xl opacity-20" aria-hidden>
                {th.decor[0]}
              </span>
              <div className="relative flex items-center gap-3">
                <span className="relative grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-white/80 text-4xl shadow-md" aria-hidden>
                  {open ? t.emoji : "🔒"}
                  {done ? <span className="absolute -bottom-1 -right-1 text-xl">{t.pet}</span> : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-lg font-bold leading-tight">{t.name}</span>
                  <span className="block text-xs font-medium opacity-80">
                    {t.level === "castle" ? "24-hour times, overnight · P4–P5" : { hour: "O'clock and half past", quarter: "Quarter past and to", five: "Every 5 minutes", later: "How much later?" }[t.level]}
                    {done ? ` · ${t.petName} saved!` : ""}
                  </span>
                </span>
              </div>
              {open ? (
                <div className="relative mt-3 grid grid-cols-3 gap-2">
                  {Array.from({ length: STAGES }, (_, si) => {
                    const st = Math.min(3, Math.max(0, Number(s.stars?.[stageKey(ti, si)]) || 0));
                    const can = stageOpen(s, ti, si);
                    return (
                      <button
                        key={si}
                        type="button"
                        disabled={!can}
                        onClick={() => begin(ti, si)}
                        className={`min-h-[4.5rem] rounded-2xl px-2 text-center shadow-sm transition ${st ? "bg-white/85 text-[#3a2a0a]" : can ? "cq-m bg-[#ffd84d] text-[#4a2a00] shadow-[0_4px_0_#c99a12] hover:-translate-y-0.5" : "bg-black/15"}`}
                      >
                        <span className={`block text-3xl ${can && !st ? "cq-m" : ""}`} style={can && !st ? { animation: "cq-bob 1.6s ease-in-out infinite" } : undefined} aria-hidden>
                          {can ? t.monster : "🔒"}
                        </span>
                        <span className="block text-xs font-bold">
                          {st ? (
                            <>
                              {"⭐".repeat(st)}
                              <span className="opacity-25">{"⭐".repeat(Math.max(0, 3 - st))}</span>
                            </>
                          ) : can ? (
                            "⚔️ Fight!"
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

