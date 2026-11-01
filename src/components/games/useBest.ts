"use client";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

// Personal best, saved on this device only. Read with useSyncExternalStore so the page drawn on the
// server (no best yet) and the one in the browser agree, then the saved best appears. Storage can be
// blocked (private browsing), so every read and write is wrapped and a copy is kept in memory too.

const subscribe = (onChange: () => void) => {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
};

export function useBest(key: string, better: (a: number, b: number) => boolean) {
  const storageKey = `th-best-${key}`;
  const [memory, setMemory] = useState<Record<string, number>>({});
  // `better` is usually written inline, so it's new on every draw; keep the latest in a ref so `offer`
  // stays the same function (games' timers depend on it, and a changing one restarted them every second).
  const betterRef = useRef(better);
  useEffect(() => {
    betterRef.current = better;
  });
  const read = useCallback((): string | null => {
    try {
      return window.localStorage.getItem(storageKey);
    } catch {
      return null;
    }
  }, [storageKey]);
  const stored = useSyncExternalStore(subscribe, read, () => null);
  const best = stored != null && stored !== "" && Number.isFinite(Number(stored)) ? Number(stored) : (memory[storageKey] ?? null);

  const offer = useCallback(
    (score: number): boolean => {
      const raw = read();
      const current = raw != null && raw !== "" ? Number(raw) : (memory[storageKey] ?? null);
      if (current != null && !betterRef.current(score, current)) return false;
      try {
        window.localStorage.setItem(storageKey, String(score));
      } catch {
        /* not saved on the device — the in-memory copy still shows it */
      }
      setMemory((m) => ({ ...m, [storageKey]: score })); // also re-draws, so the stored value is read again
      return true;
    },
    [read, storageKey, memory],
  );
  return { best, offer };
}
