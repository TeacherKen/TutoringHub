"use client";
import { useEffect, useRef, useState } from "react";
import { ampm, CLOCK_LEVELS, clockHint, clockQ, DAY, digital, duration, hhmm, hourAngle, timeJumps, toFace, minuteAngle, same, STEP, type ClockLevel, type ClockQ, type Time } from "@/lib/clock";
import { NumberPad } from "./NumberPad";
import { useBest } from "./useBest";

// ⏰ Clock Rescue: set the clock (drag the hands), read the clock (pick the time), and "how much later?".
// 10 questions, beat your fastest time. Wrong answers get a kind hint, then try again.

const COUNT = 10;
/** Rounded so the server and the browser draw exactly the same numbers. */
const r2 = (n: number) => Math.round(n * 100) / 100;
const secs = (tenths: number) => `${(tenths / 10).toFixed(1)}s`;

/** The clock. With `onChange`, both hands can be dragged (the long hand snaps to `step` minutes). */
/** Minutes past 12:00 (0–719) ↔ a clock time. */
const toTotal = (t: Time) => ((t.h % 12) * 60 + t.m + 720) % 720;
const fromTotal = (n: number): Time => {
  const t = ((n % 720) + 720) % 720;
  const h = Math.floor(t / 60);
  return { h: h === 0 ? 12 : h, m: t % 60 };
};

/**
 * A clock. With onChange, it works like a real one: turn the long hand and the short hand follows
 * (going past 12 moves on to the next hour), or turn the short hand and the long hand spins with it.
 * There are also + and − buttons for the hour and the minutes.
 */
