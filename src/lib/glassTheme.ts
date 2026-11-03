// 🎨 Colour themes for TutoringHub Glass. Saved per device (like sounds), never in the database.
// Each theme sets the background, the accent (mint by default) and the three glow orbs.
// Family colours and the ready / to-do / now colours stay the same in every theme.

export type GlassTheme = { id: string; name: string; bg: string; accent: string; ink: string; orbs: [string, string, string] };

/** rgb triplets for the orbs, so they can fade out with rgba(). */
export const GLASS_THEMES: GlassTheme[] = [
  { id: "mint", name: "Mint", bg: "#071719", accent: "#6EE7C8", ink: "#06201B", orbs: ["45,212,191", "96,165,250", "251,146,60"] },
  { id: "ocean", name: "Ocean", bg: "#06121F", accent: "#7DD3FC", ink: "#04182A", orbs: ["56,189,248", "99,102,241", "45,212,191"] },
  { id: "violet", name: "Violet", bg: "#100C1E", accent: "#C4B5FD", ink: "#1A1238", orbs: ["139,92,246", "236,72,153", "59,130,246"] },
  { id: "rose", name: "Rose", bg: "#170B12", accent: "#FDA4AF", ink: "#2A0A12", orbs: ["244,63,94", "251,146,60", "168,85,247"] },
  { id: "sunset", name: "Sunset", bg: "#160F08", accent: "#FCD34D", ink: "#2A1A02", orbs: ["251,146,60", "244,63,94", "250,204,21"] },
  { id: "forest", name: "Forest", bg: "#07140C", accent: "#86EFAC", ink: "#062012", orbs: ["34,197,94", "20,184,166", "163,230,53"] },
  { id: "graphite", name: "Graphite", bg: "#0C0F13", accent: "#E2E8F0", ink: "#0F172A", orbs: ["100,116,139", "71,85,105", "148,163,184"] },
];

export const THEME_KEY = "tutoringhub.theme";
export const themeById = (id: string | null | undefined) => GLASS_THEMES.find((t) => t.id === id) ?? GLASS_THEMES[0];

/** CSS custom properties for a theme (set on <html>, read by .th-glass, the orbs and the page background). */
export function themeVars(t: GlassTheme): Record<string, string> {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(t.accent.slice(i, i + 2), 16));
  return {
    "--g-bg": t.bg,
    "--g-accent": t.accent,
    "--g-accent-ink": t.ink,
    "--g-accent-soft": `rgba(${r},${g},${b},0.16)`,
    "--g-accent-line": `rgba(${r},${g},${b},0.45)`,
    "--g-orb-1": t.orbs[0],
    "--g-orb-2": t.orbs[1],
    "--g-orb-3": t.orbs[2],
  };
}

/** Put a theme on the page now and remember it on this device. */
export function applyTheme(id: string) {
  const t = themeById(id);
  const root = document.documentElement;
  for (const [k, v] of Object.entries(themeVars(t))) root.style.setProperty(k, v);
  root.dataset.glass = t.id;
  window.dispatchEvent(new Event("th-theme"));
  try {
    localStorage.setItem(THEME_KEY, t.id);
  } catch {
    /* storage blocked: the theme still shows until the page is closed */
  }
}

/**
 * A tiny script run before the page draws, so the saved theme shows straight away (no flash of mint).
 * Built from the list above; it only reads one localStorage key.
 */
export function themeBootScript(): string {
  const table = Object.fromEntries(GLASS_THEMES.map((t) => [t.id, themeVars(t)]));
  return `try{var t=localStorage.getItem(${JSON.stringify(THEME_KEY)});var v=${JSON.stringify(table)}[t];if(v){var s=document.documentElement.style;for(var k in v)s.setProperty(k,v[k]);document.documentElement.dataset.glass=t}}catch(e){}`;
}
