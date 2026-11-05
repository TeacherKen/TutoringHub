import "server-only";
import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/server";

// 🔔 Pop-ups on Mr Ken's phone (and any other device where he turned them on in Settings).
// Works on an iPhone once TutoringHub is on the home screen. Keys live only in Vercel's settings:
// NEXT_PUBLIC_VAPID_PUBLIC_KEY (shared with the browser), VAPID_PRIVATE_KEY (server only).

export const pushReady = () => Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);

let set = false;
function setup() {
  if (set) return;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:noreply@tutoringhub.app", process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
  set = true;
}

/** Send a pop-up to every device. Never throws: a notification must not break the page that sent it. */
export async function notifyTutor(n: { title: string; body: string; url: string; tag?: string }): Promise<void> {
  if (!pushReady()) return;
  try {
    setup();
    const admin = createAdminClient();
    const { data } = await admin.from("push_subscriptions").select("endpoint, p256dh, auth");
    const payload = JSON.stringify({ title: n.title, body: n.body.slice(0, 180), url: n.url, tag: n.tag });
    await Promise.all(
      ((data ?? []) as { endpoint: string; p256dh: string; auth: string }[]).map(async (s) => {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 3600 });
        } catch (e) {
          const code = (e as { statusCode?: number }).statusCode;
          if (code === 404 || code === 410) await admin.from("push_subscriptions").delete().eq("endpoint", s.endpoint); // turned off or app removed
        }
      }),
    );
  } catch {
    /* no notifications this time */
  }
}
