"use client";
import { answerFor, questionParts, type Question } from "@/lib/facts";
import type { Shot } from "./Stadium";

// The question and the big number pad, shared by practice and matches.

export const PANEL = "rounded-3xl bg-[radial-gradient(120%_90%_at_50%_0%,#18397a_0%,#0b1d42_55%,#081633_100%)] p-3 text-white shadow-xl sm:p-4";
export const GLASS = "bg-white/[.07] ring-1 ring-inset ring-white/12";

export function Controls({
  q,
  typed,
  shot,
  second,
  clockKey,
  onPress,
  onKick,
  locked = false,
}: {
  q: Question;
  typed: string;
  shot: Shot | null;
  second?: boolean;
  clockKey: number | string; // changes for each new question, to restart the power bar
  onPress: (k: string) => void;
  onKick: () => void;
  locked?: boolean;
}) {
  const savedNow = shot?.result === "saved" && shot.stage === "after";
  const answer = answerFor(q);
  const said = questionParts(q)
    .map((p) => p ?? answer)
    .join(" ");
  return (
    <div className="flex flex-col gap-3">
      <div className={`${GLASS} flex flex-1 flex-col justify-center gap-3 rounded-2xl px-4 py-4 text-center`}>
        {second ? <p className="font-sport text-lg font-bold italic text-[#ffc629]">Second chance</p> : null}
        <p className="font-sport text-[clamp(48px,7.5vw,84px)] font-extrabold italic leading-none tabular-nums" data-question data-answer={answer} aria-label={questionParts(q).map((p) => p ?? "what").join(" ")}>
          {questionParts(q).map((p, n) =>
            p === null ? (
              <span key={n} className={`inline-block min-w-[0.8em] rounded-lg px-1 ${savedNow ? "text-[#ff6b70]" : typed ? "bg-white/10 text-[#ffc629]" : "bg-white/10 text-white/35"}`}>
                {savedNow ? answer : typed || "?"}
              </span>
            ) : (
              <span key={n}>{n ? " " : ""}{p}{n < 4 ? " " : ""}</span>
            ),
          )}
        </p>
        <div className="mx-auto w-full max-w-sm">
          <div className="h-2 overflow-hidden rounded-full bg-white/10">
            <div key={clockKey} className="tt-drain h-full rounded-full" style={{ animationPlayState: shot || locked ? "paused" : "running" }} />
          </div>
          <p className="mt-1.5 text-xs text-white/60">Answer while the bar is gold for a power shot</p>
        </div>
        <p className={`min-h-6 text-[15px] font-medium ${savedNow ? "text-[#ff8a8e]" : "text-white/85"}`}>
          {savedNow ? `${said}. You'll get it next time!` : shot ? "" : typed ? "Tap the goal to aim, or press Kick" : "Type your answer"}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9", "del", "0", "kick"].map((k) => (
          <button
            key={k}
            type="button"
            disabled={locked || !!shot || (k === "kick" && !typed)}
            onClick={() => (k === "kick" ? onKick() : onPress(k))}
            className={`font-sport flex h-14 items-center justify-center gap-2 rounded-xl transition active:scale-95 disabled:opacity-35 lg:h-[60px] ${
              k === "kick" ? "bg-[#ffc629] text-2xl font-extrabold italic text-[#0b1d42] hover:bg-[#ffd447]" : `${GLASS} text-[32px] font-bold text-white hover:bg-white/15 active:bg-white/25`
            }`}
            aria-label={k === "kick" ? "Kick" : k === "del" ? "Delete" : k}
          >
            {k === "kick" ? (
              <>
                <BallIcon /> Kick
              </>
            ) : k === "del" ? (
              <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M9 5h11a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H9l-6-7z" />
                <path d="M12.5 9.5l5 5M17.5 9.5l-5 5" />
              </svg>
            ) : (
              k
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

export function BallIcon() {
  return (
    <svg viewBox="-13 -13 26 26" className="h-6 w-6" aria-hidden>
      <circle r="12" fill="#ffffff" stroke="#0b1d42" strokeWidth="1.5" />
      <path d="M0 -4.6 L4.4 -1.4 L2.7 3.8 L-2.7 3.8 L-4.4 -1.4Z" fill="#0b1d42" />
      <path d="M0 -4.6 L0 -11 M4.4 -1.4 L10.5 -3.4 M2.7 3.8 L6.5 9.5 M-2.7 3.8 L-6.5 9.5 M-4.4 -1.4 L-10.5 -3.4" stroke="#0b1d42" strokeWidth="1.3" />
    </svg>
  );
}

export function Shirt({ colour, text }: { colour: string; text: string }) {
  return (
    <svg viewBox="0 0 40 36" className="h-11 w-11" aria-hidden>
      <path d="M13 2 L4 6.5 L1 15 L8 16.5 L9 34 L31 34 L32 16.5 L39 15 L36 6.5 L27 2 Q20 6 13 2Z" fill={colour} />
      <path d="M13 2 Q20 6 27 2" stroke="rgba(0,0,0,.25)" strokeWidth="1.5" fill="none" />
      <text x="20" y="27" textAnchor="middle" fontSize="12" fontWeight="800" fontFamily='"Barlow Condensed", sans-serif' fill={text}>
        10
      </text>
    </svg>
  );
}

export type Confetti = { dx: number; dy: number; r: number; c: string; d: number };
export const makeConfetti = (colours: string[], n = 50, spread = 620): Confetti[] =>
  Array.from({ length: n }, () => ({
    dx: (Math.random() - 0.5) * spread,
    dy: -60 + Math.random() * 320,
    r: Math.random() * 900 - 450,
    c: colours[Math.floor(Math.random() * colours.length)],
    d: Math.random() * 200,
  }));

export function ConfettiBurst({ pieces, className = "left-1/2 top-24" }: { pieces: Confetti[]; className?: string }) {
  if (!pieces.length) return null;
  return (
    <div className={`pointer-events-none absolute ${className}`}>
      {pieces.map((c, n) => (
        <span
          key={n}
          className="tt-confetti absolute block h-3 w-1.5 rounded-sm"
          style={{ background: c.c, animationDelay: `${c.d}ms`, ["--dx" as string]: `${c.dx}px`, ["--dy" as string]: `${c.dy}px`, ["--r" as string]: `${c.r}deg` }}
        />
      ))}
    </div>
  );
}
