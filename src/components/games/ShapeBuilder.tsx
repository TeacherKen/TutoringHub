"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PICTURES, PIECES, fits, hintFor, isSolved, normalize, pictureById, pictureCells, pictureSize, rotate, flip, solutionsFor, type Cell, type PieceId, type Picture, type Placement } from "@/lib/pentomino";
import { useBest } from "./useBest";

// 🧩 Shape Builder: fit all 12 blocks into the picture. Built for the iPad.
// Drag a block (from the tray or from the picture) and it rides under your finger as a real block; let go
// over the picture and it snaps into the squares if it fits, or slides back if it doesn't. Tap a block to
// select it, then Rotate / Flip. Any arrangement that fills the picture wins, not only the model answer.

type Level = "easy" | "medium" | "hard";
const LEVELS: Record<Level, { name: string; blurb: string; given: number }> = {
  easy: { name: "Easy", blurb: "6 blocks already in place, 6 to go", given: 6 },
  medium: { name: "Medium", blurb: "3 blocks in place, 9 to go", given: 3 },
  hard: { name: "Hard", blurb: "All 12 blocks, like the paper puzzle", given: 0 },
};
const secs = (tenths: number) => `${(tenths / 10).toFixed(1)}s`;
const pieceOf = (id: PieceId) => PIECES.find((p) => p.id === id)!;
const top = (cells: Cell[]) => [Math.min(...cells.map((c) => c[0])), Math.min(...cells.map((c) => c[1]))] as Cell;

/** Where each loose block is: in the tray (with its current turn), or on the board at a top-left square. */
type Loose = { id: PieceId; shape: Cell[]; at: Cell | null };
type Drag = {
  id: PieceId;
  shape: Cell[];
  x: number;
  y: number;
  dx: number;
  dy: number;
  /** where the finger went down, to tell a tap from a drag */
  sx: number;
  sy: number;
  /** where the block was before it was picked up (a tap puts it back there) */
  from: Cell | null;
  /** it was already selected, so a tap turns it */
  wasSelected: boolean;
  /** the board's corner on screen when the drag began */
  bx: number;
  by: number;
};

