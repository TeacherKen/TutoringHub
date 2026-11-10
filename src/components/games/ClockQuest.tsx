"use client";
import { useEffect, useRef, useState } from "react";
import { clockHint, hhmm, ampm, same, STEP, type Time } from "@/lib/clock";
import { HEARTS, HEROES, heroImage, HITS, longHint, newQuest, questQ, stageKey, stageOpen, STAGES, starsFor, story, totalStars, TOWNS, townDone, townOpen, type HeroPose, type QuestQ, type QuestSave } from "@/lib/games/clockQuest";
import { ClockFace } from "./ClockRescue";
import { NumberPad } from "./NumberPad";
import { useSaves } from "./useSaves";

// Clock Tower Quest: a hero walks from Sunny Village to Monster Castle. Each monster is beaten with
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

/**
 * Each town's look: a painted landscape (Kenney "Background Elements", CC0), sometimes our own ground
 * on top (water, rock, castle stone), a colour wash, and a few things standing about.
 */
type TownLook = { sky: string; bg: string; ground: string | null; wash?: string; ink: string; decor: string[]; card: string };
const THEME: Record<string, TownLook> = {
  village: { sky: "linear-gradient(#7cc8f5, #c9ecff)", bg: "grass", ground: null, ink: "#1f3d16", decor: ["", "/games/art/scene/bush3.png", ""], card: "linear-gradient(135deg, #fff6cc, #c9f0b5)" },
  forest: { sky: "linear-gradient(#1f4a3e, #4f8467)", bg: "forest", ground: null, ink: "#e9ffe9", decor: ["", "/games/art/scene/bush3.png", ""], card: "linear-gradient(135deg, #2f6a4f, #1d4636)" },
  river: { sky: "linear-gradient(#5fb3e6, #b5e3fa)", bg: "empty", ground: "linear-gradient(#3e9de0, #2367a8)", ink: "#0b2a4a", decor: ["/games/art/scene/treePalm.png", "", ""], card: "linear-gradient(135deg, #d6f1ff, #8fd0f5)" },
  mountain: { sky: "linear-gradient(#7e8db0, #d3dbea)", bg: "pines", ground: "linear-gradient(#9aa0ac, #6b707d)", ink: "#1e2433", decor: ["/games/art/scene/treePineSnow.png", "", "/games/art/scene/treeSnow.png"], card: "linear-gradient(135deg, #e7ecf5, #aab6cc)" },
  castle: { sky: "linear-gradient(#1c1238, #5a2457)", bg: "castles", ground: "linear-gradient(#4a2d2d, #2a1717)", wash: "linear-gradient(rgba(28,18,56,.78), rgba(90,36,87,.6))", ink: "#ffe9e9", decor: ["", "", "/games/art/scene/towerSmall.png"], card: "linear-gradient(135deg, #3a1d4f, #6b1f3a)" },
};

/** A picture from the art pack (decoration only, so screen readers skip it). */
function Pic({ src, className = "" }: { src: string; className?: string }) {
  if (!src) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" aria-hidden draggable={false} className={`pointer-events-none select-none object-contain ${className}`} />;
}

/** A hero in a pose (Kenney "Toon Characters"). */
function HeroArt({ hero, pose = "idle", className = "" }: { hero: string; pose?: HeroPose; className?: string }) {
  return <Pic src={heroImage(hero, pose)} className={className} />;
}

