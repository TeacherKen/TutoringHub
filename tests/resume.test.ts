import { describe, expect, it } from "vitest";
import { resumeAt } from "@/lib/boardShared";

const L = [...Array(40).keys()];
const now = Date.parse("2026-11-07T10:00:00Z");
describe("📍 smart slides carry on where we left off", () => {
  it("a later lesson opens on the page after the last one the child wrote on (Alice: page 8 → page 9)", () => {
    expect(resumeAt(L, { page: 7, created_at: "2026-11-05T11:51:44Z" }, now)).toEqual({ page: 8, after: 7 });
  });
  it("the same lesson (e.g. a refresh) stays on that page", () => {
    expect(resumeAt(L, { page: 7, created_at: "2026-11-07T09:30:00Z" }, now)).toEqual({ page: 7, after: null });
  });
  it("nothing written yet: page 1", () => {
    expect(resumeAt(L, null, now)).toBeNull();
  });
  it("follows the page order when pages were added in the middle", () => {
    expect(resumeAt([0, 1, 1000, 2], { page: 1, created_at: "2026-11-01T00:00:00Z" }, now)).toEqual({ page: 1000, after: 1 });
  });
  it("on the last page it stays there", () => {
    expect(resumeAt([0, 1], { page: 1, created_at: "2026-11-01T00:00:00Z" }, now)).toEqual({ page: 1, after: null });
  });
});
