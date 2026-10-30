// Builds the prompt for a monthly progress report to a parent, from that month's lesson notes.
import { TONES, firstNameOnly, type Tone } from "@/lib/feedbackPrompt";

export type ReportLesson = { date: string; learned: string | null; topics: string[]; how: string | null; homework: string | null };
export type ReportMonth = { key: string; label: string; lessons: ReportLesson[] };

const HOW: Record<string, string> = { great: "great", good: "good", needs_practice: "needs more practice" };

/** Group lessons that have notes by month (newest month first). `key` is like "2026-10". */
export function groupByMonth(lessons: (ReportLesson & { month: string; monthLabel: string })[], limit = 6): ReportMonth[] {
  const months = new Map<string, ReportMonth>();
  for (const l of lessons) {
    if (!l.learned?.trim() && !l.topics.length) continue;
    const m = months.get(l.month) ?? { key: l.month, label: l.monthLabel, lessons: [] };
    m.lessons.push({ date: l.date, learned: l.learned, topics: l.topics, how: l.how, homework: l.homework });
    months.set(l.month, m);
  }
  return [...months.values()].sort((a, b) => b.key.localeCompare(a.key)).slice(0, limit);
}

export type MonthlyInput = {
  studentName: string;
  parentName: string | null;
  level: string | null;
  month: ReportMonth;
  progress: string | null;
  nextPlan: string | null;
  hoursLeft: number | null;
  tutorName: string;
  tone: Tone | string;
  allowEmoji: boolean;
};

export function buildMonthlyPrompt(i: MonthlyInput): string {
  const name = firstNameOnly(i.studentName) || "the student";
  const lessons = [...i.month.lessons]
    .reverse()
    .map((l) => {
      const parts = [l.learned?.trim() || "(no note)"];
      if (l.topics.length) parts.push(`topics: ${l.topics.join(", ")}`);
      if (l.how) parts.push(`went: ${HOW[l.how] ?? l.how}`);
      if (l.homework?.trim()) parts.push(`homework: ${l.homework.trim()}`);
      return `- ${l.date}: ${parts.join(" | ")}`;
    })
    .join("\n");
  return `You are helping a private maths tutor (Singapore Maths) write a monthly progress report to a parent.

Write the report to ${i.parentName?.trim() || "the parent"} about ${name}${i.level ? ` (${i.level})` : ""} for ${i.month.label}.
Tone: ${TONES[i.tone as Tone] ?? String(i.tone)}.
Length: 200–300 words. Plain, simple English that parents who speak English as a second language can follow.
${i.allowEmoji ? "You may use one or two friendly emojis." : "Do not use emojis."}

Structure:
1. Greeting using the parent's name.
2. A one-line overview: ${i.month.lessons.length} ${i.month.lessons.length === 1 ? "lesson" : "lessons"} this month and the main topics.
3. What ${name} learned, grouped by topic, with specific maths examples from the notes.
4. Strengths — what ${name} is now confident with.
5. What to keep practising, explained kindly and specifically.
6. The plan for next month.
7. A short friendly sign-off from ${i.tutorName.trim() || "your tutor"}.

Rules:
- Only use the facts below. Do not invent anything.
- Avoid vague phrases such as "making good progress" without saying what exactly.
- Do not include any surnames, school names or contact details.
- Output only the report, ready to send.

Lesson notes for ${i.month.label}:
${lessons}

Progress so far: ${i.progress?.trim() || "(not tracked)"}
Plan for next lesson: ${i.nextPlan?.trim() || "(not written)"}
${i.hoursLeft != null ? `Package hours left: ${Math.round(i.hoursLeft * 100) / 100} (mention this in one short line near the end)` : ""}`.trim();
}
