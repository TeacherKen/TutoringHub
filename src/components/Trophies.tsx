import type { Trophy, TrophyIcon } from "@/lib/trophies";

// Medals for Football Times Tables. Won ones are gold; ones still to win are grey with a
// small progress bar, so a child can see how close they are.

const GLYPH: Record<Exclude<TrophyIcon, "table" | "divide" | "missing">, string> = {
  ball: "M12 4.5l3.6 2.6-1.4 4.2H9.8L8.4 7.1zM12 4.5V2.8M15.6 7.1l2.3-1M14.2 11.3l1.8 2.6M9.8 11.3L8 13.9M8.4 7.1l-2.3-1",
  star: "M12 3.2l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.5l-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z",
  flame: "M12 3c.6 3.2 4.6 4.8 4.6 9.2A4.6 4.6 0 0 1 12 17a4.6 4.6 0 0 1-4.6-4.8c0-2.3 1.4-3.3 2-5 .9 1.6 1.4 2.3 2.2 2.6C11.8 7.6 11.4 5.3 12 3z",
  bolt: "M13.5 2.5L5.5 13h5.5l-1 8.5 8-10.5h-5.5z",
  target: "M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zm0 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm0 3a1 1 0 1 0 0 2 1 1 0 0 0 0-2z",
  calendar: "M5 6.5h14v12.5H5zM5 10h14M9 4v4M15 4v4",
  cup: "M8 4h8v5a4 4 0 0 1-8 0zM8 6H5.5a2.5 2.5 0 0 0 2.6 3.4M16 6h2.5a2.5 2.5 0 0 1-2.6 3.4M12 13v3.5M9 19.5h6M10 16.5h4v3h-4z",
};

export function Medal({ t, size = 56 }: { t: Trophy; size?: number }) {
  const gold = t.got;
  const id = `m-${t.id}-${gold ? "g" : "s"}`;
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden className="shrink-0">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={gold ? "#ffe17a" : "#d6dbe4"} />
          <stop offset="1" stopColor={gold ? "#e7a500" : "#9aa3b3"} />
        </linearGradient>
      </defs>
      <circle cx="24" cy="24" r="21" fill={`url(#${id})`} />
      <circle cx="24" cy="24" r="16.5" fill="none" stroke={gold ? "#fff4c2" : "#eef1f6"} strokeOpacity="0.8" strokeWidth="1.5" />
      {t.icon === "table" || t.icon === "divide" || t.icon === "missing" ? (
        <text x="24" y={t.icon === "table" ? 30.5 : 32} textAnchor="middle" fontSize={t.icon === "table" ? 17 : 22} fontWeight="800" fontFamily='"Barlow Condensed", system-ui, sans-serif' fill={gold ? "#7a4b00" : "#5d6676"}>
          {t.icon === "table" ? `${t.table}×` : t.icon === "divide" ? "÷" : "?"}
        </text>
      ) : (
        <g transform="translate(12 12)" fill={t.icon === "calendar" || t.icon === "cup" || t.icon === "ball" ? "none" : gold ? "#7a4b00" : "#5d6676"} stroke={gold ? "#7a4b00" : "#5d6676"} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round">
          <path d={GLYPH[t.icon]} fillRule="evenodd" />
        </g>
      )}
    </svg>
  );
}

/** A row of medals. `dark` for the game's match panel, light for the app pages. */
export function TrophyShelf({ items, dark = false, compact = false }: { items: Trophy[]; dark?: boolean; compact?: boolean }) {
  if (!items.length) return null;
  return (
    <ul className={`grid gap-2 ${compact ? "grid-cols-[repeat(auto-fill,minmax(64px,1fr))]" : "grid-cols-[repeat(auto-fill,minmax(96px,1fr))]"}`}>
      {items.map((t) => (
        <li
          key={t.id}
          title={`${t.name}: ${t.how}${t.got ? " ✓" : ` (${t.have}/${t.need})`}`}
          className={`flex flex-col items-center gap-1 rounded-xl p-2 text-center ${dark ? "bg-white/[.06]" : "bg-surface-2"} ${t.got ? "" : "opacity-75"}`}
        >
          <Medal t={t} size={compact ? 40 : 52} />
          {compact ? null : (
            <>
              <span className={`text-xs font-semibold leading-tight ${dark ? "text-white" : ""}`}>{t.name}</span>
              {t.got ? (
                <span className={`text-[11px] leading-tight ${dark ? "text-white/60" : "text-muted"}`}>{t.how}</span>
              ) : (
                <span className="flex w-full flex-col items-center gap-0.5">
                  <span className={`text-[11px] leading-tight ${dark ? "text-white/60" : "text-muted"}`}>{t.how}</span>
                  <span className={`h-1.5 w-full overflow-hidden rounded-full ${dark ? "bg-white/15" : "bg-line"}`}>
                    <span className="block h-full rounded-full bg-[#e7a500]" style={{ width: `${Math.round((100 * t.have) / t.need)}%` }} />
                  </span>
                </span>
              )}
            </>
          )}
        </li>
      ))}
    </ul>
  );
}
