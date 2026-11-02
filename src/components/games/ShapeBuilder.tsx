"use client";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { PICTURES, PIECES, piecesOf, fits, hintFor, isSolved, normalize, pictureById, pictureCells, pictureSize, rotate, flip, solutionsFor, type Cell, type PieceId, type Picture, type Placement } from "@/lib/pentomino";
import { useBest } from "./useBest";
import { sfx } from "@/lib/gameSound";

// 🧩 Shape Builder: fit all 12 blocks into the picture. Built for the iPad.
// Drag a block (from the tray or from the picture) and it rides under your finger as a real block; let go
// over the picture and it snaps into the squares if it fits, or slides back if it doesn't. Tap a block to
// select it, then Rotate / Flip. Any arrangement that fills the picture wins, not only the model answer.

type Level = "easy" | "medium" | "hard";
const LEVELS: Record<Level, { name: string; share: number }> = {
  easy: { name: "Easy", share: 1 / 2 }, // half the blocks already in place
  medium: { name: "Medium", share: 1 / 4 },
  hard: { name: "Hard", share: 0 },
};
/** How many blocks the game puts in for you: 6 / 3 / 0 of 12, or 2 / 1 / 0 of 4. */
const givenFor = (level: Level, n: number) => Math.round(n * LEVELS[level].share);
function levelBlurb(level: Level, n: number) {
  const g = givenFor(level, n);
  if (!g) return n === 12 ? "All 12 blocks, like the paper puzzle" : `All ${n} blocks yourself`;
  return `${g} block${g === 1 ? "" : "s"} already in place, ${n - g} to go`;
}
const secs = (tenths: number) => `${(tenths / 10).toFixed(1)}s`;
const pieceOf = (id: PieceId) => PIECES.find((p) => p.id === id)!;
const top = (cells: Cell[]) => [Math.min(...cells.map((c) => c[0])), Math.min(...cells.map((c) => c[1]))] as Cell;

/** Stars for a finished picture: 3 with no hints, 2 with one or two, 1 otherwise. */
export const starsFor = (hints: number) => (hints === 0 ? 3 : hints <= 2 ? 2 : 1);

