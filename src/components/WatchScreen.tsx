"use client";
import { useEffect, useRef, useState } from "react";

type Screen = { game: string; html: string; updated_at: string } | null;
const NAMES: Record<string, string> = {
  "magic-square": "Magic Square Academy",
  "wolf-vs-sheep": "Wolf vs Sheep",
  tt: "Times Tables Sprint",
  qm: "Quick Maths",
  sd: "Mini Sudoku",
};

function attr(html: string, name: string, fallback: number): number {
  const m = new RegExp(`${name}="(\\d+)"`).exec(html.slice(0, 2000));
  return m ? Number(m[1]) : fallback;
}

/**
 * Live view of a student's game screen: a picture refreshed every 2 seconds, shown at the
 * student's screen size and scroll position, scaled to fit. Nothing in it can be clicked.
 */
export function WatchScreen({ studentId, name }: { studentId: string; name: string }) {
  const [screen, setScreen] = useState<Screen>(null);
  const [now, setNow] = useState(0);
  const [boxWidth, setBoxWidth] = useState(800);
  const box = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch(`/api/watch/${studentId}`, { cache: "no-store" });
        if (res.ok && alive) {
          const next = (await res.json()) as Screen;
          setScreen((prev) => (prev && next && prev.html === next.html ? { ...prev, updated_at: next.updated_at } : next));
        }
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

  useEffect(() => {
    if (!box.current) return;
    const ro = new ResizeObserver(([e]) => setBoxWidth(e.contentRect.width));
    ro.observe(box.current);
    return () => ro.disconnect();
  }, []);

  const vw = screen ? attr(screen.html, "data-vw", 1024) : 1024;
  const vh = screen ? attr(screen.html, "data-vh", 700) : 700;
  const scale = Math.min(1, boxWidth / vw);

  // Scroll the picture to where the student is looking.
  function placeScroll() {
    const win = frame.current?.contentWindow;
    const doc = frame.current?.contentDocument;
    if (!screen || !win || !doc) return;
    win.scrollTo(attr(screen.html, "data-scroll-x", 0), attr(screen.html, "data-scroll-y", 0));
    doc.querySelectorAll("[data-th-scroll]").forEach((el) => {
      const [x, y] = (el.getAttribute("data-th-scroll") ?? "0:0").split(":").map(Number);
      el.scrollLeft = x;
      el.scrollTop = y;
    });
  }

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
      <div ref={box} className="w-full">
        {screen ? (
          <div className="overflow-hidden rounded-xl border border-line bg-white" style={{ height: vh * scale }}>
            <iframe
              ref={frame}
              title={`${name}'s game screen`}
              srcDoc={screen.html}
              // Scripts are removed from the picture and blocked here; same-origin only lets us scroll it.
              sandbox="allow-same-origin"
              onLoad={placeScroll}
              className="pointer-events-none origin-top-left border-0"
              style={{ width: vw, height: vh, transform: `scale(${scale})` }}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
