"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PICTURES, PIECES, fits, hintFor, isSolved, normalize, pictureById, pictureCells, pictureSize, rotate, flip, solutionsFor, type Cell, type PieceId, type Picture, type Placement } from "@/lib/pentomino";
import { useBest } from "./useBest";

// 🧩 Shape Builder: fit all 12 blocks into the picture. Built for the iPad: drag a block from the tray
// onto the grid (it snaps to the squares), Rotate and Flip buttons, tap a placed block to pick it up again.
// Any arrangement that covers the picture wins, not just the model answer.

type Level = "easy" | "medium" | "hard";
const LEVELS: Record<Level, { name: string; blurb: string; given: number }> = {
  easy: { name: "Easy", blurb: "6 blocks already in place, 6 to go", given: 6 },
  medium: { name: "Medium", blurb: "3 blocks in place, 9 to go", given: 3 },
  hard: { name: "Hard", blurb: "All 12 blocks, like the paper puzzle", given: 0 },
};
const secs = (tenths: number) => `${(tenths / 10).toFixed(1)}s`;
const pieceOf = (id: PieceId) => PIECES.find((p) => p.id === id)!;

type Held = { id: PieceId; shape: Cell[]; from: "tray" | "board" };

export function ShapeBuilder() {
  const [pictureId, setPictureId] = useState(PICTURES[0].id);
  const [level, setLevel] = useState<Level>("medium");
  const [phase, setPhase] = useState<"setup" | "play" | "done">("setup");
  const [placed, setPlaced] = useState<Placement[]>([]);
  const [given, setGiven] = useState<Set<PieceId>>(new Set());
  const [held, setHeld] = useState<Held | null>(null);
  const [hover, setHover] = useState<Cell | null>(null); // grid cell under the held piece's anchor
  const [msg, setMsg] = useState<string | null>(null);
  const [hints, setHints] = useState(0);
  const [startedAt, setStartedAt] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [newBest, setNewBest] = useState(false);
  const { best, offer } = useBest(`sb-${pictureId}-${level}`, (a, b) => a < b);
  const picture = pictureById(pictureId)!;
  const { rows, cols } = pictureSize(picture);
  const want = useMemo(() => new Set(pictureCells(picture).map((c) => c.join(","))), [picture]);
  const gridRef = useRef<HTMLDivElement>(null);
  // Square size: as big as fits a tablet screen, smaller for tall or wide pictures.
  // Square size: as big as fits (600px board on a tablet), never wider than the screen on a phone.
  const [screenW, setScreenW] = useState(1024);
  useEffect(() => {
    const on = () => setScreenW(window.innerWidth);
    on();
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  const px = Math.max(20, Math.min(48, Math.floor(Math.min(600, screenW - 56) / Math.max(cols, rows))));

  useEffect(() => {
    if (phase !== "play") return;
    const id = setInterval(() => setElapsed(Date.now() - startedAt), 200);
    return () => clearInterval(id);
  }, [phase, startedAt]);

  function start() {
    const sols = solutionsFor(pictureId);
    const sol = sols[Math.floor(Math.random() * sols.length)] ?? [];
    const n = LEVELS[level].given;
    const pre = [...sol].sort(() => Math.random() - 0.5).slice(0, n);
    setPlaced(pre);
    setGiven(new Set(pre.map((p) => p.id)));
    setHeld(null);
    setHover(null);
    setMsg(null);
    setHints(0);
    setStartedAt(Date.now());
    setElapsed(0);
    setNewBest(false);
    setPhase("play");
  }

  const finish = useCallback(
    (list: Placement[], hintsUsed: number) => {
      if (!isSolved(picture, list)) return false;
      const time = Math.round((Date.now() - startedAt) / 100);
      setElapsed(time * 100);
      setNewBest(hintsUsed === 0 && offer(time)); // a hinted game doesn't count as a best
      setPhase("done");
      return true;
    },
    [picture, startedAt, offer],
  );

  // ---- Picking up and putting down -------------------------------------------------------------
  const inTray = PIECES.filter((p) => !placed.some((x) => x.id === p.id) && held?.id !== p.id);

  function pickFromTray(id: PieceId) {
    if (held?.id === id) return setHeld(null);
    if (held?.from === "board") return; // put the held one down first
    setHeld({ id, shape: normalize(pieceOf(id).cells), from: "tray" });
    setMsg(null);
  }
  function pickFromBoard(id: PieceId) {
    if (given.has(id) || held) return;
    const pl = placed.find((p) => p.id === id)!;
    setPlaced((l) => l.filter((p) => p.id !== id));
    setHeld({ id, shape: normalize(pl.cells), from: "board" });
    setMsg(null);
  }
  const turn = () => held && setHeld({ ...held, shape: rotate(held.shape) });
  const mirror = () => held && setHeld({ ...held, shape: flip(held.shape) });

  /** Where the held piece would land if its anchor (first cell) is at grid cell `at`. */
  const landing = (at: Cell): Cell[] | null => {
    if (!held) return null;
    const a = held.shape[0];
    return held.shape.map(([r, c]) => [r - a[0] + at[0], c - a[1] + at[1]]);
  };
  function drop(at: Cell) {
    if (!held) return;
    const cells = landing(at)!;
    if (!fits(picture, cells, placed)) {
      setMsg("That doesn't fit there. Try turning it, or another spot.");
      return;
    }
    const next = [...placed, { id: held.id, cells }];
    setPlaced(next);
    setHeld(null);
    setHover(null);
    setMsg(null);
    finish(next, hints);
  }

  // Pointer handling on the grid: moving shows a ghost; releasing (or tapping) drops.
  const cellAt = (e: { clientX: number; clientY: number }): Cell | null => {
    const g = gridRef.current;
    if (!g) return null;
    const b = g.getBoundingClientRect();
    const c = Math.floor((e.clientX - b.left) / px);
    const r = Math.floor((e.clientY - b.top) / px);
    return r >= 0 && c >= 0 && r < rows && c < cols ? [r, c] : null;
  };
  // Drag from the tray: pointer down on a tray piece picks it up and follows the finger.
  const dragging = useRef(false);
  function trayPointerDown(id: PieceId, e: React.PointerEvent) {
    if (held && held.id !== id) return;
    e.preventDefault();
    if (!held) pickFromTray(id);
    dragging.current = true;
    (e.target as Element).releasePointerCapture?.(e.pointerId);
  }
  useEffect(() => {
    if (!held) return;
    const move = (e: PointerEvent) => {
      if (!dragging.current) return;
      setHover(cellAt(e));
    };
    const up = (e: PointerEvent) => {
      if (!dragging.current) return;
      dragging.current = false;
      const at = cellAt(e);
      if (at) drop(at);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  });

  function hint() {
    const h = hintFor(pictureId, placed);
    if (!h) return setMsg("No hint for this one, sorry!");
    const used = hints + 1;
    setHints(used);
    if ("wrong" in h) {
      const name = pieceOf(h.wrong).name;
      setMsg(`Try moving the ${name} block. It's in the way of a full solution.`);
      return;
    }
    if (held?.id === h.place.id) setHeld(null);
    const next = [...placed, h.place];
    setPlaced(next);
    setMsg(`Hint: the ${pieceOf(h.place.id).name} block goes here.`);
    finish(next, used);
  }

  // ---- Screens -----------------------------------------------------------------------------------
  if (phase === "setup") {
    return (
      <div className="space-y-4">
        <p className="text-muted">Fit all 12 blocks into the picture. You can turn and flip them. Any way that fills the picture wins!</p>
        <div className="grid grid-cols-3 gap-2">
          {PICTURES.map((p) => (
            <button
              key={p.id}
              type="button"
              aria-pressed={pictureId === p.id}
              onClick={() => setPictureId(p.id)}
              className={`flex min-h-20 flex-col items-center justify-center gap-1 rounded-2xl border px-2 ${pictureId === p.id ? "border-accent bg-accent-soft font-medium text-accent" : "border-line bg-surface"}`}
            >
              <span className="text-3xl" aria-hidden>
                {p.emoji}
              </span>
              <span className="text-sm">{p.name}</span>
            </button>
          ))}
        </div>
        <div className="grid gap-2">
          {(Object.keys(LEVELS) as Level[]).map((l) => (
            <button
              key={l}
              type="button"
              aria-pressed={level === l}
              onClick={() => setLevel(l)}
              className={`min-h-12 rounded-xl border px-4 text-left ${level === l ? "border-accent bg-accent-soft font-medium text-accent" : "border-line bg-surface"}`}
            >
              {LEVELS[l].name} · {LEVELS[l].blurb}
            </button>
          ))}
        </div>
        {best != null ? <p className="text-sm text-muted">Your fastest for this picture and level: {secs(best)}</p> : null}
        <button type="button" className="btn-primary w-full" onClick={start}>
          Start
        </button>
      </div>
    );
  }

  const ghost = held && hover ? landing(hover) : null;
  const ghostOk = ghost ? fits(picture, ghost, placed) : false;
  const ownerOf = new Map<string, PieceId>();
  for (const p of placed) for (const c of p.cells) ownerOf.set(c.join(","), p.id);
  if (phase === "done") {
    return (
      <div className="space-y-4 text-center">
        <p className="text-sm text-muted">
          {picture.emoji} {picture.name} finished!
        </p>
        <Board picture={picture} placed={placed} px={Math.min(px, 32)} />
        <p className="text-5xl font-semibold tabular-nums">{secs(Math.round(elapsed / 100))}</p>
        <p className={newBest ? "font-medium text-ok" : "text-muted"}>
          {newBest ? "New fastest time! 🧩" : hints ? `With ${hints} hint${hints === 1 ? "" : "s"}` : `Your fastest: ${best != null ? secs(best) : "—"}`}
        </p>
        <div className="flex gap-2">
          <button type="button" className="btn-secondary flex-1" onClick={() => setPhase("setup")}>
            Another picture
          </button>
          <button type="button" className="btn-primary flex-1" onClick={start}>
            Play again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="select-none space-y-3">
      <div className="flex items-center justify-between text-sm text-muted">
        <span>
          {picture.emoji} {picture.name} · <strong className="text-ink tabular-nums">{12 - placed.length}</strong> to go
        </span>
        <span className="tabular-nums">{secs(Math.round(elapsed / 100))}</span>
      </div>

      <div className="flex flex-col items-center gap-4 lg:flex-row lg:items-start lg:justify-center lg:gap-6">
      {/* The picture */}
      <div className="flex justify-center overflow-x-auto">
        <div
          ref={gridRef}
          role="grid"
          aria-label={`${picture.name} picture, ${rows} rows by ${cols} columns`}
          className="relative touch-none rounded-xl bg-surface-2 p-0"
          style={{ width: cols * px, height: rows * px, display: "grid", gridTemplateColumns: `repeat(${cols}, ${px}px)`, gridTemplateRows: `repeat(${rows}, ${px}px)` }}
          onPointerMove={(e) => held && !dragging.current && setHover(cellAt(e))}
          onPointerLeave={() => !dragging.current && setHover(null)}
          onClick={(e) => {
            const at = cellAt(e);
            if (!at) return;
            if (held) return drop(at);
            const owner = ownerOf.get(at.join(","));
            if (owner) pickFromBoard(owner);
          }}
        >
          {Array.from({ length: rows * cols }, (_, i) => {
            const r = Math.floor(i / cols);
            const c = i % cols;
            const k = `${r},${c}`;
            const inPic = want.has(k);
            const owner = ownerOf.get(k);
            const g = ghost?.some(([gr, gc]) => gr === r && gc === c);
            const color = owner ? pieceOf(owner).color : undefined;
            return (
              <div
                key={k}
                role="gridcell"
                aria-label={inPic ? (owner ? `${pieceOf(owner).name} block` : "empty") : undefined}
                className={`${inPic ? "border border-line/60" : ""} ${owner && !given.has(owner) ? "cursor-pointer" : ""}`}
                style={{
                  background: g ? (ghostOk ? `${held ? pieceOf(held.id).color : "#888"}cc` : "rgba(220,60,60,.55)") : color ?? (inPic ? "var(--surface)" : "transparent"),
                  boxShadow: owner ? "inset 0 0 0 1px rgba(0,0,0,.25)" : undefined,
                  opacity: owner && given.has(owner) ? 0.85 : 1,
                }}
              />
            );
          })}
        </div>
      </div>

      <div className="flex w-full flex-col gap-3 lg:w-80">
      {/* Controls for the held piece */}
      <div className="flex min-h-14 flex-wrap items-center justify-center gap-2 rounded-2xl bg-surface-2 p-2">
        {held ? (
          <>
            <Mini shape={held.shape} color={pieceOf(held.id).color} size={16} />
            <button type="button" className="btn-secondary min-h-12" onClick={turn}>
              ↻ Rotate
            </button>
            <button type="button" className="btn-secondary min-h-12" onClick={mirror}>
              ⇋ Flip
            </button>
            <button type="button" className="btn-quiet min-h-12" onClick={() => setHeld(null)}>
              Put back
            </button>
          </>
        ) : (
          <span className="text-sm text-muted">Tap or drag a block, then tap the picture to place it.</span>
        )}
      </div>
      <p aria-live="polite" className={`min-h-6 text-center text-sm ${msg?.startsWith("Hint") ? "text-accent" : "text-danger"}`}>
        {msg}
      </p>

      {/* The tray */}
      <div className="flex flex-wrap items-end justify-center gap-3 rounded-2xl bg-surface-2 p-3">
        {inTray.map((p) => (
          <button
            key={p.id}
            type="button"
            aria-label={`${p.name} block`}
            onPointerDown={(e) => trayPointerDown(p.id, e)}
            onClick={() => pickFromTray(p.id)}
            className="touch-none rounded-xl p-1.5 transition hover:bg-line active:scale-95"
          >
            <Mini shape={normalize(p.cells)} color={p.color} size={18} />
          </button>
        ))}
        {!inTray.length && !held ? <span className="text-sm text-muted">All blocks are on the picture.</span> : null}
      </div>
      </div>
      </div>

      <div className="flex justify-between">
        <button type="button" className="btn-quiet min-h-11" onClick={() => setPhase("setup")}>
          ‹ Change picture
        </button>
        <button type="button" className="btn-secondary min-h-11" onClick={hint}>
          💡 Hint
        </button>
      </div>
    </div>
  );
}

/** A small picture of a block (tray, held piece). */
function Mini({ shape, color, size }: { shape: Cell[]; color: string; size: number }) {
  const h = Math.max(...shape.map((c) => c[0])) + 1;
  const w = Math.max(...shape.map((c) => c[1])) + 1;
  return (
    <span aria-hidden className="inline-grid" style={{ gridTemplateColumns: `repeat(${w}, ${size}px)`, gridTemplateRows: `repeat(${h}, ${size}px)`, gap: 1 }}>
      {Array.from({ length: h * w }, (_, i) => {
        const r = Math.floor(i / w);
        const c = i % w;
        const on = shape.some(([sr, sc]) => sr === r && sc === c);
        return <span key={i} style={{ background: on ? color : "transparent", borderRadius: 2, boxShadow: on ? "inset 0 0 0 1px rgba(0,0,0,.25)" : undefined }} />;
      })}
    </span>
  );
}

/** The finished picture, small. */
function Board({ picture, placed, px }: { picture: Picture; placed: Placement[]; px: number }) {
  const { rows, cols } = pictureSize(picture);
  const own = new Map<string, string>();
  for (const p of placed) for (const c of p.cells) own.set(c.join(","), pieceOf(p.id).color);
  return (
    <div className="flex justify-center">
      <div aria-hidden style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, ${px}px)`, gridTemplateRows: `repeat(${rows}, ${px}px)` }}>
        {Array.from({ length: rows * cols }, (_, i) => {
          const k = `${Math.floor(i / cols)},${i % cols}`;
          return <div key={k} style={{ background: own.get(k) ?? "transparent", boxShadow: own.has(k) ? "inset 0 0 0 1px rgba(0,0,0,.25)" : undefined }} />;
        })}
      </div>
    </div>
  );
}

