// Live copy of a student's screen (like watching a shared Canva design): instead of sending
// pictures, the student's room records every change on its screen (taps, moves, animations,
// typing) with rrweb and sends those small changes over the live connection. Mr Ken's screen
// rebuilds the page and plays the changes as they arrive, so it looks smooth and sharp.
// Only runs while Mr Ken is watching. The game pictures stay as a backup.

import type { eventWithTime } from "rrweb";

/** One message on the live connection: some recorded changes, squeezed (gzip, as text). */
export type CopyMsg = {
  /** This recording (a new one starts when the room reloads). */
  s: string;
  /** Message number, so a lost one can be noticed (then a fresh full copy is asked for). */
  q: number;
  /** Big messages are split in parts: part i of "of". */
  i: number;
  of: number;
  z: string;
};

const PART = 180_000; // the live connection takes up to 256 KB a message
const FLUSH_MS = 100; // changes are sent in small batches, about 10 a second

async function squeeze(text: string): Promise<string> {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream("gzip"));
  const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

async function unsqueeze(z: string): Promise<string> {
  const bin = atob(z);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
  return new Response(stream).text();
}

/** Can this browser do the live copy? (Needs gzip in the browser: iPads from iOS 16.4.) */
export const canLiveCopy = () => typeof window !== "undefined" && typeof CompressionStream !== "undefined" && typeof DecompressionStream !== "undefined";

/**
 * The student's side: start recording and sending. `full()` sends a fresh complete copy
 * (when Mr Ken starts watching, or missed something). `stop()` ends it.
 */
export async function startCopy(send: (m: CopyMsg) => void): Promise<{ full: () => void; stop: () => void }> {
  const { record } = await import("rrweb");
  const s = Math.random().toString(36).slice(2, 10);
  let q = 0;
  let buf: eventWithTime[] = [];
  let chain = Promise.resolve();
  const flush = () => {
    if (!buf.length) return;
    const events = buf;
    buf = [];
    // One batch at a time, in order.
    chain = chain.then(async () => {
      try {
        const z = await squeeze(JSON.stringify(events));
        const of = Math.max(1, Math.ceil(z.length / PART));
        const n = q++;
        for (let i = 0; i < of; i++) send({ s, q: n, i, of, z: z.slice(i * PART, (i + 1) * PART) });
      } catch {
        /* skip this batch; Mr Ken's screen asks for a full copy if it notices */
      }
    });
  };
  const stopRec = record({
    emit: (e) => {
      buf.push(e);
    },
    sampling: { mousemove: 50, scroll: 100, input: "last", media: 800 },
    recordCanvas: false,
    collectFonts: false,
    inlineImages: false,
    maskAllInputs: false,
  });
  const timer = setInterval(flush, FLUSH_MS);
  return {
    full: () => {
      try {
        record.takeFullSnapshot(true);
      } catch {
        /* not recording */
      }
    },
    stop: () => {
      clearInterval(timer);
      stopRec?.();
      buf = [];
    },
  };
}

/**
 * Mr Ken's side: puts the parts back together, opens them and hands the changes over in order.
 * Calls `needFull()` when something went missing (a fresh full copy then fixes it).
 */
export function copyReceiver(onEvents: (events: eventWithTime[], fresh: boolean) => void, needFull: () => void) {
  let session = "";
  let expect = 0;
  let waitingFull = true;
  const parts = new Map<number, string[]>();
  let chain = Promise.resolve();
  let askedAt = 0;
  return (m: CopyMsg) => {
    if (!m || typeof m.s !== "string" || typeof m.z !== "string" || !Number.isInteger(m.q) || !Number.isInteger(m.i) || !Number.isInteger(m.of) || m.of < 1 || m.of > 40) return;
    if (m.s !== session) {
      // A new recording (the room reloaded or started): wait for its full copy.
      session = m.s;
      expect = m.q;
      parts.clear();
      waitingFull = true;
    }
    const got = parts.get(m.q) ?? new Array<string>(m.of);
    got[m.i] = m.z;
    parts.set(m.q, got);
    if (got.filter((x) => x !== undefined).length < m.of) return; // more parts to come
    parts.delete(m.q);
    if (m.q < expect) return; // old
    if (m.q > expect && !waitingFull) {
      // Missed a batch: ask for a full copy and wait for it.
      waitingFull = true;
      needFull();
    }
    expect = m.q + 1;
    const z = got.join("");
    chain = chain.then(async () => {
      try {
        const events = JSON.parse(await unsqueeze(z)) as eventWithTime[];
        if (!Array.isArray(events) || !events.length) return;
        const hasFull = events.some((e) => e.type === 2); // 2 = a full copy of the page
        if (waitingFull && !hasFull) {
          // Can't use changes without the page they change: ask for it (at most every 2 seconds).
          if (Date.now() - askedAt > 2000) {
            askedAt = Date.now();
            needFull();
          }
          return;
        }
        const fresh = waitingFull;
        waitingFull = false;
        onEvents(events, fresh);
      } catch {
        if (!waitingFull) {
          waitingFull = true;
          needFull();
        }
      }
    });
  };
}
