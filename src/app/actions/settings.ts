"use server";
import { revalidatePath } from "next/cache";
import { assertTutor } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_TEMPLATE, TONES } from "@/lib/feedbackPrompt";

export type SettingsState = { ok?: string; error?: string } | null;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function addPerson(_: SettingsState, form: FormData): Promise<SettingsState> {
  const me = await assertTutor();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const role = form.get("role") === "tutor" ? "tutor" : "viewer";
  if (!EMAIL_RE.test(email)) return { error: "Please enter a valid email address." };
  if (email === me.email && role !== "tutor") return { error: "You can't remove your own tutor access." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("app_users")
    .upsert({ email, role, display_name: String(form.get("display_name") ?? "").trim().slice(0, 60) || null });
  if (error) return { error: "Couldn't save." };
  revalidatePath("/settings");
  return { ok: `${email} can now sign in.` };
}

export async function removePerson(form: FormData): Promise<void> {
  const me = await assertTutor();
  const email = String(form.get("email") ?? "").toLowerCase();
  if (email === me.email) return; // can't remove yourself
  const supabase = await createClient();
  await supabase.from("app_users").delete().eq("email", email);
  revalidatePath("/settings");
}

export async function saveFeedbackSettings(_: SettingsState, form: FormData): Promise<SettingsState> {
  await assertTutor();
  const tone = String(form.get("tone") ?? "warm");
  const template = String(form.get("prompt_template") ?? "").trim();
  const low = Number(form.get("low_hours_threshold"));
  const trackFrom = String(form.get("track_from") ?? "");
  const supabase = await createClient();
  const { error } = await supabase
    .from("settings")
    .update({
      tone: tone in TONES ? tone : "warm",
      allow_emoji: form.get("allow_emoji") === "on",
      prompt_template: !template || template === DEFAULT_TEMPLATE.trim() ? null : template.slice(0, 8000),
      low_hours_threshold: Number.isFinite(low) && low >= 0 && low <= 50 ? low : 2,
      ...(/^\d{4}-\d{2}-\d{2}$/.test(trackFrom) ? { track_from: trackFrom } : {}),
    })
    .eq("id", 1);
  if (error) return { error: "Couldn't save." };
  revalidatePath("/", "layout");
  return { ok: "Saved." };
}
