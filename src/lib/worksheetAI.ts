import "server-only";
import { createClient } from "@/lib/supabase/server";
import { callClaude, hiderForEveryone, parseJson } from "@/lib/aiCall";
import { MODELS } from "@/lib/aiCost";
import { NAMES_NOTE, showAll } from "@/lib/hideNames";
import { cleanWorksheet, WORKSHEET_SCHEMA } from "@/lib/worksheet";

const SYSTEM = `You write maths worksheets for a private Singapore Maths tutor (primary level) in Bangkok.
You get a brief describing the student's level, today's topic and their mistakes. Write the worksheet content only;
the app lays it out on A4 with space for working and an answer key page.

Rules:
- Every question must be clear, at the right level, and practise exactly the weak spots in the brief, from easy to harder.
- Work out every answer carefully and check it twice. A wrong answer key is the worst mistake you can make.
- Plain text maths: × ÷ − =, fractions as 3/4, mixed numbers as 1 2/3, money as $ or ฿, time as 2 h 15 min.
- No pictures. Avoid questions that need a diagram; if a bar model helps, say "Draw a bar model" and let the student draw it.
- Calm, simple English. No emoji. Real-life settings a child in Bangkok knows.

${NAMES_NOTE}`;

/** Make the next worksheet from the brief (the Part 2 prompt), save it with the lesson, and return its id. */
export async function createWorksheet(lessonId: string, brief: string): Promise<{ id?: string; error?: string }> {
  const supabase = await createClient();
  // Before spending anything: the lesson exists, and the worksheets table is there (database update 0020).
  const [{ data: lesson }, { error: noTable }] = await Promise.all([
    supabase.from("lessons").select("id, lesson_students(student_id)").eq("id", lessonId).maybeSingle(),
    supabase.from("worksheets").select("id", { head: true, count: "exact" }).limit(1),
  ]);
  if (!lesson) return { error: "Lesson not found." };
  if (noTable) return { error: "Run database update 0020 first (the SQL from Claude), then try again." };

  const hider = await hiderForEveryone();
  const r = await callClaude({
    feature: "worksheet",
    model: MODELS.careful,
    max_tokens: 12_000, // room for checking the answers plus the worksheet
    system: SYSTEM,
    output_config: { effort: "medium", format: { type: "json_schema", schema: WORKSHEET_SCHEMA } },
    messages: [{ role: "user", content: hider.hide(`Here is the brief for the next worksheet:\n\n${brief}`) }],
    timeoutMs: 120_000,
  });
  if (!r.reply) return { error: r.error };
  if (r.reply.stop === "max_tokens") return { error: "AI ran out of room before finishing. Try again." };
  const ws = cleanWorksheet(showAll(parseJson(r.reply), hider));
  if (!ws) return { error: "AI didn't return a worksheet. Try again." };

  const firstStudent = ((lesson.lesson_students ?? []) as { student_id: string }[])[0]?.student_id ?? null;
  const { data: saved, error } = await supabase
    .from("worksheets")
    .insert({ lesson_id: lessonId, student_id: firstStudent, title: ws.title, content: ws })
    .select("id")
    .single();
  if (error || !saved) return { error: "The worksheet was made but couldn't be saved. Try again." };
  return { id: saved.id as string };
}
