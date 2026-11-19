import { describe, expect, it } from "vitest";
import { cleanView, pickSender, type Sender } from "@/lib/watch";

const page = (id: string, tab: "lesson" | "games", seen: number, idle?: number, hid?: boolean): Sender => ({ view: { tab, game: null, practice: null, id, idle, hid }, seen });

describe("watching a room that is open in two places", () => {
  const now = 100_000;
  it("shows the page the child touched most recently", () => {
    const lesson = page("a", "lesson", now - 500, 60_000);
    const game = page("b", "games", now - 3000, 1000);
    expect(pickSender([lesson, game], now, 12_000)?.view.id).toBe("b");
  });
  it("a page in front beats a page in the background", () => {
    const hidden = page("a", "lesson", now, 0, true);
    const front = page("b", "games", now - 2000, 30_000);
    expect(pickSender([hidden, front], now, 12_000)?.view.id).toBe("b");
  });
  it("forgets a page that went quiet, and old pages without an id go last", () => {
    const gone = page("a", "games", now - 20_000, 0);
    const old: Sender = { view: { tab: "lesson", game: null, practice: null }, seen: now };
    const fresh = page("b", "games", now - 1000, 50_000);
    expect(pickSender([gone, old, fresh], now, 12_000)?.view.id).toBe("b");
    expect(pickSender([gone], now, 12_000)).toBeNull();
  });
  it("keeps the page details when a message comes in", () => {
    expect(cleanView({ tab: "games", game: "sd", id: "ab12cd34", idle: 250, hid: true })).toMatchObject({ id: "ab12cd34", idle: 250, hid: true });
    expect(cleanView({ tab: "games", id: "<bad>" })?.id).toBeUndefined();
  });
});