export function ClockFace({ time, onChange, step = 5, size = 260 }: { time: Time; onChange?: (t: Time) => void; step?: number; size?: number }) {
  const svg = useRef<SVGSVGElement>(null);
  const drag = useRef<{ hand: "h" | "m"; total: number; last: number } | null>(null);
  const live = useRef(time);
  useEffect(() => {
    live.current = time;
  });
  const R = 100;

  const angleAt = (e: React.PointerEvent) => {
    const box = svg.current!.getBoundingClientRect();
    const x = e.clientX - (box.left + box.width / 2);
    const y = e.clientY - (box.top + box.height / 2);
    return { deg: ((Math.atan2(x, -y) * 180) / Math.PI + 360) % 360, dist: (Math.hypot(x, y) / (box.width / 2)) * 110 };
  };
  const set = (total: number) => {
    const snapped = Math.round(total / step) * step;
    const next = fromTotal(snapped);
    if (next.h !== live.current.h || next.m !== live.current.m) {
      live.current = next;
      onChange?.(next);
    }
  };
  // Follow the finger: add up how far it has turned (so going round past 12 changes the hour).
  const follow = (deg: number) => {
    const d = drag.current;
    if (!d) return;
    const perTurn = d.hand === "m" ? 60 : 720; // minutes for one full turn of this hand
    const now = (deg / 360) * perTurn;
    let diff = now - d.last;
    if (diff > perTurn / 2) diff -= perTurn;
    if (diff < -perTurn / 2) diff += perTurn;
    d.total += diff;
    d.last = now;
    set(d.total);
  };
  const move = (e: React.PointerEvent) => {
    if (!onChange || !drag.current) return;
    follow(angleAt(e).deg);
  };
  const down = (e: React.PointerEvent) => {
    if (!onChange) return;
    const { deg, dist } = angleAt(e);
    const t = live.current;
    const gap = (a: number) => Math.min(Math.abs(deg - a), 360 - Math.abs(deg - a));
    const toM = gap(minuteAngle(t));
    const toH = gap(hourAngle(t));
    // The nearer hand; when they're close together, near the middle means the short hand.
    const hand: "h" | "m" = Math.abs(toM - toH) < 20 ? (dist < 50 ? "h" : "m") : toM < toH ? "m" : "h";
    const total = toTotal(t);
    drag.current = { hand, total, last: hand === "m" ? (minuteAngle(t) / 360) * 60 : (hourAngle(t) / 360) * 720 };
    e.currentTarget.setPointerCapture?.(e.pointerId);
    follow(deg); // the hand jumps to the finger
  };
  const nudge = (minutes: number) => {
    const total = toTotal(live.current) + minutes;
    const next = fromTotal(Math.round(total / step) * step);
    live.current = next;
    onChange?.(next);
  };

  const hand = (deg: number, len: number, width: number, colour: string, knob: number) => {
    const a = (deg * Math.PI) / 180;
    const x = r2(Math.sin(a) * len);
    const y = r2(-Math.cos(a) * len);
    return (
      <g>
        <line x1={0} y1={0} x2={x} y2={y} stroke={colour} strokeWidth={width} strokeLinecap="round" />
        {onChange ? <circle cx={x} cy={y} r={knob} fill={colour} stroke="#fffaf0" strokeWidth={2} /> : null}
      </g>
    );
  };

  const btn = "grid h-12 w-12 place-items-center rounded-full bg-surface-2 text-2xl font-bold transition active:scale-90 hover:bg-line";
  return (
    <div className="space-y-2">
      <svg
        ref={svg}
        viewBox="-110 -110 220 220"
        width={size}
        height={size}
        className={`mx-auto block max-w-full select-none ${onChange ? "cursor-grab touch-none active:cursor-grabbing" : ""}`}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
        role="img"
        aria-label={onChange ? `Clock set to ${digital(time)}` : "A clock"}
      >
        <circle r={R + 6} fill="#fffaf0" stroke="#2b3a4a" strokeWidth={6} />
        {Array.from({ length: 60 }, (_, i) => {
          const a = (i * 6 * Math.PI) / 180;
          const big = i % 5 === 0;
          const r1 = big ? R - 10 : R - 5;
          return <line key={i} x1={r2(Math.sin(a) * r1)} y1={r2(-Math.cos(a) * r1)} x2={r2(Math.sin(a) * R)} y2={r2(-Math.cos(a) * R)} stroke="#2b3a4a" strokeWidth={big ? 2.5 : 1} opacity={big ? 0.9 : 0.45} />;
        })}
        {Array.from({ length: 12 }, (_, i) => {
          const n = i + 1;
          const a = (n * 30 * Math.PI) / 180;
          return (
            <text key={n} x={r2(Math.sin(a) * (R - 24))} y={r2(-Math.cos(a) * (R - 24))} textAnchor="middle" dominantBaseline="central" fontSize={17} fontWeight={700} fill="#1f2a36">
              {n}
            </text>
          );
        })}
        {hand(hourAngle(time), 46, 10, "#1f2a36", 8)}
        {hand(minuteAngle(time), 70, 6, "#d9622b", 9)}
        <circle r={7} fill="#1f2a36" />
      </svg>
      {onChange ? (
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
          <div className="flex items-center gap-2">
            <button type="button" className={btn} onClick={() => nudge(-60)} aria-label="Hour back">
              −
            </button>
            <span className="w-16 text-center text-sm font-semibold">
              <span className="mx-auto mb-0.5 block h-1.5 w-8 rounded-full bg-[#1f2a36]" aria-hidden />
              Hour
            </span>
            <button type="button" className={btn} onClick={() => nudge(60)} aria-label="Hour forward">
              +
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" className={btn} onClick={() => nudge(-step)} aria-label={`${step} minutes back`}>
              −
            </button>
            <span className="w-16 text-center text-sm font-semibold">
              <span className="mx-auto mb-0.5 block h-1 w-10 rounded-full bg-[#d9622b]" aria-hidden />
              Minutes
            </span>
            <button type="button" className={btn} onClick={() => nudge(step)} aria-label={`${step} minutes forward`}>
              +
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function Choices({ options, onPick, wrongPick }: { options: string[]; onPick: (i: number) => void; wrongPick: number | null }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {options.map((o, i) => (
        <button
          key={o}
          type="button"
          onClick={() => onPick(i)}
          disabled={wrongPick === i}
          className={`min-h-14 rounded-2xl border-2 px-3 text-lg font-semibold ${wrongPick === i ? "border-danger/40 text-danger line-through opacity-60" : "border-line bg-surface hover:border-accent"}`}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

export function ClockRescue() {
  const [level, setLevel] = useState<ClockLevel>("hour");
  const [phase, setPhase] = useState<"setup" | "play" | "done" | "demo">("setup");
  const [q, setQ] = useState<ClockQ | null>(null);
  const [n, setN] = useState(0);
  const [set, setSet] = useState<Time>({ h: 12, m: 0 });
  const [answer, setAnswer] = useState("");
  const [wrong, setWrong] = useState(false);
  const [wrongPick, setWrongPick] = useState<number | null>(null);
  const [startedAt, setStartedAt] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [newBest, setNewBest] = useState(false);
  const { best, offer } = useBest(`ck-${level}`, (a, b) => a < b);

  useEffect(() => {
    if (phase !== "play") return;
    const id = setInterval(() => setElapsed(Date.now() - startedAt), 100);
    return () => clearInterval(id);
  }, [phase, startedAt]);

  function fresh(next: ClockQ) {
    setQ(next);
    setSet({ h: 12, m: 0 });
    setAnswer("");
    setWrong(false);
    setWrongPick(null);
  }

  function start() {
    setN(0);
    fresh(clockQ(level));
    setStartedAt(Date.now());
    setElapsed(0);
    setNewBest(false);
    setPhase("play");
  }

  function right() {
    const next = n + 1;
    setN(next);
    if (next >= COUNT) {
      const time = Math.round((Date.now() - startedAt) / 100);
      setElapsed(time * 100);
      setNewBest(offer(time));
      setPhase("done");
    } else fresh(clockQ(level, Math.random, q));
  }

  if (phase === "setup") {
    return (
      <div className="space-y-4">
        <div className="pointer-events-none">
          <ClockFace time={{ h: 10, m: 10 }} size={150} />
        </div>
        <p className="text-muted">{COUNT} questions: set the clock, read the clock, and work out times. Wrong answers get a hint.</p>
        <div className="grid gap-2">
          {(Object.keys(CLOCK_LEVELS) as ClockLevel[]).map((l) => (
            <button
              key={l}
              type="button"
              aria-pressed={level === l}
              onClick={() => setLevel(l)}
              className={`min-h-12 rounded-xl border px-4 text-left ${level === l ? "border-accent bg-accent-soft font-medium text-accent" : "border-line bg-surface"}`}
            >
              {CLOCK_LEVELS[l]}
            </button>
          ))}
        </div>
        {best != null ? <p className="text-sm text-muted">Your fastest: {secs(best)}</p> : null}
        <button type="button" className="btn-primary w-full" onClick={start}>
          Start
        </button>
        <button type="button" className="btn-secondary w-full" onClick={() => setPhase("demo")}>
          🧑‍🏫 Teacher demo clock
        </button>
      </div>
    );
  }

  if (phase === "demo") return <ClockDemo onBack={() => setPhase("setup")} />;

  if (phase === "done") {
    return (
      <div className="space-y-4 text-center">
        <p className="text-sm text-muted">All {COUNT} clocks rescued! ⏰</p>
        <p className="text-5xl font-semibold tabular-nums">{secs(Math.round(elapsed / 100))}</p>
        <p className={newBest ? "font-medium text-ok" : "text-muted"}>{newBest ? "New fastest time! 🏆" : `Your fastest: ${best != null ? secs(best) : "—"}`}</p>
        <div className="flex gap-2">
          <button type="button" className="btn-secondary flex-1" onClick={() => setPhase("setup")}>
            Change level
          </button>
          <button type="button" className="btn-primary flex-1" onClick={start}>
            Play again
          </button>
        </div>
      </div>
    );
  }

  if (!q) return null;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm text-muted">
        <span>
          Question <strong className="text-ink tabular-nums">{n + 1}</strong> of {COUNT}
        </span>
        <span className="tabular-nums">{secs(Math.round(elapsed / 100))}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
        <div className="h-full bg-accent transition-all" style={{ width: `${(n / COUNT) * 100}%` }} />
      </div>

      {q.kind === "set" ? (
        <>
          <p className="text-center text-2xl font-semibold">
            Show <span className="text-accent">{q.say}</span>
          </p>
          <ClockFace time={set} onChange={setSet} step={STEP[level]} />
          <p className="text-center text-sm text-muted">Drag the hands. Long hand = minutes, short hand = hours.</p>
          <button type="button" className="btn-primary w-full" onClick={() => (same(set, q.target) ? right() : setWrong(true))}>
            Check
          </button>
        </>
      ) : q.kind === "read" ? (
        <>
          <p className="text-center text-2xl font-semibold">What time is it?</p>
          <ClockFace time={q.time} size={230} />
          <Choices
            options={q.options}
            wrongPick={wrongPick}
            onPick={(i) => {
              if (i === q.answer) right();
              else {
                setWrongPick(i);
                setWrong(true);
              }
            }}
          />
        </>
      ) : q.kind === "later" ? (
        <>
          <p className="text-center text-xl font-semibold">
            It&apos;s <span className="tabular-nums">{digital(q.start)}</span>. What time will it be <span className="text-accent">{q.add} minutes</span> later?
          </p>
          <ClockFace time={q.start} size={200} />
          <Choices
            options={q.options}
            wrongPick={wrongPick}
            onPick={(i) => {
              if (i === q.answer) right();
              else {
                setWrongPick(i);
                setWrong(true);
              }
            }}
          />
        </>
      ) : (
        <>
          <p className="text-center text-xl font-semibold">
            How many minutes from <span className="tabular-nums text-accent">{digital(q.from)}</span> to <span className="tabular-nums text-accent">{digital(q.to)}</span>?
          </p>
          <div className="flex items-center justify-center gap-3">
            <ClockFace time={q.from} size={130} />
            <span className="text-3xl text-muted" aria-hidden>
              →
            </span>
            <ClockFace time={q.to} size={130} />
          </div>
          <p className="text-center text-sm text-muted">Type the number of minutes.</p>
          <NumberPad
            value={answer}
            onChange={setAnswer}
            onSubmit={() => {
              if (!answer) return;
              if (Number(answer) === q.answer) right();
              else {
                setWrong(true);
                setAnswer("");
              }
            }}
            max={3}
            wrong={wrong && !answer}
          />
        </>
      )}

      {wrong ? <p className="rounded-2xl bg-surface-2 p-3 text-center text-danger">Not quite. {clockHint(q)}</p> : null}
    </div>
  );
}

/** One time to set: big 24-hour digits with ▲▼, the 12-hour way of saying it, and a clock whose hands can be dragged. */
function TimeSetter({ label, mins, onChange }: { label: string; mins: number; onChange: (m: number) => void }) {
  const wrap = (m: number) => ((m % DAY) + DAY) % DAY;
  const pm = mins >= 720;
  const arrow = "grid h-9 w-12 place-items-center rounded-xl bg-surface-2 text-lg hover:bg-line active:scale-95";
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl bg-surface-2/60 p-3">
      <p className="text-sm font-semibold uppercase tracking-wide text-muted">{label}</p>
      <div className="flex items-center gap-1.5">
        <div className="flex flex-col items-center gap-1">
          <button type="button" aria-label={`${label}: hour up`} className={arrow} onClick={() => onChange(wrap(mins + 60))}>▲</button>
          <span className="w-14 text-center text-4xl font-bold tabular-nums">{hhmm(mins).slice(0, 2)}</span>
          <button type="button" aria-label={`${label}: hour down`} className={arrow} onClick={() => onChange(wrap(mins - 60))}>▼</button>
        </div>
        <span className="pb-1 text-4xl font-bold">:</span>
        <div className="flex flex-col items-center gap-1">
          <button type="button" aria-label={`${label}: minutes up`} className={arrow} onClick={() => onChange(wrap(mins - (mins % 5) + 5))}>▲</button>
          <span className="w-14 text-center text-4xl font-bold tabular-nums">{hhmm(mins).slice(3)}</span>
          <button type="button" aria-label={`${label}: minutes down`} className={arrow} onClick={() => onChange(wrap(mins % 5 ? mins - (mins % 5) : mins - 5))}>▼</button>
        </div>
      </div>
      <p className="text-sm text-muted">
        {pm ? "🌙" : "☀️"} {ampm(mins)}
      </p>
      <ClockFace
        time={toFace(mins)}
        size={170}
        step={5}
        // Dragging keeps the same half of the day (am stays am, pm stays pm).
        onChange={(t) => onChange((pm ? 720 : 0) + (t.h % 12) * 60 + t.m)}
      />
    </div>
  );
}

/**
 * 🧑‍🏫 For Mr Ken to show a question to the class: set a start and an end time (the end can be the next day),
 * let the children think, then reveal the jumps one by one: to the next o'clock, to midnight, whole hours, the minutes.
 */
function ClockDemo({ onBack }: { onBack: () => void }) {
  const [start, setStart] = useState(21 * 60 + 30);
  const [end, setEnd] = useState(6 * 60 + 30);
  const [shown, setShown] = useState(0);
  const { jumps, total, nextDay } = timeJumps(start, end);
  const done = shown > jumps.length;
  const change = (set: (m: number) => void) => (m: number) => {
    set(m);
    setShown(0);
  };
  const dayTag = (m: number) => (m >= DAY ? " (next day)" : "");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <button type="button" className="btn-quiet min-h-10 px-0 text-sm text-muted" onClick={onBack}>
          ‹ Back
        </button>
        <p className="font-semibold">Teacher demo clock</p>
        <span className="w-12" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <TimeSetter label="Start" mins={start} onChange={change(setStart)} />
        <TimeSetter label={nextDay ? "End · next day" : "End"} mins={end} onChange={change(setEnd)} />
      </div>

      <p className="text-center text-xl font-semibold">
        How long is it from <span className="text-accent">{hhmm(start)}</span> to <span className="text-accent">{hhmm(end)}</span>
        {nextDay ? " the next day" : ""}?
      </p>

      {shown > 0 ? (
        <ol className="space-y-2">
          {jumps.slice(0, shown).map((j, i) => (
            <li key={i} className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-2xl bg-surface-2 px-3.5 py-2.5 text-lg">
              <span className="tabular-nums">{hhmm(j.from)}{dayTag(j.from)}</span>
              <span className="text-muted">→</span>
              <span className="font-semibold tabular-nums">{hhmm(j.to)}{dayTag(j.to)}</span>
              <span className="ml-auto rounded-full bg-accent-soft px-3 py-0.5 font-bold text-accent">+ {duration(j.mins)}</span>
              {j.note ? <span className="w-full text-sm text-muted">{j.note === "noon" ? "12 noon" : `12 ${j.note}`}</span> : null}
            </li>
          ))}
        </ol>
      ) : null}

      {done ? (
        <div className="rounded-2xl border-2 border-accent bg-accent-soft p-4 text-center">
          <p className="text-sm text-muted">{jumps.map((j) => duration(j.mins)).join(" + ")}</p>
          <p className="text-3xl font-bold text-accent">= {duration(total)}</p>
          {total >= 60 && total % 60 ? <p className="text-sm text-muted">({total} minutes)</p> : null}
        </div>
      ) : null}

      <div className="flex gap-2">
        {shown > 0 ? (
          <button type="button" className="btn-secondary" onClick={() => setShown(0)}>
            Hide
          </button>
        ) : null}
        {!done ? (
          <button type="button" className="btn-primary flex-1" disabled={total === 0} onClick={() => setShown((n) => n + 1)}>
            {shown === 0 ? "Show the first step" : shown < jumps.length ? "Next step" : "Show the answer"}
          </button>
        ) : null}
      </div>
    </div>
  );
}
