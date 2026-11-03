/**
 * TutoringHub UI sounds — no audio files, generated in the browser with the Web Audio API.
 * Reference implementation from the TutoringHub Glass mockups. Adapt to the codebase
 * (e.g. put in lib/sounds.ts and call from a small React hook or context).
 *
 * Rules:
 * - Browsers block audio until the first click/tap; the AudioContext is created lazily
 *   on the first play() inside a click handler, so this "just works".
 * - Settings (on/off, volume, style) are per device, saved in localStorage
 *   (the MacBook and the students' iPad can differ).
 * - Keep them quiet (gain ≤ 0.06).
 * - Never throw: if audio is unavailable, fail silently.
 * - The games themselves keep their own existing sounds; this module is for the app shell.
 */

export type SoundKind =
  | 'tap'      // any button or card
  | 'nav'      // changing page / menu item
  | 'toggle'   // switches, checkboxes, sounds-on
  | 'flip'     // Prev/Today/Next, filters, segmented controls
  | 'open'     // Open lesson / open a student
  | 'refresh'  // calendar refresh finished
  | 'success'  // marked ready / saved / calendar added
  | 'remove'   // removed / undo-ish
  | 'undo'
  | 'coin'     // money: draft renewal message
  | 'hover'    // very soft tick when moving across chart bars (pass step = bar index)
  | 'pick'     // "Who's playing?" name picked
  | 'launch'   // a game starts
  | 'corner'   // Open games corner
  // kept from the shared library, not used in TutoringHub yet:
  | 'start' | 'pause' | 'tick' | 'done' | 'bell' | 'all' | 'goal' | 'whoosh' | 'spinTick' | 'win';

export type SoundStyle = 'soft' | 'crisp' | 'playful';

export interface SoundSettings {
  enabled: boolean;
  volume: number;      // 0–100, default 70
  style: SoundStyle;   // default 'soft'
}

const KEY = 'tutoringhub.sound';
const DEFAULTS: SoundSettings = { enabled: true, volume: 70, style: 'soft' };

let ctx: AudioContext | null = null;
let settings: SoundSettings = load();

function load(): SoundSettings {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null;
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS };
  } catch {
    return { ...DEFAULTS };
  }
}

export function getSoundSettings(): SoundSettings {
  return { ...settings };
}

export function setSoundSettings(next: Partial<SoundSettings>): SoundSettings {
  settings = { ...settings, ...next };
  try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch { /* ignore */ }
  return { ...settings };
}

