"use client";
import { useEffect, useState } from "react";

type Screen = { game: string; html: string; updated_at: string } | null;
const NAMES: Record<string, string> = {
  "magic-square": "Magic Square Academy",
  "wolf-vs-sheep": "Wolf vs Sheep",
  tt: "Times Tables Sprint",
  qm: "Quick Maths",
  sd: "Mini Sudoku",
};

/** Live view of a student's game screen (a picture refreshed every 2 seconds, nothing can be clicked). */
export function WatchScreen({ studentId, name }: { studentId: string; name: string }) {
  const [screen, setScreen] = useState<Screen>(null);
  const [now, setNow] = useState(0);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch(`/api/watch/${studentId}`, { cache: "no-store" });
        if (res.ok && alive) setScreen((await res.json()) as Screen);
      } catch {
        /* try again */
      }
      if (alive) setNow(Date.now());
    };
    load();
    const id = setInterval(load, 2000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [studentId]);

  const ago = screen && now ? Math.max(0, Math.round((now - new Date(screen.updated_at).getTime()) / 1000)) : null;

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted">
        {screen ? (
          <>
            {name} is playing <strong className="text-ink">{NAMES[screen.game] ?? screen.game}</strong>
            {ago != null ? ` · updated ${ago < 5 ? "just now" : `${ago}s ago`}` : ""}
            {ago != null && ago > 20 ? " (they may have left the game)" : ""}
          </>
        ) : (
          `Waiting for ${name} to open a game…`
        )}
      </p>
      {screen ? (
        <iframe
          title={`${name}'s game screen`}
          srcDoc={screen.html}
          sandbox=""
          className="pointer-events-none h-[520px] w-full rounded-xl border border-line bg-white"
        />
      ) : null}
    </div>
  );
}
