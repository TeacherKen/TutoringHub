import type { Student } from "@/lib/data";

const GAMES_AUTO_CLOSE_MIN = 45;

/** The bits of a student the room buttons need (games count as closed after 45 minutes). */
export function roomStudent(s: Student & { games_opened_at?: string | null; slides_url?: string | null; slides_label?: string | null }) {
  const opened = s.games_opened_at ? new Date(s.games_opened_at).getTime() : 0;
  return {
    id: s.id,
    first_name: s.first_name,
    room_token: s.room_token ?? null,
    slides_url: s.slides_url ?? null,
    slides_label: s.slides_label ?? null,
    games_open: Boolean(s.games_open) && Date.now() - opened < GAMES_AUTO_CLOSE_MIN * 60_000,
  };
}
