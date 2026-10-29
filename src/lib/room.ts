import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import { MATERIALS_BUCKET } from "@/lib/constants";

// A student's room is opened with a private link (no sign-in, because they're children).
// The link only ever shows: the student's first name, one lesson's time, that lesson's
// slides/worksheets, and whether break-time games are open. Nothing else.

const TOKEN_RE = /^[A-Za-z0-9_-]{24,64}$/;
const GAMES_AUTO_CLOSE_MIN = 45;

export type RoomMaterial = { kind: "canva" | "pdf" | "link"; label: string; href: string; embed: string | null };
export type RoomData = {
  firstName: string;
  lesson: { start_at: string; end_at: string; when: "now" | "next" | "last" } | null;
  materials: RoomMaterial[];
  gamesOpen: boolean;
};

export function isValidToken(token: string): boolean {
  return TOKEN_RE.test(token);
}

/** Canva share link → embeddable view link (works when the design is shared "Anyone with the link can view"). */
export function canvaEmbed(url: string): string | null {
  try {
    const u = new URL(url);
    if (!(u.hostname === "canva.com" || u.hostname.endsWith(".canva.com"))) return null;
    const m = /^\/design\/([A-Za-z0-9_-]+)(?:\/([A-Za-z0-9_-]+))?/.exec(u.pathname);
    if (!m) return null;
    const key = m[2] && m[2] !== "edit" && m[2] !== "view" && m[2] !== "watch" ? `/${m[2]}` : "";
    return `https://www.canva.com/design/${m[1]}${key}/view?embed`;
  } catch {
    return null;
  }
}

export async function getRoom(token: string): Promise<RoomData | null> {
  if (!isValidToken(token)) return null;
  const admin = createAdminClient();
  const { data: s } = await admin
    .from("students")
    .select("id, first_name, active, games_open, games_opened_at")
    .eq("room_token", token)
    .maybeSingle();
  if (!s || !s.active) return null;

  const opened = s.games_opened_at ? new Date(s.games_opened_at).getTime() : 0;
  const gamesOpen = Boolean(s.games_open) && Date.now() - opened < GAMES_AUTO_CLOSE_MIN * 60_000;

  // Find this student's lesson: happening now, else the next one, else the last one.
  const now = Date.now();
  const { data: rows } = await admin
    .from("lesson_students")
    .select("lessons!inner(id, start_at, end_at, status, ignored, in_calendar)")
    .eq("student_id", s.id)
    .gte("lessons.start_at", new Date(now - 8 * 86_400_000).toISOString())
    .lte("lessons.start_at", new Date(now + 8 * 86_400_000).toISOString());
  const lessons = ((rows ?? []) as unknown as { lessons: { id: string; start_at: string; end_at: string; status: string; ignored: boolean; in_calendar: boolean } }[])
    .map((r) => r.lessons)
    .filter((l) => !l.ignored && l.in_calendar && l.status !== "cancelled" && l.status !== "cancelled_charged")
    .sort((a, b) => a.start_at.localeCompare(b.start_at));

  const t = (iso: string) => new Date(iso).getTime();
  const current = lessons.find((l) => t(l.start_at) - 30 * 60_000 <= now && now <= t(l.end_at) + 30 * 60_000);
  const next = lessons.find((l) => t(l.start_at) > now);
  const last = [...lessons].reverse().find((l) => t(l.start_at) <= now);
  const picked = current ? { l: current, when: "now" as const } : next ? { l: next, when: "next" as const } : last ? { l: last, when: "last" as const } : null;

  const materials: RoomMaterial[] = [];
  if (picked) {
    const { data: mats } = await admin
      .from("lesson_materials")
      .select("kind, url, storage_path, label")
      .eq("lesson_id", picked.l.id)
      .in("kind", ["canva", "link", "pdf"])
      .order("created_at");
    for (const m of mats ?? []) {
      if (m.kind === "pdf" && m.storage_path) {
        const { data } = await admin.storage.from(MATERIALS_BUCKET).createSignedUrl(m.storage_path, 60 * 60 * 2);
        if (data?.signedUrl) materials.push({ kind: "pdf", label: m.label || "Worksheet", href: data.signedUrl, embed: null });
      } else if (m.url) {
        materials.push({
          kind: m.kind === "canva" ? "canva" : "link",
          label: m.label || (m.kind === "canva" ? "Slides" : "Link"),
          href: m.url,
          embed: m.kind === "canva" ? canvaEmbed(m.url) : null,
        });
      }
    }
  }

  return {
    firstName: s.first_name,
    lesson: picked ? { start_at: picked.l.start_at, end_at: picked.l.end_at, when: picked.when } : null,
    materials,
    gamesOpen,
  };
}