/** Small drawn icons, so the game uses no emoji. */
function StarIcon({ on = true, className = "h-4 w-4" }: { on?: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`inline-block align-[-0.15em] ${className}`} aria-hidden>
      <path d="M12 2.5l2.9 6 6.6.8-4.9 4.6 1.3 6.5L12 17.2 6.1 20.4l1.3-6.5L2.5 9.3l6.6-.8z" fill={on ? "#ffc629" : "#94a3b8"} stroke={on ? "#c98a00" : "#64748b"} strokeWidth="1.3" strokeLinejoin="round" opacity={on ? 1 : 0.35} />
    </svg>
  );
}
function CoinIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`inline-block align-[-0.15em] ${className}`} aria-hidden>
      <circle cx="12" cy="12" r="10" fill="#ffc629" stroke="#c98a00" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="6.5" fill="none" stroke="#e0a300" strokeWidth="1.3" />
      <path d="M9.5 9.5l5 5M14.5 9.5l-5 5" stroke="#fff3c4" strokeWidth="1.2" opacity=".7" />
    </svg>
  );
}
function LockIcon({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path d="M7 10V7.5a5 5 0 0 1 10 0V10" fill="none" stroke="#6b7280" strokeWidth="2.4" />
      <rect x="4.5" y="10" width="15" height="11" rx="2.5" fill="#9ca3af" stroke="#6b7280" strokeWidth="1.4" />
      <circle cx="12" cy="15.5" r="1.8" fill="#4b5563" />
    </svg>
  );
}
/** A comic "pow" burst for a hit. */
function Burst({ color = "#ffd84d", className = "h-14 w-14" }: { color?: string; className?: string }) {
  const pts = Array.from({ length: 16 }, (_, i) => {
    const a = (i / 16) * Math.PI * 2;
    const r = i % 2 ? 22 : 46;
    return `${(50 + Math.cos(a) * r).toFixed(1)},${(50 + Math.sin(a) * r).toFixed(1)}`;
  }).join(" ");
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden>
      <polygon points={pts} fill={color} stroke="#7a2b00" strokeWidth="4" strokeLinejoin="round" />
    </svg>
  );
}

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
  return <div className={`rpg-panel-brown px-1 py-0 shadow-lg ${right ? "text-right" : ""}`}>{children}</div>;
}

/** Answer buttons in the RPG style (a crossed-out one after a wrong pick). */
function RpgChoices({ options, onPick, wrongPick }: { options: string[]; onPick: (i: number) => void; wrongPick: number | null }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {options.map((o, i) => (
        <button key={o} type="button" onClick={() => onPick(i)} disabled={wrongPick === i} className={`rpg-btn-light min-h-14 px-2 text-lg ${wrongPick === i ? "line-through" : ""}`}>
          {o}
        </button>
      ))}
    </div>
  );
}

/** A health bar from the RPG pack: red (or green) pieces on a dark back. */
function HealthBar({ value, max, color = "Red" }: { value: number; max: number; color?: "Red" | "Green" }) {
  const pct = Math.max(0, Math.min(1, value / max));
  const seg = (k: "Back" | "Red" | "Green") => (
    <span className="flex h-[18px] w-full">
      <Pic src={`/games/art/ui/bar${k}_horizontalLeft.png`} className="h-[18px] w-[9px] shrink-0 object-fill" />
      <span className="h-[18px] flex-1 bg-repeat-x [background-size:18px_18px]" style={{ backgroundImage: `url(/games/art/ui/bar${k}_horizontalMid.png)` }} />
      <Pic src={`/games/art/ui/bar${k}_horizontalRight.png`} className="h-[18px] w-[9px] shrink-0 object-fill" />
    </span>
  );
  return (
    <span className="relative block h-[18px] w-24" aria-hidden>
      <span className="absolute inset-0">{seg("Back")}</span>
      {pct > 0 ? (
        <span className="absolute inset-y-0 left-0 flex transition-[width] duration-300" style={{ width: `${Math.max(20, pct * 100)}%` }}>
          {seg(color)}
        </span>
      ) : null}
    </span>
  );
}

