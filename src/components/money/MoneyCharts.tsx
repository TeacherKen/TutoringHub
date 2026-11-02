"use client";
import { useEffect, useRef, useState } from "react";
import type { DashGroup, MonthBar, WeekBar } from "@/lib/moneyDash";
import { shortThb } from "@/lib/moneyDash";

// 📊 The Money page's two charts, drawn as plain SVG. Hover (or tap on the iPad) a bar for the details.

const thb = (n: number) => `฿${Math.round(n).toLocaleString("en-US")}`;
const color = (slot: number) => `var(--series-${slot})`;
const dayLabel = (d: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`));
const monthLabel = (m: string, long = false) => new Intl.DateTimeFormat("en-GB", { month: long ? "long" : "short", year: long ? "numeric" : undefined, timeZone: "UTC" }).format(new Date(`${m}-01T00:00:00Z`));

/** The chart's real width in pixels, so text stays a normal size on a phone (no shrinking to fit). */
function useWidth(fallback: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const on = () => setW(Math.max(300, Math.round(el.getBoundingClientRect().width)));
    on();
    const ro = new ResizeObserver(on);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

/** A round number just above `max`, and 3 steps up to it. */
function axis(max: number): number[] {
  if (max <= 0) return [0, 1000, 2000, 3000];
  const raw = max / 3;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw)!;
  return [0, step, step * 2, step * 3];
}

/** A bar with rounded top corners only (the data end), square on the baseline. */
function topRounded(x: number, y: number, w: number, h: number, r = 4) {
  const rr = Math.min(r, w / 2, h);
  return `M${x},${y + h} V${y + rr} Q${x},${y} ${x + rr},${y} H${x + w - rr} Q${x + w},${y} ${x + w},${y + rr} V${y + h} Z`;
}

function Tip({ x, children }: { x: number; children: React.ReactNode }) {
  // x is 0–1 across the chart; keep the box inside it
  return (
    <div
      role="status"
      className="pointer-events-none absolute top-1 z-10 w-56 rounded-xl border border-line bg-surface p-3 text-xs shadow-lg"
      style={{ left: `clamp(0px, calc(${x * 100}% - 7rem), calc(100% - 14rem))` }}
    >
      {children}
    </div>
  );
}

export function WeeksChart({ weeks: all, groups }: { weeks: WeekBar[]; groups: DashGroup[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const [box, W] = useWidth(720);
  // On a narrow screen, the weeks around now (4 back, 5 ahead) so the bars stay readable.
  const now = all.findIndex((w) => w.when === "now");
  const weeks = W < 560 && now >= 0 ? all.slice(Math.max(0, now - 4), now + 6) : all;
  const H = W < 560 ? 220 : 250;
  const left = 46;
  const right = 8;
  const top = 18;
  const bottom = 28;
  const ticks = axis(Math.max(...weeks.map((w) => w.total)));
  const yMax = ticks[ticks.length - 1];
  const plotW = W - left - right;
  const plotH = H - top - bottom;
  const colW = plotW / weeks.length;
  const barW = Math.min(30, colW * 0.62);
  const y = (v: number) => top + plotH - (v / yMax) * plotH;
  const nowIdx = weeks.findIndex((w) => w.when === "now");
  const w = hover != null ? weeks[hover] : null;

  return (
    <div ref={box} className="relative" onPointerLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="block max-w-full" role="img" aria-label="Earnings week by week: taught, and booked lessons still to come">
        <defs>
          {weeks.map((wk, i) => {
            const x = left + i * colW + (colW - barW) / 2;
            return (
              <clipPath key={i} id={`wk-${i}`}>
                <path d={topRounded(x, y(wk.total), barW, Math.max(0, y(0) - y(wk.total)))} />
              </clipPath>
            );
          })}
        </defs>
        {/* grid and axis labels: quiet */}
        {ticks.map((t) => (
          <g key={t}>
            <line x1={left} x2={W - right} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeWidth={1} />
            <text x={left - 6} y={y(t) + 4} textAnchor="end" fontSize={11} fill="var(--muted)">
              {shortThb(t)}
            </text>
          </g>
        ))}
        {/* "this week" marker */}
        {nowIdx >= 0 ? (
          <g>
            <rect x={left + nowIdx * colW} y={top - 14} width={colW} height={plotH + 14} fill="var(--accent-soft)" opacity={0.6} />
            <text x={left + nowIdx * colW + colW / 2} y={top - 4} textAnchor="middle" fontSize={10} fontWeight={600} fill="var(--text)">
              now
            </text>
          </g>
        ) : null}
        {weeks.map((wk, i) => {
          const x = left + i * colW + (colW - barW) / 2;
          let acc = 0;
          const segs: React.ReactNode[] = [];
          for (const kind of ["done", "booked"] as const)
            for (const g of groups) {
              const v = wk[kind][g.key] ?? 0;
              if (v <= 0) continue;
              const y0 = y(acc + v);
              const h = y(acc) - y0;
              acc += v;
              segs.push(
                <rect
                  key={`${kind}-${g.key}`}
                  x={x}
                  y={y0}
                  width={barW}
                  height={h}
                  fill={color(g.slot)}
                  style={{ fillOpacity: kind === "booked" ? "var(--booked-opacity)" : 1 }}
                  stroke="var(--surface)"
                  strokeWidth={2}
                />,
              );
            }
          const label = i % 2 === nowIdx % 2; // every other week, always including this one
          return (
            <g key={wk.start}>
              <g clipPath={`url(#wk-${i})`} opacity={hover == null || hover === i ? 1 : 0.55}>
                {segs}
              </g>
              {label ? (
                <text x={left + i * colW + colW / 2} y={H - 10} textAnchor="middle" fontSize={10} fill={i === nowIdx ? "var(--text)" : "var(--muted)"} fontWeight={i === nowIdx ? 600 : 400}>
                  {dayLabel(wk.start)}
                </text>
              ) : null}
              {/* hit target: the whole column, bigger than the bar */}
              <rect
                x={left + i * colW}
                y={top}
                width={colW}
                height={plotH}
                fill="transparent"
                onPointerEnter={() => setHover(i)}
                onPointerDown={() => setHover(i)}
                aria-label={`Week of ${dayLabel(wk.start)}: ${thb(wk.total)}`}
              />
            </g>
          );
        })}
        <line x1={left} x2={W - right} y1={y(0)} y2={y(0)} stroke="var(--muted)" strokeWidth={1} />
      </svg>
      {w && hover != null ? (
        <Tip x={(left + (hover + 0.5) * colW) / W}>
          <p className="font-semibold">
            Week of {dayLabel(w.start)} · {thb(w.total)}
          </p>
          <p className="text-muted">
            {w.classes} {w.classes === 1 ? "class" : "classes"} · {w.hours} h{w.when === "future" ? " · booked" : w.when === "now" ? " · this week" : ""}
          </p>
          <ul className="mt-2 space-y-1">
            {groups
              .filter((g) => (w.done[g.key] ?? 0) + (w.booked[g.key] ?? 0) > 0)
              .map((g) => (
                <li key={g.key} className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: color(g.slot) }} />
                  <span className="flex-1 truncate">{g.name}</span>
                  <span className="tabular-nums">
                    {thb((w.done[g.key] ?? 0) + (w.booked[g.key] ?? 0))}
                    {w.when === "now" && (w.booked[g.key] ?? 0) > 0 && (w.done[g.key] ?? 0) > 0 ? " *" : ""}
                  </span>
                </li>
              ))}
          </ul>
          {w.total === 0 ? <p className="mt-1 text-muted">No classes.</p> : null}
        </Tip>
      ) : null}
      <Legend groups={groups} />
    </div>
  );
}

