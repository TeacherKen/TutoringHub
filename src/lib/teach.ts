// 🧑‍🏫 Teach together: Mr Ken works something on his lesson page and it appears live on the child's
// room screen (no screen sharing). Sent over the same kind of live connection as watching and Wolf vs Sheep.

export const teachChannel = (token: string) => `tutoringhub-teach-${token}`;

export type FractionDemo = { kind: "fraction"; parts: number; on: number[]; shape: "pizza" | "bar"; hidden: boolean };
export type TeachMsg = FractionDemo | { kind: "off" };

const SLICES = new Set([2, 3, 4, 5, 6, 8, 10, 12]);

/** Only accept what Mr Ken's page could really send. */
export function cleanTeach(p: unknown): TeachMsg | null {
  if (!p || typeof p !== "object") return null;
  const m = p as Record<string, unknown>;
  if (m.kind === "off") return { kind: "off" };
  if (m.kind !== "fraction") return null;
  const parts = Number(m.parts);
  if (!SLICES.has(parts)) return null;
  const on = Array.isArray(m.on) ? [...new Set(m.on.map(Number).filter((i) => Number.isInteger(i) && i >= 0 && i < parts))] : [];
  return { kind: "fraction", parts, on, shape: m.shape === "bar" ? "bar" : "pizza", hidden: m.hidden === true };
}