// Things kept on this device: stars per picture and level, and a puzzle left half-way.
const STARS_KEY = "th-sb-stars";
const SAVED_KEY = "th-sb-saved";
const subscribe = (on: () => void) => {
  window.addEventListener("storage", on);
  window.addEventListener("th-sb", on);
  return () => {
    window.removeEventListener("storage", on);
    window.removeEventListener("th-sb", on);
  };
};
function readKey(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeKey(key: string, value: string | null) {
  try {
    if (value == null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    /* storage blocked: nothing kept, the game still works */
  }
  window.dispatchEvent(new Event("th-sb"));
}
function useStored(key: string) {
  return useSyncExternalStore(subscribe, () => readKey(key), () => null);
}
function parse<T>(raw: string | null, fallback: T): T {
  try {
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
type Saved = { pictureId: string; level: Level; blocks: Loose[]; given: PieceId[]; hints: number; ms: number };

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
  /** size it starts at compared with full size (tray blocks are smaller) */
  grow: number;
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
  const [ghost, setGhost] = useState<Placement | null>(null); // a hint: the shadow of where a block goes
  const [nudge, setNudge] = useState<PieceId | null>(null); // a hint: this block is in the way
  const [stars, setStars] = useState(0);
  const starsRaw = useStored(STARS_KEY);
  const savedRaw = useStored(SAVED_KEY);
  const allStars = parse<Record<string, number>>(starsRaw, {});
  const saved = parse<Saved | null>(savedRaw, null);
  const savedPic = saved ? pictureById(saved.pictureId) : null;
  const resumable = saved && savedPic && saved.blocks?.length === piecesOf(savedPic).length ? saved : null;
  // The little turn animation plays only just after a real turn, not every time a block is put down.
  const [turning, setTurning] = useState<{ id: PieceId; n: number } | null>(null);
  useEffect(() => {
    if (!turning) return;
    const t = setTimeout(() => setTurning(null), 250);
    return () => clearTimeout(t);
  }, [turning]);
  const { best, offer } = useBest(`sb-${pictureId}-${level}`, (a, b) => a < b);
  const picture = pictureById(pictureId)!;
  const { rows, cols } = pictureSize(picture);
  const want = useMemo(() => new Set(pictureCells(picture).map((c) => c.join(","))), [picture]);
  const gridRef = useRef<HTMLDivElement>(null);

  // Square size: big on a tablet, never wider than the screen on a phone.
  // The whole game fits on the screen: squares are sized by the space left for the picture, across and down.
  const [screen, setScreen] = useState({ w: 1024, h: 800 });
  useEffect(() => {
    const on = () => setScreen({ w: window.innerWidth, h: window.innerHeight });
    on();
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  const side = screen.w >= 1024; // tray beside the picture (computer, iPad sideways); below it otherwise
  const inner = Math.min(screen.w, 1024) - 56; // the white card's inside width
  const availW = side ? inner - 300 - 24 : Math.min(760, screen.w - 48);
  const availH = side ? screen.h - 236 : screen.h - 236 - 380;
  const px = Math.max(22, Math.min(56, Math.floor(availW / cols), Math.floor(availH / rows)));
  // Tray blocks a bit smaller (12 have to fit), growing to full size as they're picked up.
  // …and small enough that all 12 fit in the tray's space (each block takes about 3×3 squares plus a gap).
  // On a computer the tray column gets whatever width the picture leaves (up to 480px).
  const colW = side ? Math.max(300, Math.min(480, inner - cols * px - 24)) : availW;
  const trayW = colW - 24;
  const trayH = side ? screen.h - 236 - 100 : 260;
  const trayFit = Math.floor((Math.sqrt((0.55 * trayW * trayH) / Math.max(8, piecesOf(picture).length)) - 12) / 3);
  const trayPx = Math.max(16, Math.min(42, Math.round(px * 0.8), trayFit));

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
    const pre = [...sol].sort(() => Math.random() - 0.5).slice(0, givenFor(level, piecesOf(picture).length));
    setBlocks(
      piecesOf(picture).map((id) => {
        const p = pieceOf(id);
        const g = pre.find((x) => x.id === p.id);
        return g ? { id: p.id, shape: normalize(g.cells), at: top(g.cells) } : { id: p.id, shape: normalize(p.cells), at: null };
      }),
    );
    setGiven(new Set(pre.map((p) => p.id)));
    setGhost(null);
    setNudge(null);
    setSelected(null);
    setDrag(null);
    setMsg(null);
    setHints(0);
    setStartedAt(Date.now());
    setElapsed(0);
    setNewBest(false);
    writeKey(SAVED_KEY, null);
    setPhase("play");
  }

  /** Carry on with the puzzle left half-way. */
  function resume(s: Saved) {
    setPictureId(s.pictureId);
    setLevel(s.level);
    setBlocks(s.blocks);
    setGiven(new Set(s.given));
    setHints(s.hints);
    setGhost(null);
    setNudge(null);
    setSelected(null);
    setDrag(null);
    setMsg(null);
    setStartedAt(() => Date.now() - s.ms);
    setElapsed(s.ms);
    setNewBest(false);
    setPhase("play");
  }

  // Keep the puzzle on this device after every move, so leaving half-way isn't lost.
  useEffect(() => {
    if (phase !== "play" || !blocks.length) return;
    const s: Saved = { pictureId, level, blocks, given: [...given], hints, ms: Date.now() - startedAt };
    writeKey(SAVED_KEY, JSON.stringify(s));
  }, [phase, blocks, hints, given, pictureId, level, startedAt]);

  const finish = useCallback(
    (list: Placement[], hintsUsed: number) => {
      if (!isSolved(picture, list)) return false;
      const time = Math.round((Date.now() - startedAt) / 100);
      setElapsed(time * 100);
      setNewBest(hintsUsed === 0 && offer(time)); // a hinted game doesn't count as a best
      const got = starsFor(hintsUsed);
      setStars(got);
      const all = parse<Record<string, number>>(readKey(STARS_KEY), {});
      const k = `${picture.id}-${level}`;
      if ((all[k] ?? 0) < got) writeKey(STARS_KEY, JSON.stringify({ ...all, [k]: got }));
      writeKey(SAVED_KEY, null);
      sfx.solved();
      setPhase("done");
      return true;
    },
    [picture, startedAt, offer, level],
  );

  /** Change one block, then see if the picture is complete. */
  function update(id: PieceId, change: Partial<Loose>) {
    const next = blocks.map((b) => (b.id === id ? { ...b, ...change } : b));
    setBlocks(next);
    if (change.at) sfx.snap();
    if (id === nudge && !change.at) setNudge(null);
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
    setTurning((t) => ({ id, n: (t?.n ?? 0) + 1 }));
    if (where) {
      // Turn it around its middle, then nudge it to the nearest spot that fits.
      const oh = Math.max(...b.shape.map((q) => q[0])), ow = Math.max(...b.shape.map((q) => q[1]));
      const nh = Math.max(...shape.map((q) => q[0])), nw = Math.max(...shape.map((q) => q[1]));
      const base: Cell = [where[0] + Math.round((oh - nh) / 2), where[1] + Math.round((ow - nw) / 2)];
      const tries: Cell[] = [base, where, ...[[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [-1, -1], [1, -1], [-1, 1]].map(([dr, dc]): Cell => [base[0] + dr, base[1] + dc])];
      const ok = tries.find((t) => fits(picture, shape.map(([r, c]): Cell => [r + t[0], c + t[1]]), placedExcept(id)));
      if (ok) return update(id, { shape, at: ok });
      setMsg("It doesn't fit that way there, so it's back in the tray.");
      sfx.bump();
      return update(id, { shape, at: null });
    }
    update(id, { shape });
  }

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
    // From the tray the block grows to full size, so the finger keeps the same spot on it.
    const k = b.at ? 1 : px / trayPx;
    const grab = { dx: Math.min((e.clientX - box.left) * k, (Math.max(...b.shape.map((s) => s[1])) + 1) * px), dy: Math.min((e.clientY - box.top) * k, (Math.max(...b.shape.map((s) => s[0])) + 1) * px), grow: b.at ? 1 : trayPx / px };
    setSelected(id);
    setMsg(null);
    const g = gridRef.current?.getBoundingClientRect();
    setDrag({ id, shape: b.shape, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, from: b.at, wasSelected: selected === id, bx: g?.left ?? 0, by: g?.top ?? 0, ...grab });
    if (b.at) setBlocks((l) => l.map((x) => (x.id === id ? { ...x, at: null } : x))); // lift it off the board
  }
  useEffect(() => {
    if (!drag) return;
    const move = (e: PointerEvent) => setDrag((d) => (d ? { ...d, x: e.clientX, y: e.clientY } : d));
    const up = (e: PointerEvent) => {
      // `drag` is this render's value (the effect re-subscribes every render). A quick flick can lift the
      // finger before the last move is drawn, so drop where the finger actually lifted (not on a cancel,
      // which has no real position).
      const d = e.type === "pointerup" ? { ...drag, x: e.clientX, y: e.clientY } : drag;
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
      else if (at) {
        setMsg("That doesn't fit there. Try turning it, or another spot.");
        sfx.bump();
      }
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

  // A hint shows the shadow of where one block goes; the child still drags it there.
  const ghostShown = ghost && !blocks.find((b) => b.id === ghost.id)?.at ? ghost : null;
  function hint() {
    if (ghostShown) return setMsg(`Hint: the ${pieceOf(ghostShown.id).name} block fits in the shadow. Drag it there.`);
    const h = hintFor(pictureId, placed);
    if (!h) return setMsg("No hint for this one, sorry!");
    setHints((n) => n + 1);
    setSelected(null);
    if ("wrong" in h) {
      setGhost(null);
      setNudge(h.wrong);
      return setMsg(`Hint: try moving the ${pieceOf(h.wrong).name} block. It's in the way.`);
    }
    setNudge(null);
    setGhost(h.place);
    // On Easy the block is also turned the right way round for them.
    if (level === "easy") setBlocks((l) => l.map((b) => (b.id === h.place.id ? { ...b, shape: normalize(h.place.cells) } : b)));
    setMsg(`Hint: the ${pieceOf(h.place.id).name} block fits in the shadow. Drag it there.`);
  }

  // ---- Screens -----------------------------------------------------------------------------------
  if (phase === "setup") {
    return (
      <div className="space-y-4">
        <p className="text-muted">Fit all the blocks into the picture. Drag them in, turn and flip them. Any way that fills the picture wins!</p>
        {resumable ? (
          <button type="button" className="btn-primary flex min-h-14 w-full items-center justify-center gap-2 text-lg" onClick={() => resume(resumable)}>
            ▶ Carry on: {pictureById(resumable.pictureId)!.emoji} {pictureById(resumable.pictureId)!.name} · {LEVELS[resumable.level].name} ·{" "}
            {resumable.blocks.filter((b) => !b.at).length} to go
          </button>
        ) : null}
        {[
          { title: "Little pictures", note: "4 to 6 blocks · a good start", list: PICTURES.filter((p) => p.pieces) },
          { title: "Big pictures", note: "all 12 blocks", list: PICTURES.filter((p) => !p.pieces) },
        ].map((group) => (
          <div key={group.title}>
            <h3 className="mb-2 text-sm font-semibold">
              {group.title} <span className="font-normal text-muted">· {group.note}</span>
            </h3>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5">
              {group.list.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={pictureId === p.id}
                  onClick={() => setPictureId(p.id)}
                  className={`flex min-h-20 flex-col items-center justify-center gap-1 rounded-2xl border px-2 py-1 ${pictureId === p.id ? "border-accent bg-accent-soft font-medium text-accent" : "border-line bg-surface"}`}
                >
                  <span className="text-3xl" aria-hidden>
                    {p.emoji}
                  </span>
                  <span className="text-sm leading-tight">
                    {p.name}
                    {p.pieces ? <span className="text-muted"> · {p.pieces.length}</span> : null}
                  </span>
                  <StarRow n={allStars[`${p.id}-${level}`] ?? 0} small />
                </button>
              ))}
            </div>
          </div>
        ))}
        <div className="grid gap-2">
          {(Object.keys(LEVELS) as Level[]).map((l) => (
            <button
              key={l}
              type="button"
              aria-pressed={level === l}
              onClick={() => setLevel(l)}
              className={`min-h-12 rounded-xl border px-4 text-left ${level === l ? "border-accent bg-accent-soft font-medium text-accent" : "border-line bg-surface"}`}
            >
              {LEVELS[l].name} · {levelBlurb(l, piecesOf(picture).length)}
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
        <StarRow n={stars} />
        <p className="text-sm text-muted">{stars === 3 ? "3 stars: no hints!" : stars === 2 ? "Try with no hints for 3 stars" : "Try with fewer hints for more stars"}</p>
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
  const toGo = blocks.length - onBoard.length;
  const sel = selected ? blocks.find((b) => b.id === selected) : null;
  const bestStars = allStars[`${pictureId}-${level}`] ?? 0;
  // Free space beside the picture (it sits in the middle of its space), for the round buttons.
  const slack = side ? Math.max(0, (inner - cols * px - 24 - colW) / 2) : Math.max(0, (Math.min(760, screen.w - 48) - cols * px) / 2);
  const room = { left: Math.min(56, slack + (side ? 16 : 8)), right: side ? 0 : Math.min(56, slack + 8) };

  return (
    <div className="select-none space-y-2">
      <div className="flex items-center justify-between text-sm text-muted">
        <span>
          {picture.emoji} {picture.name} · <strong className="text-ink tabular-nums">{toGo}</strong> to go
        </span>
        <span className="tabular-nums">{secs(Math.round(elapsed / 100))}</span>
      </div>

      <div className="flex flex-col items-center gap-4 lg:flex-row lg:items-start lg:justify-center lg:gap-6">
        {/* The picture: the outline squares, then each placed block drawn as one piece on top */}
        <div className="flex justify-center">
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
            {ghostShown
              ? ghostShown.cells.map(([r, c]) => (
                  <div
                    key={`g${r},${c}`}
                    aria-hidden
                    className="sb-ghost pointer-events-none absolute rounded-[4px]"
                    style={{ left: c * px + 2, top: r * px + 2, width: px - 4, height: px - 4, background: `${pieceOf(ghostShown.id).color}55`, outline: `2px dashed ${pieceOf(ghostShown.id).color}` }}
                  />
                ))
              : null}
            {onBoard.map((b) => (
              <Block
                key={turning?.id === b.id ? `${b.id}-${turning.n}` : b.id}
                spin={turning?.id === b.id}
                id={b.id}
                shape={b.shape}
                px={px}
                style={{ position: "absolute", left: b.at![1] * px, top: b.at![0] * px }}
                locked={given.has(b.id)}
                selected={selected === b.id}
                pulse={nudge === b.id}
                onPointerDown={(e) => beginDrag(b.id, e)}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!given.has(b.id)) setSelected(b.id);
                }}
              />
            ))}
            {sel?.at && !drag && !given.has(sel.id) ? (
              <TurnButtons room={room} block={sel} px={px} rows={rows} cols={cols} want={want} placed={placedExcept(sel.id)} onTurn={(how) => turn(sel.id, how)} onOff={() => update(sel.id, { at: null })} />
            ) : null}
          </div>
        </div>

        <div className="flex w-full flex-col gap-3 lg:shrink-0" style={side ? { width: colW } : undefined}>
          {/* What to beat, and how to play */}
          <div className="flex min-h-14 items-center gap-3 rounded-2xl bg-surface-2 px-4 py-2">
            <span className="text-3xl" aria-hidden>
              {picture.emoji}
            </span>
            <span className="min-w-0 flex-1 text-sm leading-snug">
              <span className="block font-semibold">
                {LEVELS[level].name}
                {bestStars ? (
                  <>
                    {" · best "}
                    <StarRow n={bestStars} small />
                  </>
                ) : null}
                {best != null ? ` · fastest ${secs(best)}` : ""}
              </span>
              <span className="block text-muted">Drag blocks in. Tap a block twice to turn it.</span>
            </span>
          </div>
          <p aria-live="polite" className={`min-h-6 text-center text-sm ${msg?.startsWith("Hint") ? "text-accent" : "text-danger"}`}>
            {msg}
          </p>

          {/* The tray */}
          <div className="flex min-h-28 flex-wrap items-center justify-center gap-3 rounded-2xl bg-surface-2 p-3">
            {inTray.map((b) => (
              <span key={b.id} className={`relative ${selected === b.id ? "z-20" : ""}`}>
                <Block
                  key={turning?.id === b.id ? `${b.id}-${turning.n}` : b.id}
                  spin={turning?.id === b.id}
                  id={b.id}
                  shape={b.shape}
                  px={trayPx}
                  selected={selected === b.id}
                  pulse={ghostShown?.id === b.id}
                  onPointerDown={(e) => beginDrag(b.id, e)}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelected(b.id);
                  }}
                />
                {selected === b.id && !drag ? (
                  <RoundButtons className="absolute left-1/2 -translate-x-1/2" style={{ bottom: "calc(100% + 6px)" }} onTurn={(how) => turn(b.id, how)} />
                ) : null}
              </span>
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
        <div
          className="sb-grow pointer-events-none fixed z-50"
          style={{ left: drag.x - drag.dx, top: drag.y - drag.dy, transformOrigin: `${drag.dx}px ${drag.dy}px`, ["--sb-from" as string]: drag.grow }}
          aria-hidden
        >
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
  pulse,
  tint,
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
  pulse?: boolean;
  /** paint the whole block this colour (the finished picture) */
  tint?: string;
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
      className={`relative touch-none ${locked ? "" : "cursor-grab active:cursor-grabbing"} ${lifted ? "scale-105 drop-shadow-2xl" : ""} ${spin ? "sb-spin" : ""} ${pulse ? "sb-pulse" : ""}`}
      style={{ width: w * px, height: h * px, filter: selected ? "drop-shadow(0 0 6px rgba(255,198,41,.95)) brightness(1.06)" : undefined, ...style }}
    >
      {shape.map(([r, c]) => (
        <span
          key={`${r},${c}`}
          className="absolute transition-[background-color] duration-700"
          style={{
            left: c * px,
            top: r * px,
            width: px,
            height: px,
            backgroundColor: tint ?? p.color,
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

/** ★★☆ */
function StarRow({ n, small }: { n: number; small?: boolean }) {
  return (
    <span aria-label={`${n} of 3 stars`} className={`inline-flex gap-0.5 ${small ? "text-sm" : "sb-pop text-4xl"}`}>
      {[1, 2, 3].map((i) => (
        <span key={i} aria-hidden className={i <= n ? "text-[#f5b400]" : "text-[#cfd5df]"}>
          ★
        </span>
      ))}
    </span>
  );
}

const ROUND = "grid h-11 w-11 place-items-center rounded-full bg-[#ffc629] text-xl font-bold text-[#0b1d42] shadow-lg ring-2 ring-white transition active:scale-90";

/** The round yellow Rotate / Flip (and Take off) buttons. */
function RoundButtons({
  onTurn,
  onOff,
  vertical,
  className = "",
  style,
}: {
  onTurn: (how: (s: Cell[]) => Cell[]) => void;
  onOff?: () => void;
  vertical?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={`z-20 flex gap-2 ${vertical ? "flex-col" : ""} ${className}`}
      style={style}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <button type="button" aria-label="Rotate" title="Rotate (R)" className={ROUND} onClick={() => onTurn(rotate)}>
        ↻
      </button>
      <button type="button" aria-label="Flip" title="Flip (F)" className={ROUND} onClick={() => onTurn(flip)}>
        ⇋
      </button>
      {onOff ? (
        <button type="button" aria-label="Take off" title="Back to the tray" className={`${ROUND} bg-white text-base text-muted`} onClick={onOff}>
          ✕
        </button>
      ) : null}
    </div>
  );
}

/**
 * The round buttons next to a block on the picture, on whichever side covers the least: empty space
 * outside the picture first, never the block itself.
 */
export function buttonSpot(
  block: { shape: Cell[]; at: Cell },
  px: number,
  rows: number,
  cols: number,
  want: Set<string>,
  taken: Set<string>,
  count: number,
  /** free space beside the picture (left, right) the buttons may use */
  room: { left: number; right: number } = { left: 0, right: 0 },
): { x: number; y: number; vertical: boolean } {
  const h = Math.max(...block.shape.map((c) => c[0])) + 1;
  const w = Math.max(...block.shape.map((c) => c[1])) + 1;
  const [r, c] = block.at;
  const len = count * 44 + (count - 1) * 8;
  const own = new Set(block.shape.map(([a, b]) => `${a + r},${b + c}`));
  const W = cols * px;
  const H = rows * px;
  const midX = (c + w / 2) * px;
  const midY = (r + h / 2) * px;
  const spots = [
    { x: midX - len / 2, y: r * px - 52, vertical: false }, // above
    { x: (c + w) * px + 8, y: midY - len / 2, vertical: true }, // right
    { x: midX - len / 2, y: (r + h) * px + 8, vertical: false }, // below
    { x: c * px - 52, y: midY - len / 2, vertical: true }, // left
    { x: -room.left, y: midY - len / 2, vertical: true, far: true }, // out in the space left of the picture
    { x: W + room.right - 44, y: midY - len / 2, vertical: true, far: true }, // …or right of it
  ].map((s) => {
    const bw = s.vertical ? 44 : len;
    const bh = s.vertical ? len : 44;
    // keep it inside the picture's box, or the free space beside it
    const x = Math.max(-room.left, Math.min(W + room.right - bw, s.x));
    const y = Math.max(0, Math.min(H - bh, s.y));
    let cost = 0;
    for (let rr = Math.floor(y / px); rr <= Math.floor((y + bh - 1) / px); rr++)
      for (let cc = Math.floor(x / px); cc <= Math.floor((x + bw - 1) / px); cc++) {
        const k = `${rr},${cc}`;
        cost += own.has(k) ? 100 : !want.has(k) ? 0 : taken.has(k) ? 6 : 2;
      }
    // a little extra for being far from the block, so a close free spot wins a tie
    if ("far" in s) cost += 1 + Math.abs(x + bw / 2 - midX) / (4 * px);
    return { x, y, vertical: s.vertical, cost };
  });
  const best = spots.reduce((a, b) => (b.cost < a.cost ? b : a));
  return { x: best.x, y: best.y, vertical: best.vertical };
}

function TurnButtons({
  block,
  px,
  rows,
  cols,
  want,
  placed,
  room,
  onTurn,
  onOff,
}: {
  room: { left: number; right: number };
  block: Loose;
  px: number;
  rows: number;
  cols: number;
  want: Set<string>;
  placed: Placement[];
  onTurn: (how: (s: Cell[]) => Cell[]) => void;
  onOff: () => void;
}) {
  const taken = new Set(placed.flatMap((p) => p.cells.map((c) => c.join(","))));
  const spot = buttonSpot({ shape: block.shape, at: block.at! }, px, rows, cols, want, taken, 3, room);
  return <RoundButtons className="absolute" style={{ left: spot.x, top: spot.y }} vertical={spot.vertical} onTurn={onTurn} onOff={onOff} />;
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

const TINT: Record<string, string> = {
  bear: "#8d5a3b",
  three: "#2f66d8",
  hippo: "#7c6fa6",
  duck: "#f2b705",
  swan: "#4a90c8",
  whale: "#2b6cb0",
  camel: "#c8964a",
  rooster: "#d64534",
  giraffe: "#e0a42b",
  cat: "#e08a3c",
  house: "#c0563a",
  rocket: "#6b7a99",
  tree: "#2e8b47",
  turtle: "#4f9a4a",
  goldfish: "#f08a24",
  toadstool: "#d63c3c",
  boat: "#2f78c4",
  heart: "#e23d6d",
  icecream: "#f2a9c2",
  car: "#d6322e",
  bunny: "#a8a2b8",
};

/** The finished picture, small: the blocks fade into one colour so the animal shows. */
function Board({ picture, placed, px }: { picture: Picture; placed: Placement[]; px: number }) {
  const { rows, cols } = pictureSize(picture);
  const [tinted, setTinted] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setTinted(true), 1300);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="flex justify-center">
      <div aria-hidden className="relative" style={{ width: cols * px, height: rows * px }}>
        {placed.map((p) => (
          <Block key={p.id} id={p.id} shape={normalize(p.cells)} px={px} tint={tinted ? (TINT[picture.id] ?? "#2f6b62") : undefined} style={{ position: "absolute", left: top(p.cells)[1] * px, top: top(p.cells)[0] * px }} />
        ))}
      </div>
    </div>
  );
}