function Legend({ groups }: { groups: DashGroup[] }) {
  return (
    <ul className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
      {groups.map((g) => (
        <li key={g.key} className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: color(g.slot) }} />
          {g.name}
        </li>
      ))}
      <li className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-sm" style={{ background: "var(--muted)", opacity: "var(--booked-opacity)" }} />
        Lighter = booked, not taught yet
      </li>
    </ul>
  );
}

export function MonthsChart({ months }: { months: MonthBar[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const [box, W] = useWidth(520);
  const H = 220;
  const left = 46;
  const right = 8;
  const top = 22;
  const bottom = 26;
  const ticks = axis(Math.max(...months.map((m) => m.received + m.expected)));
  const yMax = ticks[ticks.length - 1];
  const plotW = W - left - right;
  const plotH = H - top - bottom;
  const colW = plotW / months.length;
  const barW = Math.min(40, colW * 0.6);
  const y = (v: number) => top + plotH - (v / yMax) * plotH;
  const m = hover != null ? months[hover] : null;

  return (
    <div ref={box} className="relative" onPointerLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="block max-w-full" role="img" aria-label="Money in by month, and what's expected">
        <defs>
          <pattern id="mo-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="6" stroke="var(--accent)" strokeWidth="2" opacity="0.55" />
          </pattern>
        </defs>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={left} x2={W - right} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeWidth={1} />
            <text x={left - 6} y={y(t) + 4} textAnchor="end" fontSize={11} fill="var(--muted)">
              {shortThb(t)}
            </text>
          </g>
        ))}
        {months.map((mo, i) => {
          const x = left + i * colW + (colW - barW) / 2;
          const total = mo.received + mo.expected;
          return (
            <g key={mo.month} opacity={hover == null || hover === i ? 1 : 0.55}>
              {mo.received > 0 ? <path d={topRounded(x, y(mo.received), barW, y(0) - y(mo.received), mo.expected > 0 ? 0 : 4)} fill="var(--accent)" /> : null}
              {mo.expected > 0 ? (
                <path d={topRounded(x, y(total), barW, y(mo.received) - y(total) - (mo.received > 0 ? 2 : 0))} fill="url(#mo-hatch)" stroke="var(--accent)" strokeWidth={1} strokeDasharray="3 2" />
              ) : null}
              {total > 0 ? (
                <text x={x + barW / 2} y={y(total) - 6} textAnchor="middle" fontSize={11} fill="var(--text)" fontWeight={500}>
                  {mo.expected > 0 ? "≈" : ""}
                  {shortThb(total)}
                </text>
              ) : null}
              <text x={x + barW / 2} y={H - 8} textAnchor="middle" fontSize={11} fill={mo.when === "now" ? "var(--text)" : "var(--muted)"} fontWeight={mo.when === "now" ? 600 : 400}>
                {monthLabel(mo.month)}
              </text>
              <rect x={left + i * colW} y={top} width={colW} height={plotH} fill="transparent" onPointerEnter={() => setHover(i)} onPointerDown={() => setHover(i)} />
            </g>
          );
        })}
        <line x1={left} x2={W - right} y1={y(0)} y2={y(0)} stroke="var(--muted)" strokeWidth={1} />
      </svg>
      {m && hover != null ? (
        <Tip x={(left + (hover + 0.5) * colW) / W}>
          <p className="font-semibold">{monthLabel(m.month, true)}</p>
          {m.received > 0 || m.when !== "future" ? <p>Received: {thb(m.received)}</p> : null}
          {m.expected > 0 ? <p className="text-muted">Expected: {thb(m.expected)} (booked Preply lessons and package renewals)</p> : null}
        </Tip>
      ) : null}
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        <li className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-accent" /> Received
        </li>
        <li className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm border border-dashed border-accent" /> Expected
        </li>
      </ul>
    </div>
  );
}
