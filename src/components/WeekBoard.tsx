"use client";
import { useState } from "react";
import type { Ready } from "@/lib/ready";
import { famTint, initials } from "@/lib/glassTint";
import { play } from "@/lib/sounds";
import { SoundLink } from "./glass/SoundLink";
import { useReadyToggle } from "./glass/ReadyPill";

// 📅 The glass calendar and the lesson panel beside it (see WeekGrid for where things go).

export type WeekEvent = {
  id: string;
  day: string;
  name: string;
  time: string;
  when: string;
  mode: string;
  slot: number;
  ready: Ready | null;
  status: string;
  note: boolean;
  /** Position in the day column, in % of its height. */
  top: number;
  height: number;
  hours: number;
  left: number;
  width: number;
};

// The calendar on its own fills the screen (below the menu bar and the day names).
const COLUMN_HEIGHT = "max(520px, calc(100dvh - 220px))";
// About this many pixels tall, to decide how much text fits in a lesson.
const EST_HEIGHT = 680;

export function WeekBoard({
  days,
  hours,
  span,
  events,
  nowTop,
  nowMs,
}: {
  days: { key: string; dow: string; num: number; count: number; isToday: boolean }[];
  hours: { top: number; label: string }[];
  span: number;
  events: WeekEvent[];
  nowTop: number | null;
  nowMs: number;
}) {
  // Start with the next lesson still to come this week (if any) in the panel.
  const [selId, setSelId] = useState<string | null>(() => events.find((e) => e.status === "scheduled" && Date.parse(`${e.day}T00:00:00Z`) >= nowMs - 86_400_000 && e.ready)?.id ?? null);
  const sel = events.find((e) => e.id === selId) ?? null;
  const hourPx = EST_HEIGHT / span;

  return (
    <div className="hidden flex-wrap items-start gap-5 lg:flex">
      <div id="calendar" className="glass-hi min-w-0 flex-[999_1_640px] scroll-mt-24 overflow-x-auto rounded-[26px] p-2.5">
        <div className="min-w-[760px]">
          {/* Day headings */}
          <div className="grid grid-cols-[56px_repeat(7,minmax(0,1fr))]">
            <div />
            {days.map((d) => (
              <div key={d.key} className="rounded-[14px] px-1 pb-2.5 pt-2 text-center" style={{ background: d.isToday ? "var(--th-accent-soft)" : "transparent" }}>
                <div className="text-xs font-semibold tracking-[0.14em]" style={{ color: d.isToday ? "var(--th-accent)" : "var(--th-text-3)" }}>
                  {d.dow}
                </div>
                <div
                  className="font-display mx-auto my-1 grid h-10 w-10 place-items-center rounded-full text-xl font-semibold tabular-nums"
                  style={d.isToday ? { background: "var(--th-accent)", color: "var(--th-accent-ink)" } : undefined}
                >
                  {d.num}
                </div>
                <div className="text-[13px] text-[var(--th-text-3)]">{d.count ? `${d.count} ${d.count === 1 ? "lesson" : "lessons"}` : "free"}</div>
              </div>
            ))}
          </div>

          {/* Hours and lessons */}
          <div className="mt-1.5 grid grid-cols-[56px_repeat(7,minmax(0,1fr))]">
            <div className="relative" style={{ height: COLUMN_HEIGHT }}>
              {hours.map((h) => (
                <span key={h.top} className="absolute right-2 -translate-y-1/2 text-xs tabular-nums text-[var(--th-label)]" style={{ top: `${h.top}%` }}>
                  {h.label}
                </span>
              ))}
            </div>
            {days.map((d) => (
              <div
                key={d.key}
                className="relative border-l border-white/[0.07]"
                style={{
                  height: COLUMN_HEIGHT,
                  backgroundColor: d.isToday ? "color-mix(in srgb, var(--th-accent) 5%, transparent)" : undefined,
                  backgroundImage: "linear-gradient(to bottom, rgba(255,255,255,0.06) 1px, transparent 1px)",
                  backgroundSize: `100% ${100 / span}%`,
                }}
              >
                {d.isToday && nowTop != null ? (
                  <div aria-label="Now" className="pointer-events-none absolute inset-x-0 z-20 h-0.5 bg-[var(--th-now)]" style={{ top: `${nowTop}%` }}>
                    <span className="absolute -left-[5px] -top-1 h-2.5 w-2.5 rounded-full bg-[var(--th-now)]" style={{ animation: "th-pulse 2s infinite" }} />
                  </div>
                ) : null}
                {events
                  .filter((e) => e.day === d.key)
                  .map((e) => (
                    <Block
                      key={e.id}
                      e={e}
                      hourPx={hourPx}
                      selected={e.id === selId}
                      onPick={() => {
                        play("tap");
                        setSelId(e.id);
                      }}
                    />
                  ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      <aside className="glass flex min-w-0 flex-[1_1_280px] flex-col gap-3.5 rounded-[26px] p-[22px] lg:sticky lg:top-28">
        {sel ? <Panel key={sel.id} e={sel} /> : <p className="text-[var(--th-text-3)]">Tap a lesson to see it here.</p>}
        <div className="my-1.5 h-px bg-white/10" />
        <div className="flex flex-col gap-2 text-[13px] text-[var(--th-text-3)]">
          <span className="flex items-center gap-2">
            <span className="h-[9px] w-[9px] rounded-full bg-[var(--th-ready)]" />
            ready
          </span>
          <span className="flex items-center gap-2">
            <span className="h-[9px] w-[9px] rounded-full bg-[var(--th-todo)]" />
            slides or worksheet still to do
          </span>
          <span>✓ done · Each family keeps its own colour, the same as on Students and Money.</span>
        </div>
      </aside>
    </div>
  );
}

function Block({ e, hourPx, selected, onPick }: { e: WeekEvent; hourPx: number; selected: boolean; onPick: () => void }) {
  const h = e.hours * hourPx; // about how tall it is, to decide how much text fits
  const lines = h >= 70 ? 3 : h >= 40 ? 2 : 1;
  const t = famTint(e.slot);
  const cancelled = e.status === "cancelled";
  const done = e.status === "done";
  const dot = done ? null : e.ready ? (e.ready.ready ? "var(--th-ready)" : "var(--th-todo)") : null;
  return (
    <button
      type="button"
      onClick={onPick}
      aria-pressed={selected}
      aria-label={`${e.name}, ${e.when}${e.mode ? `, ${e.mode}` : ""}${done ? ", done" : e.ready ? `, ${e.ready.ready ? "ready" : e.ready.text}` : ""}`}
      className={`absolute z-10 flex flex-col gap-0.5 overflow-hidden rounded-xl px-2 py-1.5 text-left outline-2 outline-offset-1 outline-transparent transition-[transform,box-shadow] duration-150 hover:z-30 hover:-translate-y-px hover:scale-[1.01] hover:shadow-[0_14px_30px_-14px_rgba(0,0,0,0.7)] ${
        selected ? "z-30 !outline-[var(--th-accent)]" : ""
      } ${cancelled ? "opacity-45" : done ? "opacity-75" : ""}`}
      style={{
        top: `calc(${e.top}% + 1px)`,
        height: `max(24px, calc(${e.height}% - 2px))`,
        left: `calc(${e.left}% + 4px)`,
        width: `calc(${e.width}% - 8px)`,
        background: `color-mix(in srgb, ${t.colour} ${done ? 14 : 24}%, rgba(10,30,32,0.55))`,
        border: `1px solid ${t.line}`,
      }}
    >
      <span className={`flex items-center gap-1.5 text-sm font-semibold text-[#f4fbf9] ${cancelled ? "line-through" : ""}`}>
        <span className="min-w-0 flex-1 truncate">{e.name}</span>
        {done ? (
          <span className="shrink-0 text-xs text-[var(--th-ready)]">✓</span>
        ) : dot ? (
          <span className="h-[9px] w-[9px] shrink-0 rounded-full" style={{ background: dot }} />
        ) : null}
      </span>
      {lines >= 2 ? <span className="truncate text-xs tabular-nums text-[#d4e3e0]">{e.time}</span> : null}
      {lines >= 3 ? (
        <span className="truncate text-xs text-[var(--th-text-2)]">
          {e.mode}
          {e.note ? <span className="text-[var(--th-todo-text)]"> · note</span> : null}
          {e.status === "cancelled_charged" || e.status === "no_show" ? <span className="text-[var(--th-todo-text)]"> · charged</span> : null}
        </span>
      ) : null}
    </button>
  );
}

const STATUS: Record<string, string> = { done: "done", cancelled: "cancelled", cancelled_charged: "cancelled, charged", no_show: "no-show, charged" };

/** The chosen lesson: who, when, how, ready or not, then Open lesson and Mark ready. */
function Panel({ e }: { e: WeekEvent }) {
  const t = famTint(e.slot);
  return (
    <div className="page-enter flex flex-col gap-3.5">
      <div className="text-xs font-semibold tracking-[0.16em] text-[var(--th-label)]">LESSON</div>
      <div className="flex items-center gap-3">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-white/15 font-bold" style={{ background: t.bg, color: t.text }}>
          {initials(e.name)}
        </span>
        <div className="min-w-0">
          <div className="font-display text-2xl font-semibold leading-tight">{e.name}</div>
          <div className="text-[var(--th-text-3)]">{e.when}</div>
        </div>
      </div>
      {e.ready && e.status === "scheduled" ? <WithReady e={e} r={e.ready} /> : (
        <>
          <Pills e={e} ready={null} />
          {open(e.id)}
        </>
      )}
    </div>
  );
}

function Pills({ e, ready }: { e: WeekEvent; ready: React.ReactNode }) {
  const t = famTint(e.slot);
  return (
    <>
      <div className="flex flex-wrap gap-2">
        {e.mode ? (
          <span className="pill" style={{ background: t.bg, borderColor: t.line, color: t.text }}>
            {e.mode}
          </span>
        ) : null}
        {STATUS[e.status] ? <span className={`pill ${e.status === "done" ? "ok" : ""}`}>{STATUS[e.status]}</span> : null}
        {ready}
        {e.note ? <span className="pill todo">note to write</span> : null}
      </div>
    </>
  );
}

const open = (id: string) => (
  <SoundLink href={`/lessons/${id}`} sound="open" className="btn-mint mt-1 !h-12 !text-base">
    Open lesson
  </SoundLink>
);

/** Status pills, Open lesson, and Mark ready when there's something still to do. */
function WithReady({ e, r }: { e: WeekEvent; r: Ready }) {
  const { ready, fixed, label, toggle, pending } = useReadyToggle(e.id, r, e.name);
  return (
    <>
      <Pills
        e={e}
        ready={
          <span className={`pill ${ready ? "ok" : "todo"}`} title={r.text}>
            <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: ready ? "var(--th-ready)" : "var(--th-todo)" }} />
            {label}
          </span>
        }
      />
      {open(e.id)}
      {fixed ? null : (
        <button type="button" onClick={toggle} aria-busy={pending} className="glass press h-12 rounded-[14px] font-semibold">
          {ready ? "Not ready after all" : "Mark ready"}
        </button>
      )}
    </>
  );
}
