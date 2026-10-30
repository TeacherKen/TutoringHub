"use server";
import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
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
