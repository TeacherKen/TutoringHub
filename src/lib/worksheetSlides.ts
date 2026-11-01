// 📤 A worksheet as smart-slide pages: landscape pages (like slides) with two columns of
// questions and plenty of ruled space to write on with a finger, pen or mouse.
// The answer key is left out — these pages are for the student.

import { numbered, type Worksheet, type WsQuestion } from "@/lib/worksheet";

export const PAGE_W = 1600;
export const PAGE_H = 900;
const M = 56; // page margin
const GAP = 56; // between the two columns
const FOOT = 34; // page number line
const COL_W = (PAGE_W - 2 * M - GAP) / 2;
const BLOCK_GAP = 26;
const LINE = 46; // one ruled line of working space
const ACCENT = "#0f6b62";
const FONT = '"Helvetica Neue", Helvetica, Arial, sans-serif';

export type Block =
  | { kind: "question"; heading?: string; n: number; item: WsQuestion }
  | { kind: "example"; heading?: string; q: string; steps: string[]; answer: string };

/** The worksheet as a list of blocks, in order. Each section's heading travels with its first block. */
export function worksheetBlocks(ws: Worksheet): Block[] {
  const out: Block[] = [];
  const all = numbered(ws);
  const section = (name: string, title: string) =>
    all
      .filter((x) => x.section === name)
      .forEach((x, i) => out.push({ kind: "question", heading: i === 0 ? title : undefined, n: x.n, item: x.item }));
  section("Warm-up", "Warm-up");
  if (ws.example.q) out.push({ kind: "example", heading: "Worked example", q: ws.example.q, steps: ws.example.steps, answer: ws.example.answer });
  section("Practice", "Practice");
  section("Word problems", "Word problems");
  section("Challenge", "Challenge ★");
  return out;
}

export type Placed = { block: Block; x: number; y: number; h: number };

/**
 * Put blocks on pages: down the left column, then the right, then a new page.
 * `measure` gives a block's height; `firstTop` is where the columns start on page 1 (under the title).
 */
export function layoutPages(blocks: Block[], measure: (b: Block) => number, firstTop: number): Placed[][] {
  const pages: Placed[][] = [[]];
  const bottom = PAGE_H - M - FOOT;
  let top = firstTop;
  let col = 0;
  let y = top;
  for (const block of blocks) {
    const h = measure(block);
    if (y + h > bottom && y > top) {
      if (col === 0) col = 1;
      else {
        pages.push([]);
        col = 0;
        top = M;
      }
      y = top;
    }
    pages[pages.length - 1].push({ block, x: M + col * (COL_W + GAP), y, h });
    y += h + BLOCK_GAP;
  }
  return pages;
}

function wrap(ctx: CanvasRenderingContext2D, text: string, width: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > width) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

const workLines = (item: WsQuestion) => Math.min(5, Math.max(2, item.lines));
const HEAD_H = 40;
const Q_FONT = `26px ${FONT}`;
const Q_LINE = 34;
const NUM_W = 46;

function measureBlock(ctx: CanvasRenderingContext2D, b: Block): number {
  let h = b.heading ? HEAD_H : 0;
  ctx.font = Q_FONT;
  if (b.kind === "question") {
    h += wrap(ctx, b.item.q, COL_W - NUM_W).length * Q_LINE + 8 + workLines(b.item) * LINE + 38;
  } else {
    h += wrap(ctx, b.q, COL_W).length * Q_LINE + 8;
    ctx.font = `24px ${FONT}`;
    for (const s of b.steps) h += wrap(ctx, s, COL_W - 34).length * 32;
    h += 44;
  }
  return h;
}

function drawHeading(ctx: CanvasRenderingContext2D, text: string, x: number, y: number) {
  ctx.fillStyle = ACCENT;
  ctx.font = `600 18px ${FONT}`;
  ctx.letterSpacing = "2px";
  ctx.fillText(text.toUpperCase(), x, y + 20);
  ctx.letterSpacing = "0px";
  ctx.fillStyle = "#cfd5dc";
  ctx.fillRect(x, y + 30, COL_W, 1.5);
}

