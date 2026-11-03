// 🎨 A family's colour as glass tints (the colour itself is --series-1…8, the same on every page).

export function famTint(slot: number) {
  const c = `var(--series-${slot || 8})`;
  return {
    colour: c,
    /** soft fill for avatars, pills and lesson blocks */
    bg: `color-mix(in srgb, ${c} 16%, transparent)`,
    /** a border in the family colour */
    line: `color-mix(in srgb, ${c} 42%, transparent)`,
    /** readable text in the family colour */
    text: `color-mix(in srgb, ${c} 55%, #ffffff)`,
  };
}

/** "Nivaan & Jaian" → "NJ", "Alice" → "Al", "IP & IQ" → "IP"… two letters for an avatar. */
export function initials(name: string): string {
  const parts = name.split(/\s*&\s*|\s*,\s*/).filter(Boolean);
  if (parts.length > 1 && parts[0][0].toUpperCase() !== parts[1][0].toUpperCase()) return (parts[0][0] + parts[1][0]).toUpperCase();
  if (parts.length > 1) return parts[0].slice(0, 2);
  const w = name.trim();
  return w.length <= 2 ? w.toUpperCase() : w[0].toUpperCase() + w[1].toLowerCase();
}
