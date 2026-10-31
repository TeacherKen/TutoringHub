// Small game sounds made in the browser (no sound files to download).
// iPad needs a tap before sounds can play, so the first keypad tap "unlocks" them.

let ctx: AudioContext | null = null;
let noise: AudioBuffer | null = null;
const KEY = "tutoringhub-sound";

export function soundOn(): boolean {
  try {
    return localStorage.getItem(KEY) !== "off";
  } catch {
    return true;
  }
}
export function setSoundOn(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? "on" : "off");
  } catch {
    /* fine */
  }
}

function audio(): AudioContext | null {
  if (typeof window === "undefined" || !soundOn()) return null;
  try {
    if (!ctx) {
      const C = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!C) return null;
      ctx = new C();
    }
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function noiseBuffer(a: AudioContext) {
  if (!noise) {
    noise = a.createBuffer(1, a.sampleRate * 2, a.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return noise;
}

function tone(a: AudioContext, freq: number, at: number, dur: number, type: OscillatorType = "triangle", vol = 0.18, endFreq?: number) {
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, a.currentTime + at);
  if (endFreq) o.frequency.exponentialRampToValueAtTime(endFreq, a.currentTime + at + dur);
  g.gain.setValueAtTime(0.0001, a.currentTime + at);
  g.gain.exponentialRampToValueAtTime(vol, a.currentTime + at + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + at + dur);
  o.connect(g).connect(a.destination);
  o.start(a.currentTime + at);
  o.stop(a.currentTime + at + dur + 0.05);
}

/** Crowd noise: filtered hiss that swells and fades. */
function crowd(a: AudioContext, dur: number, vol: number, freq: number, falling = false) {
  const src = a.createBufferSource();
  src.buffer = noiseBuffer(a);
  src.loop = true;
  const f = a.createBiquadFilter();
  f.type = "bandpass";
  f.frequency.setValueAtTime(freq, a.currentTime);
  if (falling) f.frequency.exponentialRampToValueAtTime(freq / 2.5, a.currentTime + dur);
  f.Q.value = 0.7;
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, a.currentTime);
  g.gain.exponentialRampToValueAtTime(vol, a.currentTime + 0.25);
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + dur);
  src.connect(f).connect(g).connect(a.destination);
  src.start();
  src.stop(a.currentTime + dur + 0.05);
}

export const sfx = {
  tap() {
    const a = audio();
    if (a) tone(a, 660, 0, 0.05, "sine", 0.06);
  },
  kick() {
    const a = audio();
    if (a) tone(a, 160, 0, 0.18, "sine", 0.5, 45);
  },
  power() {
    const a = audio();
    if (!a) return;
    tone(a, 160, 0, 0.18, "sine", 0.5, 45);
    tone(a, 300, 0.02, 0.35, "sawtooth", 0.05, 1400);
  },
  goal() {
    const a = audio();
    if (!a) return;
    crowd(a, 1.8, 0.35, 900);
    [523, 659, 784, 1047].forEach((f, i) => tone(a, f, 0.05 + i * 0.09, 0.25, "triangle", 0.14));
  },
  save() {
    const a = audio();
    if (!a) return;
    crowd(a, 1.1, 0.22, 700, true);
    tone(a, 392, 0.05, 0.25, "triangle", 0.12);
    tone(a, 311, 0.3, 0.4, "triangle", 0.12);
  },
  whistle() {
    const a = audio();
    if (!a) return;
    tone(a, 2700, 0, 0.18, "sine", 0.08);
    tone(a, 2700, 0.24, 0.45, "sine", 0.08);
  },
  win() {
    const a = audio();
    if (!a) return;
    crowd(a, 2.4, 0.3, 1000);
    [523, 523, 523, 659, 784, 659, 784, 1047].forEach((f, i) => tone(a, f, i * 0.13, i === 7 ? 0.6 : 0.16, "square", 0.07));
  },
};
