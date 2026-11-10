import { addMinutes, ampm, clockQ, DAY, digital, duration, hhmm, timeJumps, words, type ClockLevel, type ClockQ } from "@/lib/clock";

// 🏰 Clock Tower Quest: a hero travels through 5 towns. Each town has 3 monsters; each monster needs 3 right
// answers to beat. The towns get harder: o'clock → quarter → 5 minutes → how much later → 24-hour, overnight.

export type TownLevel = ClockLevel | "castle";
export type Town = { id: string; name: string; emoji: string; foe: string; monster: string; level: TownLevel; pet: string; petName: string };

export const TOWNS: Town[] = [
  { id: "village", name: "Sunny Village", emoji: "🏡", foe: "Rat King", monster: "🐀", level: "hour", pet: "🐶", petName: "Puppy" },
  { id: "forest", name: "Whisper Forest", emoji: "🌲", foe: "Grey Wolf", monster: "🐺", level: "quarter", pet: "🦉", petName: "Owl" },
  { id: "river", name: "Crocodile River", emoji: "🌊", foe: "Snap the Croc", monster: "🐊", level: "five", pet: "🐢", petName: "Turtle" },
  { id: "mountain", name: "Troll Mountain", emoji: "⛰️", foe: "Mountain Troll", monster: "🧌", level: "later", pet: "🦅", petName: "Eagle" },
  { id: "castle", name: "Dragon Castle", emoji: "🏰", foe: "Clock Dragon", monster: "🐉", level: "castle", pet: "🐲", petName: "Baby dragon" },
];
export const STAGES = 3; // monsters per town
export const HITS = 3; // right answers to beat a monster
export const HEARTS = 3;

/** Hero characters: "k:" ones are drawn pictures (Kenney "Toon Characters", CC0); the rest are emoji (older saves). */
export const HEROES = ["k:femaleAdventurer", "k:maleAdventurer", "k:femalePerson", "k:malePerson", "k:robot", "k:zombie", "🧙", "🧝", "🦸", "🥷", "🧚", "🤴", "👸", "🧑‍🚀"] as const;
export type HeroPose = "idle" | "attack1" | "hurt" | "cheer0" | "cheer1";
/** The picture for a drawn hero in a pose, or null for an emoji hero. */
export const heroImage = (hero: string, pose: HeroPose = "idle") => (hero.startsWith("k:") ? `/games/art/heroes/${hero.slice(2)}_${pose}.png` : null);

export type QuestSave = { hero: string; stars: Record<string, number>; coins: number };
export const newQuest = (hero: string): QuestSave => ({ hero, stars: {}, coins: 0 });
export const stageKey = (town: number, stage: number) => `${town}-${stage}`;

/** A town opens once every monster in the town before it is beaten. */
export function townOpen(s: QuestSave, town: number): boolean {
  if (town === 0) return true;
  return Array.from({ length: STAGES }, (_, i) => s.stars[stageKey(town - 1, i)] ?? 0).every((n) => n > 0);
}
/** A monster can be fought once the one before it in the same town is beaten. */
export function stageOpen(s: QuestSave, town: number, stage: number): boolean {
  return townOpen(s, town) && (stage === 0 || (s.stars[stageKey(town, stage - 1)] ?? 0) > 0);
}
export const townDone = (s: QuestSave, town: number) => Array.from({ length: STAGES }, (_, i) => s.stars[stageKey(town, i)] ?? 0).every((n) => n > 0);
export const totalStars = (s: QuestSave) => Object.values(s.stars).reduce((a, b) => a + b, 0);
/** Stars for a won fight: no hearts lost = 3. */
export const starsFor = (heartsLeft: number) => (heartsLeft >= HEARTS ? 3 : heartsLeft === HEARTS - 1 ? 2 : 1);

export type LongQ = { kind: "long"; from: number; to: number; options: string[]; answer: number };
export type QuestQ = ClockQ | LongQ;

type Rand = () => number;
const int = (lo: number, hi: number, r: Rand) => lo + Math.floor(r() * (hi - lo + 1));

/** Dragon Castle: 24-hour times, often overnight ("21:30 to 06:30 the next day"). */
export function longQ(r: Rand = Math.random): LongQ {
  const overnight = r() < 0.6;
  const from = overnight ? int(18 * 12, 23 * 12 + 11, r) * 5 : int(6 * 12, 13 * 12, r) * 5;
  const to = overnight ? int(4 * 12, 9 * 12 + 11, r) * 5 : from + int(6, 60, r) * 5;
  const total = timeJumps(from, to % DAY).total;
  const wrong = [total + 60, total - 60, total + 30, total - 30, total + 120, DAY - total].filter((m) => m > 0 && m !== total).map(duration);
  const right = duration(total);
  const options = [right, ...[...new Set(wrong)].filter((w) => w !== right).slice(0, 3)];
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }
  return { kind: "long", from, to: to % DAY, options, answer: options.indexOf(right) };
}

export function questQ(level: TownLevel, r: Rand = Math.random, prev?: QuestQ | null): QuestQ {
  if (level === "castle") {
    for (let i = 0; i < 10; i++) {
      const q = longQ(r);
      if (!prev || prev.kind !== "long" || q.from !== prev.from) return q;
    }
    return longQ(r);
  }
  return clockQ(level, r, prev && prev.kind !== "long" ? prev : null);
}

const pick = <T>(xs: readonly T[], r: Rand) => xs[Math.floor(r() * xs.length)];

/** The story line for a question, so it feels like an adventure, not a worksheet. */
export function story(q: QuestQ, town: Town, r: Rand = Math.random): string {
  const f = town.foe;
  switch (q.kind) {
    case "set":
      return pick(
        [
          `${f} jammed the tower clock! Set it to ${q.say} to open the gate.`,
          `The magic door only opens at ${q.say}. Move the hands to ${q.say}!`,
          `Quick! The bell must ring at ${q.say}. Set the clock!`,
        ],
        r,
      );
    case "read":
      return pick([`${f} hid the time! What time does the tower clock show?`, `Read the clock to cast your spell. What time is it?`, `The guard asks: "What time is it?" Read the clock!`], r);
    case "later":
      return pick(
        [
          `It's ${digital(q.start)}. The bridge opens in ${q.add} minutes. When does it open?`,
          `${f} wakes up ${q.add} minutes after ${digital(q.start)}. What time is that?`,
          `Your potion is ready ${q.add} minutes after ${digital(q.start)}. When is it ready?`,
        ],
        r,
      );
    case "between":
      return pick(
        [`${f} sleeps from ${digital(q.from)} to ${digital(q.to)}. How many minutes can you sneak past?`, `The boat leaves at ${digital(q.from)} and lands at ${digital(q.to)}. How many minutes is the trip?`],
        r,
      );
    case "long":
      return pick(
        [
          `The Clock Dragon sleeps from ${hhmm(q.from)} to ${hhmm(q.to)}${q.to <= q.from ? " the next day" : ""}. How long does it sleep?`,
          `The castle gate is locked from ${hhmm(q.from)} to ${hhmm(q.to)}${q.to <= q.from ? " the next morning" : ""}. How long is it locked?`,
        ],
        r,
      );
  }
}

/** A hint for the Dragon Castle questions (the other kinds use clockHint). */
export function longHint(q: LongQ): string {
  const { jumps } = timeJumps(q.from, q.to);
  return jumps.map((j) => `${hhmm(j.from)} → ${hhmm(j.to)} is ${duration(j.mins)}`).join(", ") + ". Add them up!";
}

export { ampm, words, addMinutes };
