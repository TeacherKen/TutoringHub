// ✅ Is each coming lesson ready? Online lessons are ready by themselves when new smart slides were
// uploaded after the child's previous lesson (like Yina's "Times Tables of 3 and 4"). Onsite lessons use
// printed worksheets, so Mr Ken ticks them himself; he can tick any lesson by hand too.
// This file only works things out; readyData.ts fetches what it needs.

import { boardExpired } from "@/lib/boardShared";

export type ReadyLesson = { id: string; start_at: string; mode: "onsite" | "online" | null; studentIds: string[]; ready_at?: string | null };
export type ReadyInput = {
  lessons: ReadyLesson[];
  students: { id: string; first_name: string; board_id?: string | null; slides_url?: string | null }[];
  /** The boards the students are using now. */
  boards: { id: string; title: string; created_at: string }[];
  /** Other lessons of these students (past and coming), to find each lesson's previous one. */
  history: { student_id: string; id: string; start_at: string; end_at: string; status: string }[];
  /** Worksheets made in TutoringHub (a hint for onsite lessons: "print it"). */
  sheets: { title: string; student_id: string | null; created_at: string }[];
};

export type Ready =
  | { ready: true; how: "slides" | "ticked"; text: string }
  | { ready: false; need: "slides" | "worksheet"; text: string; hint?: string };

const SKIP = new Set(["cancelled", "cancelled_charged"]);
const day = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Bangkok", weekday: "short", day: "numeric", month: "short" }).format(new Date(iso));

export function buildReady(input: ReadyInput): Map<string, Ready> {
  const out = new Map<string, Ready>();
  for (const l of input.lessons) {
    const start = Date.parse(l.start_at);
    const first = (sid: string) => input.students.find((s) => s.id === sid)?.first_name.split(" ")[0] ?? "Student";
    // The child's lesson just before this one (it may itself still be to come).
    const prevOf = (sid: string) =>
      input.history
        .filter((h) => h.student_id === sid && h.id !== l.id && !SKIP.has(h.status) && Date.parse(h.start_at) < start)
        .sort((a, b) => Date.parse(b.start_at) - Date.parse(a.start_at))[0];

    if (l.ready_at) {
      out.set(l.id, { ready: true, how: "ticked", text: "Ready" });
      continue;
    }

    if (l.mode === "online") {
      // Every child in it needs slides uploaded after their previous lesson ended.
      const problems: string[] = [];
      let title = "";
      for (const sid of l.studentIds) {
        const s = input.students.find((x) => x.id === sid);
        const board = s?.board_id ? input.boards.find((b) => b.id === s.board_id) : undefined;
        const prev = prevOf(sid);
        const who = l.studentIds.length > 1 ? `${first(sid)}: ` : "";
        if (!board) problems.push(`${who}${s?.slides_url ? "Canva link only, tick when it's updated" : "No slides uploaded"}`);
        else if (boardExpired(board.created_at, start)) problems.push(`${who}Slides expire before this lesson`);
        else if (prev && Date.parse(board.created_at) < Date.parse(prev.end_at)) problems.push(`${who}Slides not updated since ${day(prev.start_at)}`);
        else title = board.title;
      }
      out.set(l.id, problems.length ? { ready: false, need: "slides", text: problems.join(" · ") } : { ready: true, how: "slides", text: `Slides ready${title && l.studentIds.length === 1 ? ` · ${title}` : ""}` });
      continue;
    }

    // Onsite (or not known): printed worksheets. A worksheet made here since the last lesson is a hint.
    const sheet = l.studentIds
      .map((sid) => {
        const prev = prevOf(sid);
        const since = prev ? Date.parse(prev.end_at) : 0;
        return input.sheets.filter((w) => w.student_id === sid && Date.parse(w.created_at) >= since).sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))[0];
      })
      .find(Boolean);
    out.set(l.id, { ready: false, need: "worksheet", text: "Worksheet to print", hint: sheet ? `Made: ${sheet.title}` : undefined });
  }
  return out;
}