function drawBlock(ctx: CanvasRenderingContext2D, p: Placed) {
  const { block: b, x } = p;
  let y = p.y;
  if (b.heading) {
    drawHeading(ctx, b.heading, x, y);
    y += HEAD_H;
  }
  ctx.textBaseline = "alphabetic";
  if (b.kind === "question") {
    ctx.fillStyle = "#111111";
    ctx.font = `700 26px ${FONT}`;
    ctx.textAlign = "right";
    ctx.fillText(`${b.n}.`, x + NUM_W - 12, y + 26);
    ctx.textAlign = "left";
    ctx.font = Q_FONT;
    for (const line of wrap(ctx, b.item.q, COL_W - NUM_W)) {
      ctx.fillText(line, x + NUM_W, y + 26);
      y += Q_LINE;
    }
    y += 8;
    // ruled space to write in
    ctx.fillStyle = "#d9dde3";
    for (let i = 1; i <= workLines(b.item); i++) ctx.fillRect(x + NUM_W, y + i * LINE - 1, COL_W - NUM_W, 1.5);
    y += workLines(b.item) * LINE;
    // answer line
    ctx.fillStyle = "#333333";
    ctx.font = `22px ${FONT}`;
    ctx.textAlign = "right";
    ctx.fillText("Answer:", x + COL_W - 190, y + 30);
    ctx.textAlign = "left";
    ctx.fillStyle = "#6b7280";
    ctx.fillRect(x + COL_W - 180, y + 32, 180, 1.5);
  } else {
    ctx.fillStyle = "#111111";
    ctx.font = Q_FONT;
    for (const line of wrap(ctx, b.q, COL_W)) {
      ctx.fillText(line, x, y + 26);
      y += Q_LINE;
    }
    y += 8;
    ctx.font = `24px ${FONT}`;
    ctx.fillStyle = "#374151";
    b.steps.forEach((s, i) => {
      wrap(ctx, s, COL_W - 34).forEach((line, j) => {
        if (j === 0) ctx.fillText(`${i + 1}.`, x + 4, y + 24);
        ctx.fillText(line, x + 34, y + 24);
        y += 32;
      });
    });
    if (b.answer) {
      ctx.fillStyle = "#111111";
      ctx.font = `700 24px ${FONT}`;
      ctx.fillText(`Answer: ${b.answer}`, x, y + 32);
    }
  }
}

/** Draw the title, intro and reminder at the top of page 1. Returns where the columns start. */
function drawHeader(ctx: CanvasRenderingContext2D, ws: Worksheet): number {
  let y = M;
  ctx.fillStyle = ACCENT;
  ctx.font = `600 18px ${FONT}`;
  ctx.letterSpacing = "2px";
  ctx.fillText(`MATHS WORKSHEET${ws.level ? ` · ${ws.level.toUpperCase()}` : ""}`, M, y + 18);
  ctx.letterSpacing = "0px";
  y += 30;
  ctx.fillStyle = "#111111";
  ctx.font = `600 44px ${FONT}`;
  ctx.fillText(ws.title, M, y + 42);
  y += 56;
  if (ws.intro) {
    ctx.fillStyle = "#4b5563";
    ctx.font = `24px ${FONT}`;
    ctx.fillText(wrap(ctx, ws.intro, PAGE_W - 2 * M)[0], M, y + 26);
    y += 40;
  }
  if (ws.tip) {
    ctx.font = `24px ${FONT}`;
    const lines = wrap(ctx, `Remember: ${ws.tip}`, PAGE_W - 2 * M - 48).slice(0, 2);
    const h = lines.length * 32 + 24;
    ctx.fillStyle = "#eef6f5";
    ctx.fillRect(M, y + 6, PAGE_W - 2 * M, h);
    ctx.fillStyle = ACCENT;
    ctx.fillRect(M, y + 6, 6, h);
    ctx.fillStyle = "#111111";
    lines.forEach((line, i) => ctx.fillText(line, M + 28, y + 6 + 12 + 24 + i * 32));
    y += h + 22;
  }
  return y + 8;
}

/** The worksheet as JPG pages for the smart slides (landscape, answer key left out). */
export async function worksheetToSlides(ws: Worksheet): Promise<Blob[]> {
  const make = () => {
    const c = document.createElement("canvas");
    c.width = PAGE_W;
    c.height = PAGE_H;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, PAGE_W, PAGE_H);
    return { c, ctx };
  };
  const first = make();
  const top = drawHeader(first.ctx, ws);
  const pages = layoutPages(worksheetBlocks(ws), (b) => measureBlock(first.ctx, b), top);
  const out: Blob[] = [];
  for (let i = 0; i < pages.length; i++) {
    const { c, ctx } = i === 0 ? first : make();
    for (const p of pages[i]) drawBlock(ctx, p);
    ctx.fillStyle = "#9ca3af";
    ctx.font = `18px ${FONT}`;
    ctx.textAlign = "right";
    ctx.fillText(`${ws.title} · page ${i + 1} of ${pages.length}`, PAGE_W - M, PAGE_H - M + 14);
    ctx.textAlign = "left";
    out.push(await new Promise<Blob>((ok, bad) => c.toBlob((b) => (b ? ok(b) : bad(new Error("image"))), "image/jpeg", 0.9)));
  }
  return out;
}