/** The battle scene: themed sky and ground, the hero on the left, the monster on the right. */
function Arena(props: { townId: string; hero: string; heroName: string; foe: string; monster: string; hearts: number; hits: number; pets: string[]; hit: "hero" | "foe" | null }) {
  const th = THEME[props.townId] ?? THEME.village;
  const beaten = props.hits >= HITS;
  return (
    <div className="relative h-60 overflow-hidden rounded-3xl shadow-[0_8px_24px_rgba(0,0,0,.25)] sm:h-72" style={{ background: th.sky }}>
      <div className="absolute inset-0 bg-repeat-x" style={{ backgroundImage: `url(/games/art/bg/${th.bg}.png)`, backgroundSize: "auto 100%", backgroundPosition: "center bottom" }} aria-hidden />
      {th.wash ? <div className="absolute inset-0" style={{ background: th.wash }} aria-hidden /> : null}
      {props.townId === "castle" ? (
        <div aria-hidden>
          {[12, 30, 55, 72, 88, 20, 64].map((x, i) => (
            <span key={i} className="cq-m absolute h-1 w-1 rounded-full bg-white" style={{ left: `${x}%`, top: `${8 + ((i * 13) % 30)}%`, animation: `cq-twinkle ${1.5 + (i % 3) * 0.6}s ease-in-out infinite` }} />
          ))}
        </div>
      ) : null}
      {/* things in the background */}
      <Pic src={th.decor[0]} className="absolute bottom-[26%] left-[2%] h-[55%] w-auto opacity-90" />
      <Pic src={th.decor[2]} className="absolute bottom-[28%] right-[3%] h-[42%] w-auto opacity-90" />
      {/* ground (our own, for water, rock and castle stone) */}
      {th.ground ? <div className="absolute inset-x-0 bottom-0 h-[30%] rounded-t-[40%_12px]" style={{ background: th.ground }} aria-hidden /> : null}
      <Pic src={th.decor[1]} className="absolute bottom-[16%] left-[44%] h-[12%] w-auto" />

      {/* hero */}
      <div className="absolute bottom-[14%] left-[10%] flex flex-col items-center">
        <div className="relative">
          {props.hit === "hero" ? (
            <span key={`ow${props.hearts}`} className="cq-m absolute left-1/2 top-0 z-10" style={{ animation: "cq-float-up .9s ease-out forwards" }} aria-hidden>
              <Burst color="#ff5a5a" className="h-10 w-10" />
            </span>
          ) : null}
          <span
            key={`h${props.hearts}-${props.hits}`}
            className="cq-m relative block text-7xl leading-none drop-shadow-[0_4px_4px_rgba(0,0,0,.35)] sm:text-8xl"
            style={{ animation: props.hit === "hero" ? "cq-hurt .6s" : props.hit === "foe" ? "cq-lunge-r .45s ease-out" : "cq-bob 2.2s ease-in-out infinite" }}
            aria-hidden
          >
            <HeroArt hero={props.hero} pose={props.hit === "hero" ? "hurt" : props.hit === "foe" ? "attack1" : "idle"} className="h-28 w-auto sm:h-36" />
          </span>
        </div>
        <span className="mt-1 h-3 w-20 rounded-[50%] bg-black/30 blur-[2px]" aria-hidden />
        {props.pets.length ? (
          <span className="absolute -right-12 bottom-2 flex gap-0.5" aria-label="Pets">
            {props.pets.slice(-2).map((p) => (
              <Pic key={p} src={p} className="h-9 w-9 drop-shadow-[0_2px_2px_rgba(0,0,0,.3)]" />
            ))}
          </span>
        ) : null}
      </div>

      {/* monster */}
      <div className="absolute bottom-[14%] right-[10%] flex flex-col items-center">
        <div className="relative">
          {props.hit === "foe" ? (
            <>
              <span key={`boom${props.hits}`} className="cq-m absolute left-1/2 top-2 z-10" style={{ animation: "cq-float-up .8s ease-out forwards" }} aria-hidden>
                <Burst className="h-14 w-14" />
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
              <Pic src={props.monster} className="h-28 w-auto sm:h-36" />
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
          <div className="mt-1 flex justify-end" role="img" aria-label={`Monster health ${HITS - props.hits} of ${HITS}`}>
            <HealthBar value={HITS - props.hits} max={HITS} />
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
      <span className="cq-m absolute right-[18%] top-[22%]" style={{ animation: "cq-fly 3s ease-in-out infinite" }}>
        <Pic src="/games/art/monsters/clockmonster.png" className="h-20 w-auto sm:h-24" />
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
  const [result, setResult] = useState<null | { won: boolean; stars: number; coins: number; pet?: { img: string; name: string } }>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const s = player ? all[player] : null;

  // ---- Choose or make a hero ----
  if (!player || !s) {
    const names = Object.keys(all);
    return (
      <div className="space-y-4">
        <style>{ANIM}</style>
        <TitleScene />
        <p className="text-muted">The Clock Monster has broken every clock in the kingdom! Travel from town to town, beat the monsters with your time skills, and save the castle.</p>
        {names.length ? (
          <div className="grid gap-2">
            {names.map((n) => (
              <div key={n} className="flex items-center gap-2">
                <button type="button" className="rpg-btn-light flex min-h-16 flex-1 items-center justify-between px-2 text-left transition hover:-translate-y-0.5 hover:shadow-md" onClick={() => setPlayer(n)}>
                  <span className="font-semibold">
                    <HeroArt hero={all[n].hero} className="mr-2 inline-block h-10 w-auto align-middle" />
                    {all[n].name}
                  </span>
                  <span className="rounded-full bg-white/70 px-2.5 py-1 text-sm font-semibold">{totalStars(all[n])} <StarIcon /> · ▶ Play</span>
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
          className="rpg-panel space-y-3 px-2 py-1"
          onSubmit={(e) => {
            e.preventDefault();
            const name = newName.trim().slice(0, 14);
            if (!name) return;
            if (!all[name]) save(name, { ...newQuest(newHero), name });
            setPlayer(name);
            setNewName("");
          }}
        >
          <p className="font-semibold">New hero: pick your character</p>
          <div className="flex flex-wrap gap-1.5">
            {HEROES.map((h) => (
              <button
                key={h}
                type="button"
                aria-pressed={newHero === h}
                aria-label={`Hero ${HEROES.indexOf(h) + 1}`}
                onClick={() => setNewHero(h)}
                className={`grid place-items-center overflow-hidden rounded-2xl border-2 text-4xl transition h-20 w-16 ${newHero === h ? "-translate-y-1 border-[#a86b2a] bg-[#ffe9a8] shadow-md" : "border-[#d9c49a] bg-[#fffaf0]"}`}
              >
                <HeroArt hero={h} pose={newHero === h ? "cheer0" : "idle"} className="h-[4.5rem] w-auto" />
              </button>
            ))}
          </div>
          <input className="input w-full" placeholder="Hero name" value={newName} maxLength={14} onChange={(e) => setNewName(e.target.value)} aria-label="Hero name" />
          <button className="rpg-btn w-full text-lg" disabled={!newName.trim()}>
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
        setResult({ won: true, stars, coins, pet: newlyDone ? { img: TOWNS[f.town].pet, name: TOWNS[f.town].petName } : undefined });
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
          <button type="button" className="rpg-btn-light flex min-h-11 items-center gap-1.5 px-2 text-sm" onClick={() => setFight(null)}>
            <Pic src="/games/art/ui/arrowBrown_left.png" className="h-4 w-auto" />
            Run away
          </button>
          <span className="rpg-inset px-1 text-sm font-semibold">
            <Pic src={town.icon} className="mr-1 inline-block h-5 w-auto align-[-0.2em]" />
            {town.name} · Monster {fight.stage + 1} of {STAGES}
          </span>
        </div>
        <Arena townId={town.id} hero={s.hero} heroName={s.name} foe={town.foe} monster={town.monster} hearts={fight.hearts} hits={fight.hits} pets={pets} hit={fight.hit} />
        <p key={fight.story} className="cq-m rpg-panel relative mt-2 px-2 pb-1 pt-2 text-center text-lg font-semibold" style={{ animation: "cq-pop .35s ease-out" }}>
          <span className="absolute -top-5 left-1/2 -translate-x-1/2 rounded-full bg-[#7a2b00] px-3 py-0.5 text-xs font-bold tracking-wide text-[#ffd84d] shadow">
            YOUR MOVE
          </span>
          {fight.story}
        </p>

        {q.kind === "set" ? (
          <>
            <ClockFace time={fight.set} onChange={(t) => setFight({ ...fight, set: t })} step={STEP[level]} size={230} />
            <button type="button" className="rpg-btn w-full text-xl" onClick={() => (same(fight.set, q.target) ? right(fight) : wrong(fight))}>
              Attack!
            </button>
          </>
        ) : q.kind === "read" || q.kind === "later" ? (
          <>
            <ClockFace time={q.kind === "read" ? q.time : q.start} size={q.kind === "read" ? 210 : 170} />
            <RpgChoices options={q.options} wrongPick={fight.wrongPick} onPick={(i) => (i === q.answer ? right(fight) : wrong(fight, i))} />
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
                <div key={i} className="rpg-inset-light px-1">
                  <p className="text-xs uppercase text-muted">{i ? (q.to <= q.from ? "Wakes · next day" : "Wakes") : "Sleeps"}</p>
                  <p className="text-3xl font-bold tabular-nums">{hhmm(m)}</p>
                  <p className="text-sm text-muted">
                    {ampm(m)}
                  </p>
                </div>
              ))}
            </div>
            <RpgChoices options={q.options} wrongPick={fight.wrongPick} onPick={(i) => (i === q.answer ? right(fight) : wrong(fight, i))} />
          </>
        )}

        {fight.wrong ? (
          <p className="cq-m rpg-panel-light px-1 text-center font-medium text-[#b42318]" style={{ animation: "cq-shake .4s" }}>
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
      <div className="rpg-panel-brown flex items-center justify-between px-1 shadow-md">
        <span className="flex items-center gap-2 font-semibold">
          <span className="rpg-inset-light grid h-14 w-14 place-items-center overflow-hidden" aria-hidden>
            <HeroArt hero={s.hero} className="h-11 w-auto" />
          </span>
          <span>
            <span className="block leading-tight">{s.name}</span>
            {pets.length ? (
              <span className="mt-0.5 flex gap-1" aria-label={`${pets.length} pets`}>
                {pets.map((p) => (
                  <Pic key={p} src={p} className="h-7 w-7" />
                ))}
              </span>
            ) : (
              <span className="text-xs text-white/60">Save a town to find a pet</span>
            )}
          </span>
        </span>
        <span className="flex gap-2 text-sm font-bold tabular-nums">
          <span className="rounded-full bg-black/30 px-2.5 py-1"><StarIcon /> {totalStars(s)}</span>
          <span className="rounded-full bg-black/30 px-2.5 py-1"><CoinIcon /> {s.coins}</span>
        </span>
      </div>

      {result ? (
        <div className={`cq-m ${result.won ? "rpg-panel-light" : "rpg-panel"} px-3 py-2 text-center shadow-lg`} style={{ animation: "cq-pop .45s ease" }}>
          {result.won ? (
            <>
              <HeroArt hero={s.hero} pose="cheer1" className="mx-auto -mt-2 h-28 w-auto drop-shadow-[0_4px_4px_rgba(0,0,0,.25)]" />
              <p className="text-xl font-bold">Monster beaten!</p>
              <p className="my-1 text-4xl">
                {Array.from({ length: 3 }, (_, i) => (
                  <span key={i} className={`cq-m inline-block ${i < result.stars ? "" : "opacity-25 grayscale"}`} style={i < result.stars ? { animation: `cq-pop .45s ease ${0.15 + i * 0.18}s both` } : undefined}>
                    <StarIcon className="h-10 w-10" />
                  </span>
                ))}
              </p>
              <p className="font-semibold">
                +{result.coins} <CoinIcon />
              </p>
              {result.pet ? (
                <p className="mt-2 flex items-center justify-center gap-2 font-semibold">
                  <Pic src={result.pet.img} className="h-12 w-12" /> Town saved! {result.pet.name} joined your team!
                </p>
              ) : null}
            </>
          ) : (
            <>
              <HeroArt hero={s.hero} pose="hurt" className="mx-auto h-24 w-auto opacity-90" />
              <p className="text-xl font-bold">Out of hearts!</p>
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
          const done = townDone(s, ti);
          return (
            <li key={t.id} className={`rpg-panel relative overflow-hidden px-1 py-0.5 shadow-md ${open ? "" : "opacity-60 grayscale"}`}>
              <Pic src={t.icon} className="absolute -right-3 -top-2 h-24 w-auto opacity-20" />
              <div className="relative flex items-center gap-3">
                <span className="relative grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-white/80 shadow-md" aria-hidden>
                  {open ? <Pic src={t.icon} className="h-11 w-11" /> : <LockIcon />}
                  {done ? <Pic src={t.pet} className="absolute -bottom-2 -right-2 h-8 w-8 drop-shadow" /> : null}
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
                        className={`min-h-[4.75rem] px-1 text-center ${st ? "rpg-inset-light" : can ? "rpg-btn" : "rounded-2xl bg-black/15"}`}
                      >
                        <span className={`mx-auto grid h-11 place-items-center ${can && !st ? "cq-m" : ""}`} style={can && !st ? { animation: "cq-bob 1.6s ease-in-out infinite" } : undefined} aria-hidden>
                          {can ? <Pic src={t.monster} className={`h-11 w-auto ${st ? "opacity-60 grayscale" : ""}`} /> : <LockIcon className="h-6 w-6" />}
                        </span>
                        <span className="block text-xs font-bold">
                          {st ? (
                            <>
                              {[0, 1, 2].map((k) => (
                                <StarIcon key={k} on={k < st} />
                              ))}
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

