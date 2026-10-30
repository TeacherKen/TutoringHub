import { describe, expect, it } from "vitest";
import { SaveQueue, type QueuedOp, type SendResult } from "@/lib/saveQueue";

function memStore() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), m };
}
const add = (id: string): QueuedOp => ({ op: "add", mark: { id, page: 0, data: {} } });
const tick = () => new Promise((r) => setTimeout(r, 0));

describe("save queue (writing is never lost)", () => {
  it("keeps changes while offline and sends them in order once back", async () => {
    const store = memStore();
    let online = false;
    const sent: string[] = [];
    const q = new SaveQueue("k", async (b) => {
      if (!online) return "retry";
      sent.push((b as { mark: { id: string } }).mark.id);
      return "ok";
    }, () => {}, store);
    q.push(add("a"), "B");
    q.push(add("b"), "B");
    await tick();
    expect(q.items).toHaveLength(2);
    expect(q.failing).toBe(true);
    expect(store.m.get("k")).toContain('"a"');
    online = true;
    await q.flush();
    expect(sent).toEqual(["a", "b"]);
    expect(q.items).toHaveLength(0);
    expect(store.m.has("k")).toBe(false);
    q.stop();
  });

  it("brings back unsaved changes after a reload", () => {
    const store = memStore();
    const q1 = new SaveQueue("k", async () => "retry" as SendResult, () => {}, store);
    q1.push(add("x"), "B");
    q1.stop();
    const q2 = new SaveQueue("k", async () => "ok" as SendResult, () => {}, store);
    expect(q2.restored("B").map((o) => (o as { mark: { id: string } }).mark.id)).toEqual(["x"]);
    expect(q2.restored("OTHER")).toEqual([]);
    q2.stop();
  });

  it("drops changes the server can never accept", async () => {
    const q = new SaveQueue("k", async () => "drop" as SendResult, () => {}, memStore());
    q.push(add("bad"), "B");
    await tick();
    expect(q.items).toHaveLength(0);
  });
});
