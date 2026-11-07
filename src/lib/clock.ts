// ⏰ Clock Rescue: the maths behind it (no drawing here, so it can be tested).
// Times are 12-hour clock times: h is 1–12, m is 0–59.

export type Time = { h: number; m: number };
export type ClockLevel = "hour" | "quarter" | "five" | "later";

export const CLOCK_LEVELS: Record<ClockLevel, string> = {
  hour: "O'clock and half past · P2",
  quarter: "Quarter past and quarter to · P2–P3",
  five: "Every 5 minutes · P3–P4",
  later: "How much later? · P3–P5",
};

/** How far the long hand jumps when it's dragged, for each level. */
export const STEP: Record<ClockLevel, number> = { hour: 30, quarter: 15, five: 5, later: 5 };

export type ClockQ =
  | { kind: "set"; target: Time; say: string }
  | { kind: "read"; time: Time; options: string[]; answer: number }
  | { kind: "later"; start: Time; add: number; options: string[]; answer: number }
  | { kind: "between"; from: Time; to: Time; answer: number };

const pad = (n: number) => String(n).padStart(2, "0");
export const digital = (t: Time) => `${t.h}:${pad(t.m)}`;
const nextHour = (h: number) => (h % 12) + 1;

/** "4 o'clock", "half past 4", "quarter to 5", "25 past 4", "10 to 5". */
export function words(t: Time): string {
  if (t.m === 0) return `${t.h} o'clock`;
  if (t.m === 30) return `half past ${t.h}`;
  if (t.m === 15) return `quarter past ${t.h}`;
  if (t.m === 45) return `quarter to ${nextHour(t.h)}`;
  return t.m < 30 ? `${t.m} past ${t.h}` : `${60 - t.m} to ${nextHour(t.h)}`;
}

export function addMinutes(t: Time, mins: number): Time {
  const total = ((((t.h % 12) * 60 + t.m + mins) % 720) + 720) % 720;
  const h = Math.floor(total / 60);
  return { h: h === 0 ? 12 : h, m: total % 60 };
}

/** Minutes from one time to a later one (wraps past 12). */
export function minutesBetween(from: Time, to: Time): number {
  const a = (from.h % 12) * 60 + from.m;
  const b = (to.h % 12) * 60 + to.m;
  return (((b - a) % 720) + 720) % 720;
}

export const same = (a: Time, b: Time) => a.h === b.h && a.m === b.m;

/** Where the hands point, in degrees from 12 going clockwise. The short hand moves on as the minutes go by. */
export const minuteAngle = (t: Time) => t.m * 6;
export const hourAngle = (t: Time) => ((t.h % 12) + t.m / 60) * 30;

/** Turn a dragged long hand's angle into minutes, snapped to the level's step. */
export function minutesFromAngle(deg: number, step: number): number {
  const m = Math.round((((deg % 360) + 360) % 360) / 6 / step) * step;
  return m % 60;
}

/** Turn a dragged short hand's angle into an hour, allowing for the minutes (at 4:45 it sits near 5 but means 4). */
export function hourFromAngle(deg: number, m: number): number {
  const h = Math.round((((deg % 360) + 360) % 360) / 30 - m / 60);
  const w = ((h % 12) + 12) % 12;
  return w === 0 ? 12 : w;
}

type Rand = () => number;
const pick = <T>(xs: T[], r: Rand) => xs[Math.floor(r() * xs.length)];
const int = (lo: number, hi: number, r: Rand) => lo + Math.floor(r() * (hi - lo + 1));

function randomTime(level: ClockLevel, r: Rand): Time {
  const h = int(1, 12, r);
  if (level === "hour") return { h, m: pick([0, 30], r) };
  if (level === "quarter") return { h, m: pick([0, 15, 30, 45], r) };
  return { h, m: int(0, 11, r) * 5 };
}