export function ShapeBuilder() {
  const [pictureId, setPictureId] = useState(PICTURES[0].id);
  const [level, setLevel] = useState<Level>("medium");
  const [phase, setPhase] = useState<"setup" | "play" | "done">("setup");
  const [blocks, setBlocks] = useState<Loose[]>([]);
  const [given, setGiven] = useState<Set<PieceId>>(new Set());
  const [selected, setSelected] = useState<PieceId | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [hints, setHints] = useState(0);
  const [startedAt, setStartedAt] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [newBest, setNewBest] = useState(false);
  const [spin, setSpin] = useState(0); // bumps on every turn, to replay the little turn animation
  const { best, offer } = useBest(`sb-${pictureId}-${level}`, (a, b) => a < b);
  const picture = pictureById(pictureId)!;
  const { rows, cols } = pictureSize(picture);
  const want = useMemo(() => new Set(pictureCells(picture).map((c) => c.join(","))), [picture]);
  const gridRef = useRef<HTMLDivElement>(null);

  // Square size: big on a tablet, never wider than the screen on a phone.
  const [screenW, setScreenW] = useState(1024);
  useEffect(() => {
    const on = () => setScreenW(window.innerWidth);
    on();
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  const px = Math.max(22, Math.min(50, Math.floor(Math.min(620, screenW - 56) / Math.max(cols, rows))));

  useEffect(() => {
    if (phase !== "play") return;
    const id = setInterval(() => setElapsed(Date.now() - startedAt), 200);
    return () => clearInterval(id);
  }, [phase, startedAt]);

  const placed = useMemo((): Placement[] => blocks.filter((b) => b.at).map((b) => ({ id: b.id, cells: b.shape.map(([r, c]) => [r + b.at![0], c + b.at![1]]) })), [blocks]);
  const placedExcept = (id: PieceId) => placed.filter((p) => p.id !== id);

  function start() {
    const sols = solutionsFor(pictureId);
    const sol = sols[Math.floor(Math.random() * sols.length)] ?? [];
    const pre = [...sol].sort(() => Math.random() - 0.5).slice(0, LEVELS[level].given);
    setBlocks(
      PIECES.map((p) => {
        const g = pre.find((x) => x.id === p.id);
        return g ? { id: p.id, shape: normalize(g.cells), at: top(g.cells) } : { id: p.id, shape: normalize(p.cells), at: null };
      }),
    );
    setGiven(new Set(pre.map((p) => p.id)));
    setSelected(null);
    setDrag(null);
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

  /** Change one block, then see if the picture is complete. */
  function update(id: PieceId, change: Partial<Loose>) {
    const next = blocks.map((b) => (b.id === id ? { ...b, ...change } : b));
    setBlocks(next);
    const list: Placement[] = next.filter((b) => b.at).map((b) => ({ id: b.id, cells: b.shape.map(([r, c]) => [r + b.at![0], c + b.at![1]]) }));
    finish(list, hints);
  }

  // ---- Turning ---------------------------------------------------------------------------------
  /** Turn a block in place. On the board it stays only if it still fits; otherwise it hops to the tray. */
  function turn(id: PieceId, how: (s: Cell[]) => Cell[], at?: Cell | null) {
    if (given.has(id)) return;
    const b = blocks.find((x) => x.id === id)!;
    const where = at === undefined ? b.at : at;
    const shape = how(b.shape);
    setSpin((n) => n + 1);
    if (where) {
      // Turn it around its middle, then nudge it to the nearest spot that fits.
      const oh = Math.max(...b.shape.map((q) => q[0])), ow = Math.max(...b.shape.map((q) => q[1]));
      const nh = Math.max(...shape.map((q) => q[0])), nw = Math.max(...shape.map((q) => q[1]));
      const base: Cell = [where[0] + Math.round((oh - nh) / 2), where[1] + Math.round((ow - nw) / 2)];
      const tries: Cell[] = [base, where, ...[[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [-1, -1], [1, -1], [-1, 1]].map(([dr, dc]): Cell => [base[0] + dr, base[1] + dc])];
      const ok = tries.find((t) => fits(picture, shape.map(([r, c]): Cell => [r + t[0], c + t[1]]), placedExcept(id)));
      if (ok) return update(id, { shape, at: ok });
      setMsg("It doesn't fit that way there, so it's back in the tray.");
      return update(id, { shape, at: null });
    }
    update(id, { shape });
  }
  const turnSelected = (how: (s: Cell[]) => Cell[]) => selected && turn(selected, how);

  // Keyboard on a computer: R turns, F flips, Delete takes it off.
  useEffect(() => {
    if (phase !== "play") return;
    const key = (e: KeyboardEvent) => {
      if (!selected || e.metaKey || e.ctrlKey) return;
      const k = e.key.toLowerCase();
      if (k === "r") turn(selected, rotate);
      else if (k === "f") turn(selected, flip);
      else if (k === "delete" || k === "backspace") update(selected, { at: null });
      else if (k === "escape") setSelected(null);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });

  // ---- Dragging --------------------------------------------------------------------------------
  const boardTopLeftFor = (d: Drag): Cell | null => {
    // the block's own top-left corner is at (x - dx, y - dy); snap to the nearest square
    const c = Math.round((d.x - d.dx - d.bx) / px);
    const r = Math.round((d.y - d.dy - d.by) / px);
    const h = Math.max(...d.shape.map((s) => s[0])) + 1;
    const w = Math.max(...d.shape.map((s) => s[1])) + 1;
    return r > -h && c > -w && r < rows && c < cols ? [r, c] : null;
  };
  function beginDrag(id: PieceId, e: React.PointerEvent<HTMLElement>) {
    if (given.has(id) || e.button > 0) return;
    e.preventDefault();
    const b = blocks.find((x) => x.id === id)!;
    const box = e.currentTarget.getBoundingClientRect();
    // hold the block where the finger took it (within the block's bounding box)
    const grab = b.at ? { dx: e.clientX - box.left, dy: e.clientY - box.top } : { dx: Math.min(e.clientX - box.left, (Math.max(...b.shape.map((s) => s[1])) + 1) * px), dy: Math.min(e.clientY - box.top, (Math.max(...b.shape.map((s) => s[0])) + 1) * px) };
    setSelected(id);
    setMsg(null);
    const g = gridRef.current?.getBoundingClientRect();
    setDrag({ id, shape: b.shape, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, from: b.at, wasSelected: selected === id, bx: g?.left ?? 0, by: g?.top ?? 0, ...grab });
    if (b.at) setBlocks((l) => l.map((x) => (x.id === id ? { ...x, at: null } : x))); // lift it off the board
  }
  useEffect(() => {
    if (!drag) return;
    const move = (e: PointerEvent) => setDrag((d) => (d ? { ...d, x: e.clientX, y: e.clientY } : d));
    const up = () => {
      // `drag` here is this render's value (the effect re-subscribes every render), so no state updater needed.
      const d = drag;
      setDrag(null);
      // A tap (the finger hardly moved): put it back, and if it was already chosen, turn it.
      if (Math.hypot(d.x - d.sx, d.y - d.sy) < 8) {
        if (d.from) setBlocks((l) => l.map((x) => (x.id === d.id ? { ...x, at: d.from } : x)));
        if (d.wasSelected) turn(d.id, rotate, d.from);
        return;
      }
      const at = boardTopLeftFor(d);
      const cells = at ? d.shape.map(([r, c]): Cell => [r + at[0], c + at[1]]) : null;
      if (at && cells && fits(picture, cells, placedExcept(d.id))) update(d.id, { at });
      else if (at) setMsg("That doesn't fit there. Try turning it, or another spot.");
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  });

  function hint() {
    const h = hintFor(pictureId, placed);
    if (!h) return setMsg("No hint for this one, sorry!");
    const used = hints + 1;
    setHints(used);
    if ("wrong" in h) return setMsg(`Try moving the ${pieceOf(h.wrong).name} block. It's in the way of a full solution.`);
    setMsg(`Hint: the ${pieceOf(h.place.id).name} block goes here.`);
    const next = blocks.map((b) => (b.id === h.place.id ? { ...b, shape: normalize(h.place.cells), at: top(h.place.cells) } : b));
    setBlocks(next);
    setSelected(null);
    finish(next.filter((b) => b.at).map((b) => ({ id: b.id, cells: b.shape.map(([r, c]) => [r + b.at![0], c + b.at![1]]) })), used);
  }

  // ---- Screens -----------------------------------------------------------------------------------
  if (phase === "setup") {
    return (
      <div className="space-y-4">
        <p className="text-muted">Fit all 12 blocks into the picture. Drag them in, turn and flip them. Any way that fills the picture wins!</p>
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

  if (phase === "done") {
    return (
      <div className="relative space-y-4 overflow-hidden text-center">
        <Confetti />
        <p className="text-3xl font-semibold">
          <span className="sb-pop inline-block text-5xl">{picture.emoji}</span> {picture.name} finished!
        </p>
        <div className="sb-pop">
          <Board picture={picture} placed={placed} px={Math.min(px, 32)} />
        </div>
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

  // Snap preview while dragging over the board.
  const snapAt = drag ? boardTopLeftFor(drag) : null;
  const snapCells = drag && snapAt ? drag.shape.map(([r, c]): Cell => [r + snapAt[0], c + snapAt[1]]) : null;
  const snapOk = drag && snapCells ? fits(picture, snapCells, placedExcept(drag.id)) : false;
  const snapSet = new Set((snapCells ?? []).map((c) => c.join(",")));
  const onBoard = blocks.filter((b) => b.at);
  const inTray = blocks.filter((b) => !b.at && drag?.id !== b.id);
  const toGo = 12 - onBoard.length;
  const sel = selected ? blocks.find((b) => b.id === selected) : null;

  return (
    <div className="select-none space-y-3">
      <div className="flex items-center justify-between text-sm text-muted">
        <span>
          {picture.emoji} {picture.name} · <strong className="text-ink tabular-nums">{toGo}</strong> to go
        </span>
        <span className="tabular-nums">{secs(Math.round(elapsed / 100))}</span>
      </div>

      <div className="flex flex-col items-center gap-4 lg:flex-row lg:items-start lg:justify-center lg:gap-6">
        {/* The picture: the outline squares, then each placed block drawn as one piece on top */}
        <div className="flex justify-center overflow-x-auto">
          <div
            ref={gridRef}
            role="grid"
            aria-label={`${picture.name} picture, ${rows} rows by ${cols} columns`}
            className="relative touch-none rounded-xl"
            style={{ width: cols * px, height: rows * px }}
            onClick={() => setSelected(null)}
          >
            {Array.from({ length: rows * cols }, (_, i) => {
              const r = Math.floor(i / cols);
              const c = i % cols;
              const k = `${r},${c}`;
              if (!want.has(k)) return null;
              const snap = snapSet.has(k);
              const out = (dr: number, dc: number) => !want.has(`${r + dr},${c + dc}`);
              const edge = "3px solid #33415c";
              return (
                <div
                  key={k}
                  role="gridcell"
                  className="absolute"
                  style={{
                    left: c * px,
                    top: r * px,
                    width: px,
                    height: px,
                    background: snap ? (snapOk ? "rgba(47,107,98,.4)" : "rgba(200,40,40,.35)") : (r + c) % 2 ? "#e4e8ef" : "#dde2ea",
                    borderTop: out(-1, 0) ? edge : "1px solid rgba(51,65,92,.12)",
                    borderLeft: out(0, -1) ? edge : "1px solid rgba(51,65,92,.12)",
                    borderBottom: out(1, 0) ? edge : undefined,
                    borderRight: out(0, 1) ? edge : undefined,
                    borderTopLeftRadius: out(-1, 0) && out(0, -1) ? 8 : 0,
                    borderTopRightRadius: out(-1, 0) && out(0, 1) ? 8 : 0,
                    borderBottomLeftRadius: out(1, 0) && out(0, -1) ? 8 : 0,
                    borderBottomRightRadius: out(1, 0) && out(0, 1) ? 8 : 0,
                    boxShadow: snap ? `inset 0 0 0 2px ${snapOk ? "var(--accent)" : "var(--danger)"}` : undefined,
                  }}
                />
              );
            })}
            {onBoard.map((b) => (
              <Block
                key={selected === b.id ? `${b.id}-${spin}` : b.id}
                spin={selected === b.id && spin > 0}
                id={b.id}
                shape={b.shape}
                px={px}
                style={{ position: "absolute", left: b.at![1] * px, top: b.at![0] * px }}
                locked={given.has(b.id)}
                selected={selected === b.id}
                onPointerDown={(e) => beginDrag(b.id, e)}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!given.has(b.id)) setSelected(b.id);
                }}
              />
            ))}
            {sel?.at && !drag && !given.has(sel.id) ? <TurnButtons block={sel} px={px} rows={rows} onTurn={(how) => turn(sel.id, how)} /> : null}
          </div>
        </div>

        <div className="flex w-full flex-col gap-3 lg:w-80">
          {/* Turn the selected block */}
          <div className="flex min-h-14 flex-wrap items-center justify-center gap-2 rounded-2xl bg-surface-2 p-2">
            {sel && !given.has(sel.id) ? (
              <>
                <button type="button" className="btn-secondary min-h-12" onClick={() => turnSelected(rotate)}>
                  ↻ Rotate
                </button>
                <button type="button" className="btn-secondary min-h-12" onClick={() => turnSelected(flip)}>
                  ⇋ Flip
                </button>
                {sel.at ? (
                  <button type="button" className="btn-quiet min-h-12" onClick={() => update(sel.id, { at: null })}>
                    Take off
                  </button>
                ) : null}
              </>
            ) : (
              <span className="px-2 text-center text-sm text-muted">Drag a block onto the picture. Tap a block, then tap it again to turn it.</span>
            )}
          </div>
          <p aria-live="polite" className={`min-h-6 text-center text-sm ${msg?.startsWith("Hint") ? "text-accent" : "text-danger"}`}>
            {msg}
          </p>

          {/* The tray */}
          <div className="flex min-h-28 flex-wrap items-center justify-center gap-4 rounded-2xl bg-surface-2 p-4">
            {inTray.map((b) => (
              <Block
                key={selected === b.id ? `${b.id}-${spin}` : b.id}
                spin={selected === b.id && spin > 0}
                id={b.id}
                shape={b.shape}
                px={Math.min(px, 30)}
                selected={selected === b.id}
                onPointerDown={(e) => beginDrag(b.id, e)}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelected(b.id);
                }}
              />
            ))}
            {!inTray.length && !drag ? <span className="text-sm text-muted">All blocks are on the picture.</span> : null}
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

      {/* The block riding under the finger */}
      {drag ? (
        <div className="pointer-events-none fixed z-50" style={{ left: drag.x - drag.dx, top: drag.y - drag.dy }} aria-hidden>
          <Block id={drag.id} shape={drag.shape} px={px} lifted />
        </div>
      ) : null}
    </div>
  );
}

/** One block drawn as a single piece (its squares touching, with a soft 3D edge). */
function Block({
  id,
  shape,
  px,
  style,
  locked,
  selected,
  lifted,
  spin,
  onPointerDown,
  onClick,
}: {
  id: PieceId;
  shape: Cell[];
  px: number;
  style?: React.CSSProperties;
  locked?: boolean;
  selected?: boolean;
  lifted?: boolean;
  spin?: boolean;
  onPointerDown?: (e: React.PointerEvent<HTMLElement>) => void;
  onClick?: (e: React.MouseEvent) => void;
}) {
  const p = pieceOf(id);
  const h = Math.max(...shape.map((c) => c[0])) + 1;
  const w = Math.max(...shape.map((c) => c[1])) + 1;
  const has = (r: number, c: number) => shape.some(([sr, sc]) => sr === r && sc === c);
  return (
    <div
      role={onPointerDown ? "button" : undefined}
      aria-label={`${p.name} block${locked ? " (fixed)" : ""}`}
      onPointerDown={locked ? undefined : onPointerDown}
      onClick={onClick}
      className={`relative touch-none ${locked ? "" : "cursor-grab active:cursor-grabbing"} ${lifted ? "scale-105 drop-shadow-2xl" : ""} ${spin ? "sb-spin" : ""}`}
      style={{ width: w * px, height: h * px, filter: selected ? "drop-shadow(0 0 6px rgba(255,198,41,.95)) brightness(1.06)" : undefined, ...style }}
    >
      {shape.map(([r, c]) => (
        <span
          key={`${r},${c}`}
          className="absolute"
          style={{
            left: c * px,
            top: r * px,
            width: px,
            height: px,
            background: p.color,
            // a fixed (given) block wears a little pin in each square, so children see they can't move it
            backgroundImage: locked ? "radial-gradient(circle at 50% 50%, rgba(255,255,255,.55) 0 3px, transparent 3.5px)" : undefined,
            // rounded only on outside corners so the squares read as one piece
            borderTopLeftRadius: !has(r - 1, c) && !has(r, c - 1) ? 6 : 0,
            borderTopRightRadius: !has(r - 1, c) && !has(r, c + 1) ? 6 : 0,
            borderBottomLeftRadius: !has(r + 1, c) && !has(r, c - 1) ? 6 : 0,
            borderBottomRightRadius: !has(r + 1, c) && !has(r, c + 1) ? 6 : 0,
            boxShadow: [
              !has(r - 1, c) ? "inset 0 2px 0 rgba(255,255,255,.35)" : "",
              !has(r + 1, c) ? "inset 0 -3px 0 rgba(0,0,0,.25)" : "",
              !has(r, c - 1) ? "inset 2px 0 0 rgba(255,255,255,.2)" : "",
              !has(r, c + 1) ? "inset -2px 0 0 rgba(0,0,0,.18)" : "",
            ]
              .filter(Boolean)
              .join(", "),
          }}
        />
      ))}
    </div>
  );
}

/** Round Rotate and Flip buttons sitting right next to a block on the picture. */
function TurnButtons({ block, px, rows, onTurn }: { block: Loose; px: number; rows: number; onTurn: (how: (s: Cell[]) => Cell[]) => void }) {
  const h = Math.max(...block.shape.map((c) => c[0])) + 1;
  const w = Math.max(...block.shape.map((c) => c[1])) + 1;
  const [r, c] = block.at!;
  const above = r > 0 || r + h >= rows; // usually above the block; below it when it's on the top row
  const btn = "grid h-11 w-11 place-items-center rounded-full bg-[#ffc629] text-xl font-bold text-[#0b1d42] shadow-lg ring-2 ring-white transition active:scale-90";
  return (
    <div
      className="absolute z-20 flex gap-2"
      style={{ left: (c + w / 2) * px, top: above ? r * px - 52 : (r + h) * px + 8, transform: "translateX(-50%)" }}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <button type="button" aria-label="Rotate" className={btn} onClick={() => onTurn(rotate)}>
        ↻
      </button>
      <button type="button" aria-label="Flip" className={btn} onClick={() => onTurn(flip)}>
        ⇋
      </button>
    </div>
  );
}

/** A short burst of falling colours for a finished picture. */
function Confetti() {
  const bits = useMemo(
    () =>
      Array.from({ length: 36 }, (_, i) => ({
        left: (i * 37) % 100,
        delay: (i % 9) * 0.12,
        dur: 1.6 + ((i * 7) % 10) / 10,
        color: PIECES[i % PIECES.length].color,
        rot: (i * 47) % 360,
      })),
    [],
  );
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-10">
      {bits.map((b, i) => (
        <span
          key={i}
          className="sb-confetti absolute top-0 h-3 w-2 rounded-sm"
          style={{ left: `${b.left}%`, background: b.color, animationDelay: `${b.delay}s`, animationDuration: `${b.dur}s`, transform: `rotate(${b.rot}deg)` }}
        />
      ))}
    </div>
  );
}

/** The finished picture, small. */
function Board({ picture, placed, px }: { picture: Picture; placed: Placement[]; px: number }) {
  const { rows, cols } = pictureSize(picture);
  return (
    <div className="flex justify-center">
      <div aria-hidden className="relative" style={{ width: cols * px, height: rows * px }}>
        {placed.map((p) => (
          <Block key={p.id} id={p.id} shape={normalize(p.cells)} px={px} style={{ position: "absolute", left: top(p.cells)[1] * px, top: top(p.cells)[0] * px }} />
        ))}
      </div>
    </div>
  );
}
