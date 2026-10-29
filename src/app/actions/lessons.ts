"use server";
import { revalidatePath } from "next/cache";
import { assertTutor } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { MATERIALS_BUCKET } from "@/lib/env";

const STATUSES = ["scheduled", "done", "cancelled", "cancelled_charged", "no_show"] as const;
const HOW = ["great", "good", "needs_practice"] as const;

export type NoteInput = {
  learned: string;
  next_time: string;
  homework: string;
  how_it_went: string | null;
  topics: string[];
  status: string;
  length_hours: number | null;
};

const clip = (v: string, max: number) => (v.trim() ? v.trim().slice(0, max) : null);

export async function saveLessonNote(lessonId: string, input: NoteInput): Promise<{ ok: boolean; at?: string }> {
  await assertTutor();
  const status = (STATUSES as readonly string[]).includes(input.status) ? input.status : "scheduled";
  const how = input.how_it_went && (HOW as readonly string[]).includes(input.how_it_went) ? input.how_it_went : null;
  const len = input.length_hours;
  const at = new Date().toISOString();
  const supabase = await createClient();
  const { error } = await supabase
    .from("lessons")
    .update({
      learned: clip(input.learned ?? "", 4000),
      next_time: clip(input.next_time ?? "", 4000),
      homework: clip(input.homework ?? "", 2000),
      how_it_went: how,
      topics: (input.topics ?? [])
        .map((t) => t.trim().toLowerCase().slice(0, 40))
        .filter(Boolean)
        .slice(0, 12),
      status,
      length_hours: len != null && Number.isFinite(len) && len >= 0 && len <= 12 ? Math.round(len * 100) / 100 : null,
      note_updated_at: at,
    })
    .eq("id", lessonId);
  if (error) return { ok: false };
  return { ok: true, at };
}

export async function saveFinalMessage(lessonId: string, message: string): Promise<{ ok: boolean }> {
  await assertTutor();
  const supabase = await createClient();
  const { error } = await supabase
    .from("lessons")
    .update({ final_message: clip(message, 6000) })
    .eq("id", lessonId);
  return { ok: !error };
}

export async function setSent(lessonId: string, sent: boolean): Promise<{ ok: boolean; sent_at: string | null }> {
  await assertTutor();
  const sent_at = sent ? new Date().toISOString() : null;
  const supabase = await createClient();
  const { error } = await supabase.from("lessons").update({ sent_at }).eq("id", lessonId);
  return { ok: !error, sent_at };
}

export async function addLessonStudent(form: FormData): Promise<void> {
  await assertTutor();
  const lessonId = String(form.get("lesson_id"));
  const studentId = String(form.get("student_id"));
  if (!studentId) return;
  const supabase = await createClient();
  await supabase
    .from("lesson_students")
    .upsert({ lesson_id: lessonId, student_id: studentId, match_source: "manual", uses_hours: true });
  await supabase.from("lessons").update({ students_locked: true }).eq("id", lessonId);
  revalidatePath("/", "layout");
}

export async function removeLessonStudent(form: FormData): Promise<void> {
  await assertTutor();
  const lessonId = String(form.get("lesson_id"));
  const supabase = await createClient();
  await supabase.from("lesson_students").delete().eq("lesson_id", lessonId).eq("student_id", String(form.get("student_id")));
  await supabase.from("lessons").update({ students_locked: true }).eq("id", lessonId);
  revalidatePath("/", "layout");
}

export async function setUsesHours(form: FormData): Promise<void> {
  await assertTutor();
  const lessonId = String(form.get("lesson_id"));
  const supabase = await createClient();
  await supabase
    .from("lesson_students")
    .update({ uses_hours: form.get("uses_hours") === "true", match_source: "manual" })
    .eq("lesson_id", lessonId)
    .eq("student_id", String(form.get("student_id")));
  await supabase.from("lessons").update({ students_locked: true }).eq("id", lessonId);
  revalidatePath("/", "layout");
}

function safeLink(raw: string): string | null {
  try {
    const u = new URL(raw.trim());
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}

export async function addMaterialLink(form: FormData): Promise<{ error?: string }> {
  await assertTutor();
  const url = safeLink(String(form.get("url") ?? ""));
  if (!url) return { error: "Please paste a full link starting with https://" };
  const host = new URL(url).hostname;
  const kind = host.endsWith("canva.com") || host.endsWith("canva.link") ? "canva" : "link";
  const supabase = await createClient();
  const { error } = await supabase.from("lesson_materials").insert({
    lesson_id: String(form.get("lesson_id")),
    kind,
    url,
    label: String(form.get("label") ?? "").trim().slice(0, 120) || (kind === "canva" ? "Canva" : host),
  });
  revalidatePath(`/lessons/${String(form.get("lesson_id"))}`);
  return error ? { error: "Couldn't save the link." } : {};
}

const EXT_FOR_KIND = { pdf: ["pdf"], photo: ["jpg", "png", "heic", "heif", "webp"] } as const;

/** Called after the browser has uploaded a file to private storage. */
export async function addMaterialFile(lessonId: string, path: string, kind: "pdf" | "photo", label: string) {
  await assertTutor();
  const m = /^([0-9a-f-]{36})\/([0-9a-f-]{36})\.([a-z]{3,4})$/.exec(path);
  if (!m || m[1] !== lessonId || !(EXT_FOR_KIND[kind] as readonly string[]).includes(m[3])) {
    return { error: "Bad file." };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("lesson_materials").insert({
    lesson_id: lessonId,
    kind: kind === "pdf" ? "pdf" : "photo",
    storage_path: path,
    label: label.trim().slice(0, 120) || (kind === "pdf" ? "Worksheet" : "Photo of work"),
  });
  revalidatePath(`/lessons/${lessonId}`);
  return error ? { error: "Couldn't save the file." } : {};
}

export async function removeMaterial(form: FormData): Promise<void> {
  await assertTutor();
  const id = String(form.get("id"));
  const supabase = await createClient();
  const { data } = await supabase.from("lesson_materials").select("storage_path").eq("id", id).single();
  if (data?.storage_path) await supabase.storage.from(MATERIALS_BUCKET).remove([data.storage_path]);
  await supabase.from("lesson_materials").delete().eq("id", id);
  revalidatePath("/", "layout");
}
