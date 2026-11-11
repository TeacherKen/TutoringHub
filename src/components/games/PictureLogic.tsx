"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { cluesOf, lineDone, PIC_LEVELS, PICTURES, solved, type Picture, type PicLevel } from "@/lib/games/nonogram";
import { useBest } from "./useBest";
import { BigButton, GameHero, HowToPlay, LevelPicker, ResultCard, THEMES } from "./GameKit";

const T = THEMES.pixel;

// Picture Logic (pixel tiles from Kenney "Pixel Platformer", CC0): the numbers say how many squares in a row (or column) are coloured, in order.
// Colour the right squares and a hidden picture appears. Drag to colour many at once.

type Cell = 0 | 1 | 2; // empty, coloured, crossed out
const secs = (ms: number) => {
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`;
};

function choosePicture(level: PicLevel, last: string | null): Picture {
  const list = PICTURES[level].filter((p) => p.name !== last);
  return list[Math.floor(Math.random() * list.length)];
}

export function PictureLogic() {
  const [level, setLevel] = useState<PicLevel>("small");
  const [phase, setPhase] = useState<"setup" | "play" | "won">("setup");
  const [pic, setPic] = useState<Picture | null>(null);
  const [grid, setGrid] = useState<Cell[][]>([]);
  const [mode, setMode] = useState<1 | 2>(1);
  const [startedAt, setStartedAt] = useState(0);
  const [took, setTook] = useState(0);
  const [newBest, setNewBest] = useState(false);
  const paint = useRef<Cell | null>(null);
  const { best, offer } = useBest(`pl-${level}`, (a, b) => a < b, "s");

  function start(lv = level) {
    const p = choosePicture(lv, pic?.name ?? null);
    const n = p.rows.length;
    setPic(p);
    setGrid(Array.from({ length: n }, () => Array<Cell>(n).fill(0)));
    setStartedAt(Date.now());
    setPhase("play");
  }

  const clues = useMemo(() => (pic ? cluesOf(pic) : null), [pic]);
  // Letting go anywhere (even off the grid) stops colouring.
  useEffect(() => {
    const stop = () => (paint.current = null);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
    return () => {
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
    };
  }, []);
  const filled = grid.map((row) => row.map((v) => v === 1));

  function set(r: number, c: number, v: Cell) {
    setGrid((g) => {
      if (g[r]?.[c] === v) return g;
      const next = g.map((row) => [...row]);
      next[r][c] = v;
      return next;
    });
  }

  // Finished? (Checked after every change.)
  useEffect(() => {
    if (phase !== "play" || !clues || !grid.length) return;
    if (solved(grid.map((row) => row.map((v) => v === 1)), clues)) {
      const t = Date.now() - startedAt;
      const id = setTimeout(() => {
        setTook(t);
        setNewBest(offer(Math.round(t / 1000)));
        setPhase("won");
      }, 250);
      return () => clearTimeout(id);
    }
  }, [grid, phase, clues, startedAt, offer, pic]);

  function cellAt(x: number, y: number): [number, number] | null {
    const el = document.elementFromPoint(x, y) as HTMLElement | null;
    const d = el?.closest<HTMLElement>("[data-cell]")?.dataset.cell;
    if (!d) return null;
    const [r, c] = d.split(",").map(Number);
    return [r, c];
  }

  function down(e: React.PointerEvent) {
    const at = cellAt(e.clientX, e.clientY);
    if (!at) return;
    e.preventDefault();
    const [r, c] = at;
    // Tapping a square that's already this way clears it; the drag then clears too.
    const v: Cell = grid[r][c] === mode ? 0 : mode;
    paint.current = v;
    set(r, c, v);
  }
  function move(e: React.PointerEvent) {
    if (paint.current == null) return;
    const at = cellAt(e.clientX, e.clientY);
    if (at) set(at[0], at[1], paint.current);
  }
  const up = () => (paint.current = null);

  if (phase === "setup")
    return (
      <div className="space-y-4">
        <GameHero
          theme={T}
          art={
            <span className="grid grid-cols-5 gap-0.5">
              {".#.#.##########.###...#..".split("").map((ch, i) => (
                <span key={i} className="h-2.5 w-2.5 rounded-[2px]" style={{ background: ch === "#" ? "#f472b6" : "rgba(255,255,255,.25)" }} />
              ))}
            </span>
          }
          title="PICTURE LOGIC"
        >
          Pixel Pip has found a secret treasure map! Fill the right squares with blocks to uncover the hidden picture.
        </GameHero>
        <HowToPlay
          theme={T}
          steps={[
            <>The numbers beside each row (and above each column) say how many squares to fill <strong>in a row</strong>.</>,
            <><strong>2 1</strong> means: 2 squares together, then at least one gap, then 1 more square.</>,
            <>Tap <strong>Fill</strong> and tap squares to put a block in. Tap <strong>Mark empty</strong> to put an X where you know there&apos;s no block.</>,
            "A clue turns green when its line is right. Make every clue green to see the picture!",
          ]}
        />
        <div className="flex flex-wrap items-center gap-4 rounded-2xl bg-surface-2 p-3">
          <div className="grid grid-cols-[auto_repeat(3,2rem)] gap-1 text-sm font-bold tabular-nums" aria-hidden>
            <span className="grid h-8 w-10 place-items-center rounded-md bg-white text-ink shadow-sm">2 1</span>
            {[1, 1, 0].map((on, i) => (
              <span key={i} className="h-8 w-8 rounded-md" style={{ background: on ? "#e11d48" : "#fff", boxShadow: on ? "inset 0 -3px 0 rgba(0,0,0,.15)" : "inset 0 0 0 1px #cbd5e1" }} />
            ))}
          </div>
          <p className="min-w-0 flex-1 text-sm text-muted">
            The numbers tell you how many squares in a row to colour. <strong className="text-ink">2 1</strong> means 2 squares together, a gap, then 1 more.
          </p>
        </div>
        <LevelPicker theme={T} levels={Object.entries(PIC_LEVELS) as [PicLevel, string][]} value={level} onChange={setLevel} />
        {best != null ? <p className="text-center text-sm text-muted">Your fastest: {secs(best * 1000)}</p> : null}
        <BigButton theme={T} onClick={() => start()}>
          ▶ Start
        </BigButton>
      </div>
    );

  if (!pic || !clues) return null;
  const n = pic.rows.length;
  const cell = n <= 5 ? "h-12 w-12 sm:h-14 sm:w-14" : "h-9 w-9 sm:h-11 sm:w-11";
  const group = n % 4 === 0 ? 4 : 5; // a darker line every 4 (8 × 8) or 5 squares, to help counting
  const doneLines = clues.rows.filter((clue, r) => lineDone(filled[r], clue)).length + clues.cols.filter((clue, c) => lineDone(filled.map((row) => row[c]), clue)).length;

  if (phase === "won")
    return (
      <ResultCard
        theme={T}
        art={null}
        label={`It's a ${pic.name}! Solved in`}
        big={secs(took)}
        newBest={newBest}
        bestText={best != null ? `Your fastest: ${secs(best * 1000)}` : undefined}
        onAgain={() => start()}
        againLabel="Next picture"
        onChange={() => setPhase("setup")}
        changeLabel="Change size"
      >
        <div className="flex items-end justify-center gap-2" aria-hidden>
          <Px src="hero" className="h-16 w-16 animate-[gk-cheer_.8s_ease-in-out_infinite]" />
          <Px src="chest" className="h-12 w-12" />
          <Px src="diamond" className="h-10 w-10 animate-[pz-float_2s_ease-in-out_infinite]" />
        </div>
        <div className="mx-auto inline-grid gap-1 rounded-2xl bg-white p-3 shadow-lg ring-1 ring-black/5 [perspective:600px]" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }} aria-hidden>
          {pic.rows.flatMap((row, r) =>
            [...row].map((ch, c) => (
              <span
                key={`${r}-${c}`}
                className={`pz-anim animate-[pz-flip_.45s_ease-out_both] ${n <= 5 ? "h-11 w-11 rounded-lg" : "h-7 w-7 rounded-md"}`}
                style={{
                  animationDelay: `${(r + c) * 55}ms`,
                  background: ch === "#" ? `linear-gradient(145deg, color-mix(in srgb, ${pic.color}, #fff 25%), ${pic.color})` : "#f1f5f9",
                  boxShadow: ch === "#" ? "inset 0 -3px 0 rgba(0,0,0,.18)" : undefined,
                }}
              />
            )),
          )}
        </div>
      </ResultCard>
    );

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button type="button" aria-pressed={mode === 1} onClick={() => setMode(1)} className={`min-h-12 flex-1 rounded-xl border-2 font-semibold ${mode === 1 ? "border-accent bg-accent-soft text-accent" : "border-line bg-surface"}`}>
          <span className="inline-flex items-center gap-2"><Px src="block" className="h-6 w-6" /> Fill</span>
        </button>
        <button type="button" aria-pressed={mode === 2} onClick={() => setMode(2)} className={`min-h-12 flex-1 rounded-xl border-2 font-semibold ${mode === 2 ? "border-accent bg-accent-soft text-accent" : "border-line bg-surface"}`}>
          <span className="inline-flex items-center gap-2"><span className="text-[#f87171]">✕</span> Mark empty</span>
        </button>
      </div>

      <div className="overflow-x-auto">
        <div className="relative mx-auto w-max select-none rounded-3xl bg-[#eef2f7] p-3 shadow-inner" style={{ display: "grid", gridTemplateColumns: `auto repeat(${n}, auto)` }}>
          <span />
          {clues.cols.map((clue, c) => (
            <span
              key={c}
              className={`mx-px mb-1 flex flex-col items-center justify-end rounded-t-lg py-1 text-sm font-bold leading-tight tabular-nums transition-colors sm:text-base ${lineDone(filled.map((row) => row[c]), clue) ? "bg-[#dcfce7] text-[#16a34a]" : c % 2 ? "bg-white text-[#1e293b]" : "bg-[#f8fafc] text-[#1e293b]"}`}
            >
              {clue.map((k, i) => (
                <span key={i}>{k}</span>
              ))}
            </span>
          ))}
          {grid.map((row, r) => (
            <div key={r} className="contents">
              <span
                className={`my-px mr-1 flex items-center justify-end gap-1.5 rounded-l-lg px-2 text-sm font-bold tabular-nums transition-colors sm:text-base ${lineDone(filled[r], clues.rows[r]) ? "bg-[#dcfce7] text-[#16a34a]" : r % 2 ? "bg-white text-[#1e293b]" : "bg-[#f8fafc] text-[#1e293b]"}`}
              >
                {clues.rows[r].map((k, i) => (
                  <span key={i}>{k}</span>
                ))}
              </span>
              {row.map((v, c) => (
                <span
                  key={c}
                  data-cell={`${r},${c}`}
                  onPointerDown={down}
                  onPointerMove={move}
                  onPointerUp={up}
                  onPointerCancel={up}
                  role="button"
                  aria-label={`Row ${r + 1}, column ${c + 1}: ${v === 1 ? "coloured" : v === 2 ? "marked empty" : "empty"}`}
                  className={`${cell} grid touch-none place-items-center border border-[#d5dde8] text-lg font-bold text-[#cbd5e1] transition-colors duration-100 ${c % group === group - 1 && c < n - 1 ? "border-r-2 border-r-[#94a3b8]" : ""} ${r % group === group - 1 && r < n - 1 ? "border-b-2 border-b-[#94a3b8]" : ""}`}
                  style={
                    v === 1
                      ? { background: `url(${PX}/block.png) center / cover`, imageRendering: "pixelated" }
                      : { background: "#ffffff" }
                  }
                >
                  {v === 2 ? <span className="pz-anim animate-[tt-pop_.2s_ease-out] text-[#f87171]">✕</span> : ""}
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-center gap-2 text-sm text-muted">
        <Px src={doneLines % 2 ? "hero2" : "hero"} className="h-10 w-10" />
        <span>
          <strong className="tabular-nums text-ink">{doneLines}</strong> of {n * 2} clues right. Tap or drag across squares.
        </span>
        <Px src="chest" className="h-8 w-8" />
      </div>
      <button type="button" className="btn-secondary w-full" onClick={() => setGrid(grid.map((row) => row.map(() => 0 as Cell)))}>
        Start this picture again
      </button>
    </div>
  );
}

const PX = "/games/art/pixel";
function Px({ src, className = "" }: { src: string; className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={`${PX}/${src}.png`} alt="" aria-hidden draggable={false} className={`pointer-events-none select-none object-contain [image-rendering:pixelated] ${className}`} />;
}
