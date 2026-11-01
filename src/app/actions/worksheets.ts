"use server";
import { revalidatePath } from "next/cache";
import { assertTutor } from "@/lib/auth";

/** 📝 Make the next worksheet from the lesson summary's Part 2 brief. */
export async function makeWorksheet(lessonId: string, brief: string): Promise<{ id?: string; error?: string }> {
  await assertTutor();
  if (!/^[0-9a-f-]{36}$/.test(String(lessonId))) return { error: "Lesson not found." };
  const text = String(brief ?? "").slice(0, 8000);
  if (text.trim().length < 40) return { error: "Summarise the lesson first, so the AI knows what to practise." };
  const { createWorksheet } = await import("@/lib/worksheetAI");
  const r = await createWorksheet(lessonId, text);
  if (r.id) revalidatePath(`/lessons/${lessonId}`);
  return r;
}
