"use server";
import { assertTutor } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { notifyTutor } from "@/lib/push";

const isPushUrl = (u: string) => {
  try {
    return new URL(u).protocol === "https:" && u.length < 1000;
  } catch {
    return false;
  }
};

/** Remember this device for pop-ups (called after Mr Ken taps "Turn on" and allows them). */
export async function savePushSubscription(sub: { endpoint: string; keys: { p256dh: string; auth: string } }): Promise<{ ok?: boolean; error?: string }> {
  await assertTutor();
  if (!sub || !isPushUrl(sub.endpoint) || typeof sub.keys?.p256dh !== "string" || typeof sub.keys?.auth !== "string" || sub.keys.p256dh.length > 200 || sub.keys.auth.length > 100) {
    return { error: "That device can't take notifications." };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("push_subscriptions").upsert({ endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth }, { onConflict: "endpoint" });
  if (error) return { error: "Couldn't save. Has database update 0028 been run?" };
  return { ok: true };
}

/** Stop pop-ups on this device. */
export async function removePushSubscription(endpoint: string): Promise<{ ok?: boolean }> {
  await assertTutor();
  const supabase = await createClient();
  await supabase.from("push_subscriptions").delete().eq("endpoint", String(endpoint).slice(0, 1000));
  return { ok: true };
}

/** A test pop-up, so Mr Ken can see it works. */
export async function sendTestPush(): Promise<{ ok?: boolean }> {
  await assertTutor();
  await notifyTutor({ title: "🔔 TutoringHub", body: "Notifications are on. You'll get one when a family opens their page or sends a message.", url: "/", tag: "test" });
  return { ok: true };
}
