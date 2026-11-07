"use server";
import { assertTutor } from "@/lib/auth";

/** When a worksheet photo can't be opened or uploaded, note why in the server log (file name, type, size, error — never the picture). */
export async function reportPhotoProblem(info: { name: string; type: string; size: number; step: string; error: string; agent: string }): Promise<void> {
  await assertTutor();
  const clip = (s: unknown, n: number) => String(s ?? "").slice(0, n);
  console.warn("[photo-problem]", JSON.stringify({ name: clip(info.name, 80), type: clip(info.type, 40), size: Number(info.size) || 0, step: clip(info.step, 20), error: clip(info.error, 300), agent: clip(info.agent, 160) }));
}
