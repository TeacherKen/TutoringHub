// Topic progress: what a student has got, is learning, and is coming up.
// Topics tagged on lesson notes count as "learning" automatically, until Mr Ken marks them.

export const TOPIC_STATUSES = ["next", "learning", "got_it"] as const;
export type TopicStatus = (typeof TOPIC_STATUSES)[number];
export const STATUS_LABEL: Record<TopicStatus, string> = { next: "Coming up", learning: "Learning", got_it: "Got it" };

export type SavedTopic = { name: string; status: TopicStatus; updated_at: string };
export type LessonTopics = { start_at: string; topics: string[] | null };
export type TopicRow = { name: string; status: TopicStatus; lastLesson: string | null; lessons: number; saved: boolean };

export function cleanTopic(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 40);
}

export function mergeProgress(saved: SavedTopic[], lessons: LessonTopics[]): TopicRow[] {
  const seen = new Map<string, { last: string; count: number }>();
  for (const l of lessons) {
    for (const raw of l.topics ?? []) {
      const t = cleanTopic(raw);
      if (!t) continue;
      const s = seen.get(t);
      if (!s) seen.set(t, { last: l.start_at, count: 1 });
      else {
        s.count += 1;
        if (l.start_at > s.last) s.last = l.start_at;
      }
    }
  }
  const rows = new Map<string, TopicRow>();
  for (const s of saved) {
    const name = cleanTopic(s.name);
    const used = seen.get(name);
    // "Coming up" moves to "Learning" once a lesson after it was planned covers it.
    const status: TopicStatus = s.status === "next" && used && used.last > s.updated_at ? "learning" : s.status;
    rows.set(name, { name, status, lastLesson: used?.last ?? null, lessons: used?.count ?? 0, saved: true });
  }
  for (const [name, used] of seen) {
    if (!rows.has(name)) rows.set(name, { name, status: "learning", lastLesson: used.last, lessons: used.count, saved: false });
  }
  return [...rows.values()].sort((a, b) => (b.lastLesson ?? "").localeCompare(a.lastLesson ?? "") || a.name.localeCompare(b.name));
}

/** One line for the parent-message prompt, e.g. "got it: fractions; still practising: long division". */
export function progressLine(rows: TopicRow[]): string | null {
  const got = rows.filter((r) => r.status === "got_it").map((r) => r.name);
  const learning = rows.filter((r) => r.status === "learning").map((r) => r.name);
  const parts = [got.length ? `got it: ${got.slice(0, 8).join(", ")}` : "", learning.length ? `still practising: ${learning.slice(0, 8).join(", ")}` : ""].filter(Boolean);
  return parts.length ? parts.join("; ") : null;
}
