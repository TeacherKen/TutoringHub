"use client";
import type { KeyboardEvent } from "react";
import { fracWords, type Frac } from "@/lib/fractions";

// The pictures for the fraction games: a pizza, a chocolate bar, and a fraction written properly
// (top number over bottom number). Slices can be tapped when the game asks the child to shade them.

const CHEESE = "#f4b942";
const SAUCE = "#d8572a";
const PEPPERONI = "#b3261e";
const CRUST = "#c98a3a";
const PLATE = "#f4ede1";
const PLATE_LINE = "#d6c8b0";
const CHOC = "#6b3a1f";
const CHOC_LIGHT = "#8a4f2c";

const tapKeys = (e: KeyboardEvent, go: () => void) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    go();
  }
};

/** A pizza cut into `parts` equal slices; shaded slices have cheese and pepperoni, the others are empty plate. */
export function Pie({ parts, shaded, onTap, size = 240, label }: { parts: number; shaded: readonly number[]; onTap?: (i: number) => void; size?: number; label: string }) {
  const on = new Set(shaded);
  const R = 46;
  const at = (deg: number, r = R) => [50 + r * Math.cos((deg * Math.PI) / 180), 50 + r * Math.sin((deg * Math.PI) / 180)];
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} role="group" aria-label={label} className="max-w-full touch-manipulation select-none">
      <circle cx="50" cy="50" r={R + 2.5} fill={CRUST} />
      {Array.from({ length: parts }, (_, i) => {
        const a0 = -90 + (360 / parts) * i;
        const a1 = a0 + 360 / parts;
        const [x0, y0] = at(a0);
        const [x1, y1] = at(a1);
        const mid = (a0 + a1) / 2;
        const filled = on.has(i);
        // One slice = the whole pizza (an arc that starts and ends at the same point draws nothing).
        const d = parts === 1 ? `M50 ${50 - R} A${R} ${R} 0 1 1 50 ${50 + R} A${R} ${R} 0 1 1 50 ${50 - R} Z` : `M50 50 L${x0} ${y0} A${R} ${R} 0 ${360 / parts > 180 ? 1 : 0} 1 ${x1} ${y1} Z`;
        const dots = parts <= 4 ? [18, 32] : parts <= 8 ? [30] : [32];
        return (
          <g
            key={i}
            role={onTap ? "button" : undefined}
            tabIndex={onTap ? 0 : undefined}
            aria-pressed={onTap ? filled : undefined}
            aria-label={onTap ? `Slice ${i + 1} of ${parts}${filled ? ", shaded" : ""}` : undefined}
            onClick={onTap ? () => onTap(i) : undefined}
            onKeyDown={onTap ? (e) => tapKeys(e, () => onTap(i)) : undefined}
            className={onTap ? "cursor-pointer outline-none focus-visible:opacity-80" : undefined}
          >
            <path d={d} fill={filled ? CHEESE : PLATE} stroke={filled ? SAUCE : PLATE_LINE} strokeWidth="1.2" strokeLinejoin="round" />
            {filled
              ? dots.map((r, j) => {
                  const [cx, cy] = at(mid + (dots.length > 1 ? (j ? 8 : -8) * (4 / parts) : 0), r);
                  return <circle key={j} cx={cx} cy={cy} r={parts > 8 ? 2.6 : 3.6} fill={PEPPERONI} />;
                })
              : null}
          </g>
        );
      })}
    </svg>
  );
}

/** A chocolate bar in `parts` equal pieces. `plain` draws a simple bar in the app's colour instead. */
export function Bar({
  parts,
  shaded,
  onTap,
  label,
  plain = false,
  className = "",
}: {
  parts: number;
  shaded: readonly number[];
  onTap?: (i: number) => void;
  label: string;
  plain?: boolean;
  className?: string;
}) {
  const on = new Set(shaded);
  const W = 300;
  const H = plain ? 22 : 64;
  const gap = plain ? 2 : 3;
  const w = (W - gap * (parts - 1)) / parts;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="group" aria-label={label} className={`block w-full touch-manipulation select-none ${className}`} preserveAspectRatio="none">
      {Array.from({ length: parts }, (_, i) => {
        const x = i * (w + gap);
        const filled = on.has(i);
        return (
          <g
            key={i}
            role={onTap ? "button" : undefined}
            tabIndex={onTap ? 0 : undefined}
            aria-pressed={onTap ? filled : undefined}
            aria-label={onTap ? `Piece ${i + 1} of ${parts}${filled ? ", shaded" : ""}` : undefined}
            onClick={onTap ? () => onTap(i) : undefined}
            onKeyDown={onTap ? (e) => tapKeys(e, () => onTap(i)) : undefined}
            className={onTap ? "cursor-pointer outline-none focus-visible:opacity-80" : undefined}
          >
            {plain ? (
              <rect x={x} y="0" width={w} height={H} rx="3" fill={filled ? "var(--accent)" : "var(--surface-2, #e8e6df)"} stroke="var(--border, #d6d3cb)" strokeWidth="1" />
            ) : (
              <>
                <rect x={x} y="0" width={w} height={H} rx="5" fill={filled ? CHOC : PLATE} stroke={filled ? "#4a2612" : PLATE_LINE} strokeWidth="1.5" strokeDasharray={filled ? undefined : "4 3"} />
                {filled ? <rect x={x + 5} y="6" width={Math.max(2, w - 10)} height={H - 12} rx="3" fill={CHOC_LIGHT} /> : null}
              </>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/** ³⁄₄ written the way it's written in a maths book: top number, a line, bottom number. */
export function FracText({ f, className = "text-4xl", top }: { f: Frac; className?: string; /** shown instead of the top number, e.g. "?" */ top?: React.ReactNode }) {
  return (
    <span className={`inline-flex flex-col items-center align-middle font-semibold leading-none tabular-nums ${className}`} role="img" aria-label={top != null ? `question mark over ${f.d}` : fracWords(f)}>
      <span className="px-[0.12em]">{top ?? f.n}</span>
      <span aria-hidden className="my-[0.08em] h-[0.07em] min-h-[2px] w-full rounded-full bg-current" />
      <span className="px-[0.12em]">{f.d}</span>
    </span>
  );
}
