// Keeps every line and rub-out until the server has saved it. If the internet drops,
// changes wait here (and in the browser's storage, in case the page is reloaded)
// and are sent again automatically.

export type QueuedOp = { op: "add"; mark: { id: string; page: number; data: unknown } } | { op: "del"; ids: string[] };
type Item = { body: QueuedOp; boardId: string; tries: number };
export type SendResult = "ok" | "retry" | "drop";

const MAX_ITEMS = 3000;

export class SaveQueue {
  items: Item[] = [];
  failing = false;
  private busy = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private stopped = false;

  constructor(
    private storageKey: string,
    private send: (body: QueuedOp) => Promise<SendResult>,
    private onChange: (pending: number, failing: boolean) => void,
    private store: Pick<Storage, "getItem" | "setItem" | "removeItem"> | null = typeof window !== "undefined" ? window.localStorage : null,
  ) {
    try {
      const raw = this.store?.getItem(storageKey);
      if (raw) this.items = (JSON.parse(raw) as Item[]).filter((i) => i && i.body && typeof i.boardId === "string").slice(-MAX_ITEMS);
    } catch {
      this.items = [];
    }
  }

  /** Changes left over from before a reload, for this board. */
  restored(boardId: string): QueuedOp[] {
    return this.items.filter((i) => i.boardId === boardId).map((i) => i.body);
  }

  /** Forget changes for other boards (e.g. Mr Ken uploaded new slides). */
  keepOnly(boardId: string) {
    const before = this.items.length;
    this.items = this.items.filter((i) => i.boardId === boardId);
    if (this.items.length !== before) this.persist();
  }

  push(body: QueuedOp, boardId: string) {
    this.items.push({ body, boardId, tries: 0 });
    if (this.items.length > MAX_ITEMS) this.items.shift();
    this.persist();
    void this.flush();
  }

  async flush() {
    if (this.busy || this.stopped) return;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.busy = true;
    try {
      while (this.items.length && !this.stopped) {
        const item = this.items[0];
        const r = await this.send(item.body);
        if (r === "retry") {
          item.tries++;
          this.failing = true;
          this.persist();
          const wait = Math.min(15_000, 1000 * 2 ** Math.min(item.tries, 4));
          this.timer = setTimeout(() => void this.flush(), wait);
          return;
        }
        this.items.shift(); // saved, or the server said it can never be saved
        this.failing = false;
        this.persist();
      }
    } finally {
      this.busy = false;
    }
  }

  stop() {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
  }

  private persist() {
    try {
      if (this.items.length) this.store?.setItem(this.storageKey, JSON.stringify(this.items));
      else this.store?.removeItem(this.storageKey);
    } catch {
      /* storage full or blocked — the queue in memory still works */
    }
    this.onChange(this.items.length, this.failing);
  }
}