/** Four different answers in a random order; returns them and where the right one is. */
function shuffleIn(right: string, wrong: string[], r: Rand): { options: string[]; answer: number } {
  const others = [...new Set(wrong.filter((w) => w !== right))].slice(0, 3);
  const options = [right, ...others];
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }
  return { options, answer: options.indexOf(right) };
}

/** The mistakes children really make: hands swapped, the hour one out (quarter to 5 read as quarter to 4), the minutes a bit off. */
function readOptions(t: Time, level: ClockLevel, r: Rand) {
  const show = level === "five" ? digital : words;
  const prevHour = t.h === 1 ? 12 : t.h - 1;
  const swappedM = (t.h % 12) * 5;
  const wrong = [
    show({ h: t.m >= 30 ? prevHour : nextHour(t.h), m: t.m }),
    show({ h: t.m === 0 ? 12 : Math.max(1, Math.round(t.m / 5)) || 12, m: swappedM }),
    show({ h: t.h, m: (t.m + 30) % 60 }),
    show({ h: t.h, m: level === "five" ? (t.m + 5) % 60 : (t.m + 15) % 60 }),
    show({ h: nextHour(t.h), m: t.m }),
  ];
  return shuffleIn(show(t), wrong, r);
}

export function clockQ(level: ClockLevel, r: Rand = Math.random, prev?: ClockQ | null): ClockQ {
  for (let tries = 0; tries < 20; tries++) {
    const q = makeQ(level, r);
    if (!prev || JSON.stringify(q) !== JSON.stringify(prev)) return q;
  }
  return makeQ(level, r);
}

function makeQ(level: ClockLevel, r: Rand): ClockQ {
  if (level === "later") {
    const start = randomTime("five", r);
    if (r() < 0.35) {
      const gap = int(2, 20, r) * 5;
      return { kind: "between", from: start, to: addMinutes(start, gap), answer: gap };
    }
    const add = pick([10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 75, 90, 105, 120], r);
    const end = addMinutes(start, add);
    const wrong = [addMinutes(end, 60), addMinutes(end, -60), addMinutes(end, 10), addMinutes(end, -10), { h: start.h, m: (start.m + add) % 60 }].map(digital);
    return { kind: "later", start, add, ...shuffleIn(digital(end), wrong, r) };
  }
  const t = randomTime(level, r);
  if (r() < 0.5) return { kind: "set", target: t, say: level === "five" && r() < 0.5 ? digital(t) : words(t) };
  return { kind: "read", time: t, ...readOptions(t, level, r) };
}

/** A short, kind hint after a wrong answer. */
export function clockHint(q: ClockQ): string {
  if (q.kind === "between") {
    const toHour = 60 - q.from.m;
    return q.from.m === 0 || q.to.h === q.from.h
      ? `Count on in 5s from ${digital(q.from)} to ${digital(q.to)}.`
      : `Count on to ${nextHour(q.from.h)} o'clock first: that's ${toHour} minutes. Then add the rest.`;
  }
  if (q.kind === "later") {
    return q.add >= 60
      ? `${q.add} minutes is ${Math.floor(q.add / 60)} hour${q.add >= 120 ? "s" : ""}${q.add % 60 ? ` and ${q.add % 60} minutes` : ""}. Move the hour first, then the minutes.`
      : `Count on ${q.add} minutes from ${digital(q.start)}. Going past 12 on the clock? Then the hour goes up by 1.`;
  }
  const t = q.kind === "set" ? q.target : q.time;
  const longHand = t.m === 0 ? "the 12" : `the ${t.m / 5}`;
  if (t.m > 30) return `The long hand points to ${longHand}. It's before ${nextHour(t.h)}, so the short hand is just before the ${nextHour(t.h)}.`;
  if (t.m === 0) return `O'clock: the long hand points straight up to 12, the short hand points to the ${t.h}.`;
  return `The long hand points to ${longHand}. It's after ${t.h}, so the short hand is just past the ${t.h}.`;
}
