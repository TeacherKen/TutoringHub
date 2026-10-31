"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { answerFor, FAST_MS, type Question } from "@/lib/facts";
import { sfx } from "@/lib/gameSound";
import { TARGETS, type Shot } from "./Stadium";

// One penalty kick at a time: typing the answer, the ball flying, GOAL!/SAVED, then the next
// question. Used by practice (on your own) and by head-to-head matches.

export type Banner = { key: number; text: string; tone: "goal" | "saved"; sub?: string };
export type KickResult = { q: Question; fact: string; correct: boolean; ms: number; power: boolean; streak: number };

const FLY_MS = 700;

export function usePenalty({ holdGoal = 1350, holdSave = 2400 }: { holdGoal?: number; holdSave?: number } = {}) {
  const [typed, setTyped] = useState("");
  const [shot, setShot] = useState<Shot | null>(null);
  const [banner, setBanner] = useState<Banner | null>(null);
  const [cheer, setCheer] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [powers, setPowers] = useState(0);
  const started = useRef(0);
  const busy = useRef(false);
  const streakRef = useRef(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const reset = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    busy.current = false;
    streakRef.current = 0;
    setTyped("");
    setShot(null);
    setBanner(null);
    setStreak(0);
    setBestStreak(0);
    setPowers(0);
    started.current = Date.now();
  }, []);

  const press = useCallback((k: string) => {
    if (busy.current) return;
    sfx.tap();
    if (k === "del") setTyped((t) => t.slice(0, -1));
    else setTyped((t) => (t.length < 3 ? t + k : t));
  }, []);

  /**
   * Take the kick for question `q` with the typed answer. `counts` is false for second chances
   * (they don't change the streak). `onLand` runs when the ball arrives; `onNext` when it's
   * time for the next question.
   */
  const kick = useCallback(
    (q: Question, typedNow: string, opts: { aim?: number; counts?: boolean; onLand?: (r: KickResult) => void; onNext: (r: KickResult) => void }) => {
      if (busy.current || !typedNow) return null;
      busy.current = true;
      const ms = Date.now() - started.current;
      const correct = Number(typedNow) === answerFor(q);
      const counts = opts.counts ?? true;
      const power = correct && counts && ms < FAST_MS; // not on a second chance: the answer was just shown
      const nextStreak = !counts ? streakRef.current : correct ? streakRef.current + 1 : 0;
      streakRef.current = nextStreak;
      const target = opts.aim ?? Math.floor(Math.random() * TARGETS.length);
      const others = TARGETS.map((_, n) => n).filter((n) => n !== target);
      const keeper = correct ? others[Math.floor(Math.random() * others.length)] : target;
      const result: KickResult = { q, fact: q.fact, correct, ms, power, streak: nextStreak };
      setShot({ target, keeper, result: correct ? "goal" : "saved", power, stage: "fly" });
      if (power) sfx.power();
      else sfx.kick();

      timers.current.push(
        setTimeout(() => {
          setShot((s) => (s ? { ...s, stage: "after" } : s));
          setStreak(nextStreak);
          setBestStreak((b) => Math.max(b, nextStreak));
          if (correct) {
            sfx.goal();
            setCheer((c) => c + 1);
            if (power) setPowers((p) => p + 1);
            const text = !counts ? "GOAL!" : nextStreak === 3 ? "HAT-TRICK!" : nextStreak >= 4 ? `${nextStreak} IN A ROW!` : "GOAL!";
            setBanner({ key: Date.now(), tone: "goal", text, sub: power ? "⚡ Power shot" : counts && nextStreak === 3 ? "3 goals in a row" : undefined });
          } else {
            sfx.save();
            setBanner({ key: Date.now(), tone: "saved", text: "SAVED" });
          }
          opts.onLand?.(result);
          timers.current.push(
            setTimeout(
              () => {
                busy.current = false;
                setShot(null);
                setBanner(null);
                setTyped("");
                started.current = Date.now();
                opts.onNext(result);
              },
              correct ? holdGoal : holdSave,
            ),
          );
        }, FLY_MS),
      );
      return result;
    },
    [holdGoal, holdSave],
  );

  return { typed, shot, banner, cheer, streak, bestStreak, powers, press, kick, reset, started };
}

/** Number keys, Backspace and Enter on a Mac keyboard. */
export function useKeys(active: boolean, press: (k: string) => void, enter: () => void) {
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      // preventDefault: Enter must not also press a focused button (like the sound button),
      // and Backspace must not go back a page.
      if (/^\d$/.test(e.key)) {
        e.preventDefault();
        press(e.key);
      } else if (e.key === "Backspace") {
        e.preventDefault();
        press("del");
      } else if (e.key === "Enter") {
        e.preventDefault();
        enter();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, press, enter]);
}
