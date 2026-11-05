"use server";
import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { assertTutor } from "@/lib/auth";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { isFamilyToken } from "@/lib/family";

const newToken = () => randomBytes(24).toString("base64url");

/** Get (or make) a family's private link. */
export async function ensureFamilyToken(accountId: string): Promise<{ token?: string; error?: string }> {
  await assertTutor();
  const supabase = await createClient();
  const { data, error } = await supabase.from("hour_accounts").select("family_token").eq("id", accountId).maybeSingle();
  if (error) return { error: "Run database update 0015 first." };
  if (data?.family_token) return { token: data.family_token as string };
  const token = newToken();
  const { error: upErr } = await supabase.from("hour_accounts").update({ family_token: token }).eq("id", accountId);
  if (upErr) return { error: "Couldn't make the link." };
  revalidatePath("/", "layout");
  return { token };
}

/** Make a new link — the old one stops working (e.g. if it was forwarded). */
export async function resetFamilyToken(accountId: string): Promise<{ token?: string; error?: string }> {
  await assertTutor();
  const token = newToken();
  const supabase = await createClient();
  const { error } = await supabase.from("hour_accounts").update({ family_token: token, family_consent_at: null }).eq("id", accountId);
  if (error) return { error: "Couldn't make a new link." };
  revalidatePath("/", "layout");
  return { token };
}

/** The parent confirms they are the child's parent or guardian (asked once). */
export async function acceptFamilyConsent(form: FormData): Promise<void> {
  const token = String(form.get("token") ?? "");
  if (!isFamilyToken(token) || form.get("agree") !== "on") return;
  await createAdminClient().from("hour_accounts").update({ family_consent_at: new Date().toISOString() }).eq("family_token", token).is("family_consent_at", null);
  revalidatePath(`/family/${token}`);
}

// ---- 💬 Messages between the family and Mr Ken ------------------------------------------------

export type NoteState = { ok?: boolean; error?: string } | null;
const MAX_NOTE = 1000;
/** Most messages a family can send in a day: plenty for a chat, but stops a forwarded link being used to spam. */
const NOTES_PER_DAY = 20;
const cleanBody = (v: FormDataEntryValue | null) => String(v ?? "").replace(/\r\n/g, "\n").trim();

/** A parent writes to Mr Ken from the family page (optionally under one lesson update). No sign-in: the link is checked. */
export async function addFamilyNote(_: NoteState, form: FormData): Promise<NoteState> {
  const token = String(form.get("token") ?? "");
  const body = cleanBody(form.get("body"));
  const lessonId = String(form.get("lesson_id") ?? "");
  if (!isFamilyToken(token)) return { error: "This link doesn't work. Please ask for a new one." };
  if (!body) return { error: "Please write a message first." };
  if (body.length > MAX_NOTE) return { error: `Please keep it under ${MAX_NOTE} characters.` };
  const admin = createAdminClient();
  const { data: acct } = await admin.from("hour_accounts").select("id, family_consent_at").eq("family_token", token).maybeSingle();
  if (!acct?.family_consent_at) return { error: "This link doesn't work. Please ask for a new one." };
  const { count } = await admin
    .from("family_notes")
    .select("id", { count: "exact", head: true })
    .eq("hour_account_id", acct.id)
    .eq("author", "parent")
    .gte("created_at", new Date(Date.now() - 86_400_000).toISOString());
  if ((count ?? 0) >= NOTES_PER_DAY) return { error: "That's a lot of messages today. Please try again tomorrow." };
  // A reply under a lesson update: only for a lesson with this family's children in it.
  let lesson: string | null = null;
  if (/^[0-9a-f-]{36}$/i.test(lessonId)) {
    const { data: kids } = await admin.from("students").select("id").eq("hour_account_id", acct.id);
    const ids = (kids ?? []).map((k) => k.id as string);
    const { data: link } = ids.length ? await admin.from("lesson_students").select("lesson_id").eq("lesson_id", lessonId).in("student_id", ids).limit(1) : { data: [] };
    if (link?.length) lesson = lessonId;
  }
  const { error } = await admin.from("family_notes").insert({ hour_account_id: acct.id, lesson_id: lesson, author: "parent", body });
  if (error) return { error: "Couldn't send. Please try again." };
  // 🔔 Pop-up on Mr Ken's phone, sent after the parent's page has its answer.
  after(async () => {
    const { data: kids } = await admin.from("students").select("id, first_name, parent_name, active").eq("hour_account_id", acct.id).order("first_name");
    const list = (kids ?? []) as { id: string; first_name: string; parent_name: string | null; active: boolean }[];
    const who = list.map((k) => k.parent_name?.trim()).find(Boolean) ?? `${list.filter((k) => k.active).map((k) => k.first_name).join(" & ") || "A"}'s family`;
    const { notifyTutor } = await import("@/lib/push");
    await notifyTutor({ title: `💬 ${who}`, body, url: list[0] ? `/students/${list[0].id}#messages` : "/", tag: `note-${acct.id}` });
  });
  revalidatePath(`/family/${token}`);
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Mr Ken replies to a family (shown on their page under their message). */
export async function replyFamilyNote(_: NoteState, form: FormData): Promise<NoteState> {
  await assertTutor();
  const accountId = String(form.get("account_id") ?? "");
  const body = cleanBody(form.get("body"));
  const lessonId = String(form.get("lesson_id") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(accountId)) return { error: "Missing family." };
  if (!body) return { error: "Write a reply first." };
  if (body.length > MAX_NOTE) return { error: `Keep it under ${MAX_NOTE} characters.` };
  const supabase = await createClient();
  const { error } = await supabase
    .from("family_notes")
    .insert({ hour_account_id: accountId, lesson_id: /^[0-9a-f-]{36}$/i.test(lessonId) ? lessonId : null, author: "tutor", body });
  if (error) return { error: "Couldn't send. Has database update 0028 been run?" };
  // Replying means the family's messages have been read.
  await supabase.from("family_notes").update({ read_at: new Date().toISOString() }).eq("hour_account_id", accountId).eq("author", "parent").is("read_at", null);
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Mr Ken has seen this family's messages. */
export async function markFamilyNotesRead(accountId: string): Promise<{ ok?: boolean; error?: string }> {
  await assertTutor();
  if (!/^[0-9a-f-]{36}$/i.test(accountId)) return { error: "Missing family." };
  const supabase = await createClient();
  const { error } = await supabase.from("family_notes").update({ read_at: new Date().toISOString() }).eq("hour_account_id", accountId).eq("author", "parent").is("read_at", null);
  if (error) return { error: "Couldn't update." };
  revalidatePath("/", "layout");
  return { ok: true };
}