function audio(): AudioContext | null {
  try {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return null;
    if (!ctx) ctx = new AC();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** Play a UI sound. `force` plays even when sounds are off (for the "Try each sound" list). */
export function play(kind: SoundKind, step = 0, force = false): void {
  if (!settings.enabled && !force) return;
  const ac = audio();
  if (!ac) return;

  const t = ac.currentTime;
  const v = settings.volume / 70;
  if (v <= 0) return;
  const st = settings.style;
  const mult = st === 'crisp' ? 1.18 : st === 'playful' ? 1.25 : 0.9;
  const wave: OscillatorType = st === 'crisp' ? 'triangle' : 'sine';

  const tone = (f: number, at: number, dur: number, vol: number, type?: OscillatorType) => {
    try {
      const o = ac.createOscillator();
      const g = ac.createGain();
      const d = st === 'crisp' ? dur * 0.7 : dur;
      o.type = type ?? wave;
      o.frequency.setValueAtTime(f * mult, t + at);
      g.gain.setValueAtTime(0.0001, t + at);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol * v), t + at + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t + at + d);
      o.connect(g); g.connect(ac.destination);
      o.start(t + at); o.stop(t + at + d + 0.03);
      if (st === 'playful') {
        // a soft octave sparkle on top
        const o2 = ac.createOscillator();
        const g2 = ac.createGain();
        o2.type = 'sine';
        o2.frequency.setValueAtTime(f * mult * 2, t + at + 0.02);
        g2.gain.setValueAtTime(0.0001, t + at + 0.02);
        g2.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol * v * 0.35), t + at + 0.03);
        g2.gain.exponentialRampToValueAtTime(0.0001, t + at + 0.02 + dur);
        o2.connect(g2); g2.connect(ac.destination);
        o2.start(t + at + 0.02); o2.stop(t + at + dur + 0.06);
      }
    } catch { /* ignore */ }
  };

  switch (kind) {
    case 'tap':      tone(1800, 0, 0.045, 0.05); tone(3000, 0, 0.02, 0.02); break;
    case 'nav':      tone(740, 0, 0.08, 0.045); tone(1110, 0.045, 0.1, 0.04); break;
    case 'toggle':   tone(620, 0, 0.07, 0.05); break;
    case 'flip':     tone(520, 0, 0.05, 0.04, 'triangle'); tone(780, 0.03, 0.06, 0.035, 'triangle'); break;
    case 'open':     tone(523, 0, 0.1, 0.05); tone(784, 0.08, 0.22, 0.05); break;
    case 'refresh':  tone(500, 0, 0.12, 0.035); tone(750, 0.1, 0.12, 0.035); tone(1000, 0.2, 0.18, 0.035); break;
    case 'hover':    tone(1400 + Math.min(12, step) * 60, 0, 0.025, 0.018); break;
    case 'pick':     tone(880, 0, 0.08, 0.05, 'triangle'); tone(1320, 0.06, 0.16, 0.045, 'triangle'); break;
    case 'launch':   [392, 523, 659, 784].forEach((f, i) => tone(f, i * 0.07, 0.2, 0.05, 'triangle')); tone(1047, 0.3, 0.4, 0.04); break;
    case 'corner':   [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, i * 0.08, 0.35, 0.045)); break;
    case 'start':    tone(523, 0, 0.12, 0.05); tone(659, 0.08, 0.12, 0.05); tone(784, 0.16, 0.22, 0.05); break;
    case 'pause':    tone(784, 0, 0.1, 0.045); tone(523, 0.07, 0.16, 0.045); break;
    case 'tick':     tone(1200, 0, 0.05, 0.04, 'square'); break;
    case 'done':     [784, 988, 1175, 1568].forEach((f, i) => tone(f, i * 0.12, 0.9, 0.05)); break;
    case 'bell':     [0, 0.6].forEach((d, i) => { const f = i ? 784 : 1046; tone(f, d, 1.4, 0.06, 'sine'); tone(f * 2.76, d, 0.5, 0.015, 'sine'); }); break;
    case 'success':  tone(660, 0, 0.12, 0.05); tone(880, 0.07, 0.12, 0.05); tone(1320, 0.14, 0.3, 0.045); break;
    case 'remove':   tone(600, 0, 0.08, 0.04, 'triangle'); tone(420, 0.06, 0.12, 0.04, 'triangle'); break;
    case 'coin': {   const f = 988 * Math.pow(2, Math.min(24, step) / 24); tone(f, 0, 0.07, 0.045, 'triangle'); tone(f * 1.335, 0.06, 0.2, 0.04, 'triangle'); break; }
    case 'all':      [0, 0.05, 0.1, 0.15, 0.2].forEach((d, i) => tone(880 * Math.pow(2, i / 6), d, 0.14, 0.04, 'triangle')); break;
    case 'undo':     tone(700, 0, 0.07, 0.04, 'triangle'); tone(500, 0.05, 0.12, 0.04, 'triangle'); break;
    case 'goal':     [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => tone(f, i * 0.08, 0.7, 0.04)); break;
    case 'whoosh':   tone(300, 0, 0.25, 0.03, 'sawtooth'); tone(450, 0.05, 0.2, 0.02, 'sawtooth'); break;
    case 'spinTick': tone(1500 + (step % 2) * 200, 0, 0.03, 0.035, 'square'); break;
    case 'win':      [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.09, 0.5, 0.05)); tone(1568, 0.36, 0.8, 0.03); break;
  }
}

/**
 * Wheel spin ticks that slow down like a real wheel (~4s).
 * Returns a cancel function. Call play('win') yourself when the wheel stops.
 */
export function spinTicks(durationMs = 3900): () => void {
  const timers: ReturnType<typeof setTimeout>[] = [];
  let at = 0, gap = 45, k = 0;
  while (at < durationMs) {
    const step = k;
    timers.push(setTimeout(() => play('spinTick', step), at));
    at += gap; gap *= 1.085; k++;
  }
  return () => timers.forEach(clearTimeout);
}
