"use client";
import { useCallback, useState } from "react";

/** Personal best saved on this device only (wrapped in try/catch: storage can be blocked). */
export function useBest(key: string, better: (a: number, b: number) => boolean) {
  const storageKey = `th-best-${key}`;
  const [best, setBest] = useState<number | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const v = window.localStorage.getItem(storageKey);
      return v ? Number(v) : null;
    } catch {
      return null;
    }
  });
  const offer = useCallback(
    (score: number): boolean => {
      let current: number | null = null;
      try {
        const v = window.localStorage.getItem(storageKey);
        current = v ? Number(v) : null;
      } catch {
        current = best;
      }
      if (current == null || better(score, current)) {
        try {
          window.localStorage.setItem(storageKey, String(score));
        } catch {
          /* not saved — fine */
        }
        setBest(score);
        return true;
      }
      setBest(current);
      return false;
    },
    [storageKey, better, best],
  );
  return { best, offer };
}
