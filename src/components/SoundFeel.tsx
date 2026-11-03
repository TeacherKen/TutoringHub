"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import { FEEL_DEFAULTS, readFeel, saveFeel, type Feel } from "@/lib/glassTheme";
import { getSoundSettings, onSoundSettings, play, reloadSoundSettings, setSoundSettings, type SoundKind, type SoundSettings, type SoundStyle } from "@/lib/sounds";
import { ThemePicker } from "./ThemePicker";

// 🔊 Settings → Sound & feel: click sounds (on/off, volume, style, try each one), glass strength,
// animations and the colour theme. All saved on this device only (the MacBook and the iPad can differ).

const TRY: { kind: SoundKind; label: string }[] = [
  { kind: "tap", label: "Tap" },
  { kind: "nav", label: "Change page" },
  { kind: "success", label: "Marked ready" },
  { kind: "coin", label: "Money" },
  { kind: "launch", label: "Game start" },
];

export function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} className={`sw ${on ? "on" : ""}`}>
      <span className="knob" />
    </button>
  );
}

function Segment<T extends string>({ label, value, options, onPick }: { label: string; value: T; options: { value: T; label: string }[]; onPick: (v: T) => void }) {
  return (
    <div role="group" aria-label={label} className="glass flex gap-0.5 rounded-[14px] p-0.5">
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onPick(o.value)} className={`seg press !h-10 ${value === o.value ? "is-on" : ""}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function SoundFeel() {
  // Sound settings live in sounds.ts (the top-bar button changes them too).
  const [sound, setSound] = useState<SoundSettings>(() => getSoundSettings());
  useEffect(() => {
    const sync = () => setSound(reloadSoundSettings());
    sync();
    return onSoundSettings(() => setSound(getSoundSettings()));
  }, []);
  const feel = useSyncExternalStore<string>(
    (on) => {
      window.addEventListener("th-feel", on);
      return () => window.removeEventListener("th-feel", on);
    },
    () => JSON.stringify(readFeel()),
    () => JSON.stringify(FEEL_DEFAULTS),
  );
  const f = JSON.parse(feel) as Feel;

  return (
    <section className="glass-hi flex flex-col gap-4 rounded-[26px] p-5 sm:p-6" style={{ borderColor: "color-mix(in srgb, var(--th-accent) 35%, transparent)" }}>
      <div className="flex items-center gap-2.5">
        <h2 className="font-display text-[22px] font-semibold">Sound &amp; feel</h2>
        <span className="rounded-full px-2.5 py-0.5 text-xs font-bold tracking-[0.06em]" style={{ background: "var(--th-accent-soft)", color: "color-mix(in srgb, var(--th-accent) 40%, #ffffff)" }}>
          NEW
        </span>
      </div>
      <p className="-mt-2 text-sm text-[var(--th-text-3)]">Saved on this device only, so the MacBook and the iPad can be different.</p>

      <div className="flex items-center gap-4">
        <div className="flex-1">
          <div className="font-semibold">Click sounds</div>
          <div className="text-sm text-[var(--th-text-3)]">Soft sounds for buttons, pages and the games corner.</div>
        </div>
        <Switch
          label="Click sounds"
          on={sound.enabled}
          onChange={(v) => {
            setSoundSettings({ enabled: v });
            if (v) play("toggle");
          }}
        />
      </div>
      <div className={`flex flex-col gap-4 ${sound.enabled ? "" : "opacity-50"}`}>
        <div className="flex items-center gap-3.5">
          <label htmlFor="th-vol" className="w-16 shrink-0">
            Volume
          </label>
          <input
            id="th-vol"
            type="range"
            min={0}
            max={100}
            step={5}
            value={sound.volume}
            onChange={(e) => setSoundSettings({ volume: Number(e.target.value) })}
            onPointerUp={() => play("tap", 0, true)}
            onKeyUp={() => play("tap", 0, true)}
            className="h-7 flex-1 accent-[var(--th-accent)]"
          />
          <span className="w-11 text-right font-semibold tabular-nums">{sound.volume}%</span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="w-16 text-sm font-medium text-[var(--th-text-2)]">Style</span>
          <Segment<SoundStyle>
            label="Sound style"
            value={sound.style}
            options={[
              { value: "soft", label: "Soft" },
              { value: "crisp", label: "Crisp" },
              { value: "playful", label: "Playful" },
            ]}
            onPick={(v) => {
              setSoundSettings({ style: v });
              play("tap", 0, true);
            }}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {TRY.map((t) => (
            <button key={t.kind} type="button" onClick={() => play(t.kind, 0, true)} className="glass press h-10 rounded-xl px-3.5 text-sm font-medium">
              ▶ {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="h-px bg-white/10" />

      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-[12rem] flex-1">
          <div className="font-semibold">Glass strength</div>
          <div className="text-sm text-[var(--th-text-3)]">Light uses less blur, which is quicker on an older iPad.</div>
        </div>
        <Segment<Feel["glass"]>
          label="Glass strength"
          value={f.glass}
          options={[
            { value: "full", label: "Full" },
            { value: "light", label: "Light" },
          ]}
          onPick={(v) => {
            saveFeel({ glass: v });
            play("flip");
          }}
        />
      </div>
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <div className="font-semibold">Animations</div>
          <div className="text-sm text-[var(--th-text-3)]">Glows drifting, bars growing, pages sliding in.</div>
        </div>
        <Switch
          label="Animations"
          on={f.motion}
          onChange={(v) => {
            saveFeel({ motion: v });
            play("toggle");
          }}
        />
      </div>

      <div className="h-px bg-white/10" />

      <div>
        <div className="font-semibold">Colour theme</div>
        <div className="mb-3 text-sm text-[var(--th-text-3)]">The background, accent and glows.</div>
        <ThemePicker />
      </div>
    </section>
  );
}
