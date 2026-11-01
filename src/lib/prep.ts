// ✅ "Before class": for each lesson still to come today, what's ready and what's missing —
// last lesson's plan, the slides or worksheet, practice at home, and hours left.
// This file only works things out; prepData.ts fetches what it needs.

import { boardExpired } from "@/lib/boardShared";

export type PrepLesson = { id: string; start_at: string; mode: "onsite" | "online" | null; studentIds: string[] };
export type PrepInput = {
  lessons: PrepLesson[];
  students: { id: string; first_name: string; board_id?: string | null; slides_url?: string | null; slides_label?: string | null; tt_tables?: number[] | null }[];
  boards: { id: string; title: string; created_at: string }[];
  /** Earlier lessons of these students (any order). */
  history: { student_id: string; id: string; start_at: string; end_at: string; status: string; next_time: string | null; homework: string | null }[];
  sheets: { id: string; title: string; student_id: string | null; created_at: string }[];
  rounds: { student_id: string; score: number; total: number; created_at: string }[];
  accounts: { studentIds: string[]; leftHours: number; low: boolean }[];
  now?: number;
};

export type PrepStudent = {
  id: string;
  name: string;
  /** Last lesson's plan for today (null: this is the first lesson in the app). */
  last: { lessonId: string; date: string; nextTime: string | null; homework: string | null } | null;
  /** Online lessons only: what's in the student's room. */
  slides: { kind: "board" | "canva" | "none"; title?: string } | null;
  /** A worksheet made since the last lesson (print it for onsite, or it's ready to use online). */
  sheet: { id: string; title: string } | null;
  /** Football practice since the last lesson (null: this student doesn't do times tables). */
  practice: { rounds: number; best: string | null } | null;
  hours: { left: number; low: boolean } | null;
};

const SKIP = new Set(["cancelled", "cancelled_charged"]);

export function buildPrep(input: PrepInput): Map<string, PrepStudent[]> {
  const now = input.now ?? Date.now();
  const out = new Map<string, PrepStudent[]>();
  for (const lesson of input.lessons) {
    const start = Date.parse(lesson.start_at);
    out.set(
      lesson.id,
      lesson.studentIds.map((sid) => {
        const s = input.students.find((x) => x.id === sid);
        const name = (s?.first_name ?? "Student").split(" ")[0];
        // The student's most recent earlier lesson that happened.
        const prev = input.history
          .filter((h) => h.student_id === sid && h.id !== lesson.id && Date.parse(h.start_at) < start && !SKIP.has(h.status))
          .sort((a, b) => Date.parse(b.start_at) - Date.parse(a.start_at))[0];
        const sinceTime = prev ? Date.parse(prev.start_at) : now - 14 * 86_400_000;
        const sinceEnd = prev ? Date.parse(prev.end_at) : now - 7 * 86_400_000;

        let slides: PrepStudent["slides"] = null;
        if (lesson.mode === "online") {
          const board = s?.board_id ? input.boards.find((b) => b.id === s.board_id) : undefined;
          if (board && !boardExpired(board.created_at, now)) slides = { kind: "board", title: board.title };
          else if (s?.slides_url) slides = { kind: "canva", title: s.slides_label || "Canva slides" };
          else slides = { kind: "none" };
        }

        const sheet = input.sheets
          .filter((w) => w.student_id === sid && Date.parse(w.created_at) >= sinceTime)
          .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))[0];

        const mine = input.rounds.filter((r) => r.student_id === sid);
        const doesTables = (s?.tt_tables?.length ?? 0) > 0 || mine.length > 0;
        const since = mine.filter((r) => Date.parse(r.created_at) > sinceEnd && Date.parse(r.created_at) < start);
        const best = since.length ? since.reduce((b, r) => (r.score / Math.max(1, r.total) > b.score / Math.max(1, b.total) ? r : b)) : null;

        const account = input.accounts.find((a) => a.studentIds.includes(sid));
        return {
          id: sid,
          name,
          last: prev ? { lessonId: prev.id, date: prev.start_at, nextTime: prev.next_time?.trim() || null, homework: prev.homework?.trim() || null } : null,
          slides,
          sheet: sheet ? { id: sheet.id, title: sheet.title } : null,
          practice: doesTables ? { rounds: since.length, best: best ? `${best.score}/${best.total}` : null } : null,
          hours: account ? { left: account.leftHours, low: account.low } : null,
        };
      }),
    );
  }
  return out;
}
