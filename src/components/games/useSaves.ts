"use client";
import { useMemo, useState, useSyncExternalStore } from "react";

// 💾 Each player's progress in a game, saved on this device (by the name they type). Nothing leaves the device.

const subscribe = (cb: () => void) => {
  window.addEventListener("storage", cb);
  return () => window.removeEventListener("storage", cb);
};

export function useSaves<T>(game: string) {
  const key = `th-save-${game}`;
  const raw = useSyncExternalStore(
    subscribe,
    () => {
      try {
        return localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    () => null,
  );
  const [mem, setMem] = useState<Record<string, T> | null>(null);
  const all = useMemo<Record<string, T>>(() => {
    if (mem) return mem;
    try {
      return raw ? (JSON.parse(raw) as Record<string, T>) : {};
    } catch {
      return {};
    }
  }, [mem, raw]);

  const write = (next: Record<string, T>) => {
    setMem(next);
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      /* private window: progress lasts until the page closes */
    }
  };
  return {
    all,
    save: (name: string, data: T) => write({ ...all, [name]: data }),
    remove: (name: string) => {
      const next = { ...all };
      delete next[name];
      write(next);
    },
  };
}
