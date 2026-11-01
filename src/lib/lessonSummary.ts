import "server-only";
import { createClient } from "@/lib/supabase/server";
import { MATERIALS_BUCKET } from "@/lib/constants";
import { buildFeedbackPrompt, firstNameOnly } from "@/lib/feedbackPrompt";
import { questionWithAnswer, type GameMode } from "@/lib/facts";
import { getSettings } from "@/lib/data";
import { tutorName } from "@/lib/env";
import { bkkDateKey, fmtLongDay } from "@/lib/time";
import { callClaude, hiderForEveryone, parseJson } from "@/lib/aiCall";
import { MODELS } from "@/lib/aiCost";
import { NAMES_NOTE, showAll } from "@/lib/hideNames";

// ✨ AI lesson summary. After a lesson, Claude looks at pictures of the work (the smart-slide
// pages with everything written on them, and photos of paper worksheets), plus Mr Ken's notes
// and any times tables played, and writes:
//   Part 1 — the message to the parent (in Mr Ken's usual style), and lesson notes;
//   Part 2 — a prompt Mr Ken pastes into ChatGPT / Claude / Gemini to make the next worksheet.
// No names go to the AI: they're swapped for {child1}/{parent1} and put back afterwards.
// Pictures are sent only if Mr Ken has switched them on in Settings, as short-lived private links.

const MODEL = () => process.env.ANTHROPIC_SUMMARY_MODEL?.trim() || MODELS.careful;
const MAX_PICTURES = 12;

export type LessonSummary = {
  what_we_did: string; // for Mr Ken, 2–4 sentences
  went_well: string[];
  mistakes: { question: string; what_happened: string; why: string }[];
  topics: string[];
  how_it_went: "great" | "good" | "needs_practice";
  homework: string;
  next_time: string;
  parent_message: string;
  worksheet_prompt: string;
  pictures_read: number;
};

/** Lesson window: from a little before the start to a little after the end. */
export function lessonWindow(startIso: string, endIso: string) {
  return { from: new Date(Date.parse(startIso) - 20 * 60_000).toISOString(), to: new Date(Date.parse(endIso) + 45 * 60_000).toISOString() };
}

/** The shape of the AI's answer (structured output: Claude must fill in exactly this). */
const SUMMARY_SCHEMA = {
    type: "object",
    additionalProperties: false,
    properties: {
      what_we_did: { type: "string", description: "For the tutor: 2-4 plain sentences on what was covered and how the student did, based on what you can see." },
      went_well: { type: "array", items: { type: "string" }, description: "Specific things the student did well (max 4)." },
      mistakes: {
        type: "array",
        description: "Specific mistakes or places the student got stuck that you can see in the work or that the notes describe (max 6). Empty if none.",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            question: { type: "string", description: "The question as written, e.g. '3/4 of 24' or 'Q5 bar model'." },
            what_happened: { type: "string", description: "What the student wrote or did." },
            why: { type: "string", description: "The likely reason (the misconception), in plain words." },
          },
          required: ["question", "what_happened", "why"],
        },
      },
      topics: { type: "array", items: { type: "string" }, description: "1-4 short topic names in lower case, e.g. 'fractions of a set', 'bar models'." },
      how_it_went: { type: "string", enum: ["great", "good", "needs_practice"] },
      homework: { type: "string", description: "Homework if the tutor's notes give any; otherwise a short suggestion or empty string." },
      next_time: { type: "string", description: "What to teach or practise next lesson, specific (1-2 sentences)." },
      parent_message: { type: "string", description: "The message to the parent, following the parent message instructions exactly." },
      worksheet_prompt: { type: "string", description: "A complete prompt the tutor can paste into ChatGPT, Claude or Gemini to create the next worksheet as a PDF, following the worksheet prompt instructions." },
    },
    required: ["what_we_did", "went_well", "mistakes", "topics", "how_it_went", "homework", "next_time", "parent_message", "worksheet_prompt"],
} as const;

const SYSTEM = `You are the teaching assistant of a private maths tutor (Singapore Maths, primary level) in Bangkok.
After each lesson you look at pictures of the lesson's work and report what happened.

What the pictures are:
- Pages of the PDF worksheet or slides used in an online lesson, with everything the tutor and the student wrote on top (pen, highlighter, lines, boxes, typed text). The student's writing and the tutor's writing may be in different colours; the tutor often marks, models or corrects.
- Photos of printed worksheets the student did on paper.

How to work:
- Read each question and the student's answer. Work out which answers are right and which are wrong, and why.
- Only report what you can actually see or what the tutor's notes say. Never invent questions, scores or behaviour. If handwriting is unclear, say so briefly instead of guessing.
- If there are no pictures, work from the tutor's notes and the times tables results only.
- Never mention surnames, schools or contact details.
- Plain, simple English. Specific maths, not vague praise.

${NAMES_NOTE}`;

function worksheetInstructions(name: string, level: string | null) {
  return `Worksheet prompt instructions (for the worksheet_prompt field):
Write one complete prompt, addressed to an AI tool, that creates the NEXT worksheet for ${name}${level ? ` (${level})` : ""}. The prompt must:
- Say it is for a private Singapore Maths lesson, the student's level, and the exact topic.
- List the specific mistakes from today (with an example of each) and ask for questions that practise exactly those, from easy to harder.
- Ask for this structure: a short warm-up (3 questions they can already do), one worked example, 8-10 practice questions on the weak spots, 2 word problems in real-life contexts, 1 challenge question.
- Ask for an A4 portrait, print-ready PDF of 2 pages at most, with big clear numbers, plenty of space for working under each question, a name/date line at the top, and a separate answer key page at the end.
- Ask for a calm, clean, minimal design: black text, at most one accent colour, no cartoons or clip art, nothing that looks childish or AI-generated. If a picture or diagram is needed (e.g. a bar model, a clock, a number line), draw it simply and clearly.
- Refer to the student by the placeholder only.
Write the prompt so it can be pasted as it is. Do not add anything before or after it.`;
}

type Picture = { url: string; label: string };

/** Everything the AI is told about a lesson. Pictures only when `withPictures` (the Settings switch). */
export async function gatherLesson(lessonId: string, withPictures: boolean) {
  const supabase = await createClient();
  const { data: lesson } = await supabase
    .from("lessons")
    .select("id, start_at, end_at, learned, next_time, homework, how_it_went, topics, lesson_students(student_id, students(id, first_name, level, parent_name, tt_tables))")
    .eq("id", lessonId)
    .maybeSingle();
  if (!lesson) return null;
  type Kid = { id: string; first_name: string; level: string | null; parent_name: string | null };
  const kids = ((lesson.lesson_students ?? []) as unknown as { students: Kid | null }[]).map((r) => r.students).filter((k): k is Kid => !!k);
  const win = lessonWindow(lesson.start_at as string, lesson.end_at as string);

  // Pictures of the work saved with this lesson (slide pages and worksheet photos), newest first.
  const { data: mats } = await supabase
    .from("lesson_materials")
    .select("storage_path, label, created_at")
    .eq("lesson_id", lessonId)
    .eq("kind", "photo")
    .not("storage_path", "is", null)
    .order("created_at", { ascending: false })
    .limit(MAX_PICTURES);
  const rows = withPictures ? ((mats ?? []) as { storage_path: string; label: string | null }[]) : [];
  let pictures: Picture[] = [];
  if (rows.length) {
    const { data: urls } = await supabase.storage.from(MATERIALS_BUCKET).createSignedUrls(
      rows.map((r) => r.storage_path),
      30 * 60,
    );
    pictures = rows.map((r, i) => ({ url: urls?.[i]?.signedUrl ?? "", label: r.label ?? "Work" })).filter((p) => p.url && !/\.(heic|heif)$/i.test(p.url.split("?")[0]));
    pictures.reverse(); // oldest first reads like the lesson
  }

  // Times tables played during the lesson.
  const ids = kids.map((k) => k.id);
  let tables = "";
  if (ids.length) {
    const { data: rounds } = await supabase.from("practice_sessions").select("student_id, game, score, total, tables, created_at").in("student_id", ids).gte("created_at", win.from).lte("created_at", win.to);
    const { data: weak } = await supabase.from("fact_progress").select("student_id, fact, box, last_seen").in("student_id", ids).eq("box", 1).gte("last_seen", win.from).lte("last_seen", win.to);
    const nameOf = new Map(kids.map((k) => [k.id, firstNameOnly(k.first_name)]));
    const lines = ((rounds ?? []) as { student_id: string; game: string; score: number; total: number; tables: number[] }[]).map((r) => {
      const mode = (r.game?.startsWith("tt-") ? r.game.slice(3) : r.game === "match" ? "match" : "times") as GameMode | "match";
      return `${nameOf.get(r.student_id)}: ${mode === "match" ? "head-to-head match" : `${mode} round`} on ${r.tables?.map((t) => `${t}×`).join(" ") || "times tables"}, ${r.score} out of ${r.total}`;
    });
    const missed = ((weak ?? []) as { student_id: string; fact: string }[]).map((w) => `${nameOf.get(w.student_id)} still needs ${questionWithAnswer({ fact: w.fact, kind: "times" })}`);
    if (lines.length || missed.length) tables = [...lines, ...missed.slice(0, 12)].join("\n");
  }

  return { lesson, kids, pictures, tables };
}

export async function summariseLesson(lessonId: string): Promise<{ summary?: LessonSummary; error?: string }> {
  const settings = await getSettings();
  const withPictures = settings.ai_pictures === true;
  const got = await gatherLesson(lessonId, withPictures);
  if (!got) return { error: "Lesson not found." };
  const { lesson, kids, pictures, tables } = got;
  const typed = [lesson.learned, lesson.next_time, lesson.homework].some((v) => (v as string | null)?.trim());
  if (!pictures.length && !tables && !typed) {
    return {
      error: withPictures
        ? "There's nothing to read yet. Write on the smart slides in the lesson, add worksheet photos, or type a few notes first."
        : "There's nothing to read yet. Type a few lesson notes first (the AI isn't reading pictures — that's switched off in Settings).",
    };
  }

  const names = kids.map((k) => firstNameOnly(k.first_name));
  const first = kids[0];
  const parentPrompt = buildFeedbackPrompt({
    studentNames: names,
    parentName: first?.parent_name ?? null,
    level: first?.level ?? null,
    date: fmtLongDay(bkkDateKey(lesson.start_at as string)),
    learned: (lesson.learned as string | null) ?? null,
    nextTime: (lesson.next_time as string | null) ?? null,
    homework: (lesson.homework as string | null) ?? null,
    howItWent: (lesson.how_it_went as "great" | "good" | "needs_practice" | null) ?? null,
    topics: (lesson.topics as string[] | null) ?? [],
    tutorName: tutorName(),
    tone: settings.tone,
    allowEmoji: settings.allow_emoji,
    template: settings.prompt_template,
  });

  const intro = [
    `Lesson on ${fmtLongDay(bkkDateKey(lesson.start_at as string))} with ${names.join(" and ") || "the student"}${first?.level ? ` (${first.level})` : ""}.`,
    pictures.length ? `There are ${pictures.length} pictures of today's work below, in order.` : "There are no pictures of the work for this lesson; use the notes and times tables only.",
    tables ? `Times tables played in the lesson:\n${tables}` : "",
    `Tutor's notes so far: learned: ${(lesson.learned as string) || "(none)"}; next time: ${(lesson.next_time as string) || "(none)"}; homework: ${(lesson.homework as string) || "(none)"}.`,
  ]
    .filter(Boolean)
    .join("\n\n");

  // Names never leave the app: every bit of text is passed through the name hider.
  const hider = await hiderForEveryone();
  type Block = { type: "text"; text: string } | { type: "image"; source: { type: "url"; url: string } };
  const content: Block[] = [{ type: "text", text: hider.hide(intro) }];
  pictures.forEach((p, i) => {
    content.push({ type: "text", text: hider.hide(`Picture ${i + 1}: ${p.label}`) });
    content.push({ type: "image", source: { type: "url", url: p.url } });
  });
  content.push({
    type: "text",
    text: hider.hide(
      `Parent message instructions (for the parent_message field). Use what you can see in today's pictures as facts about today's lesson, together with the notes:\n\n${parentPrompt}\n\n${worksheetInstructions(names[0] ?? "the student", first?.level ?? null)}`,
    ),
  });

  const r = await callClaude({
    feature: "lesson_summary",
    model: MODEL(),
    max_tokens: 10_000, // room for thinking plus the answer
    system: SYSTEM,
    output_config: { effort: "medium", format: { type: "json_schema", schema: SUMMARY_SCHEMA } },
    messages: [{ role: "user", content }],
    timeoutMs: 120_000,
  });
  if (!r.reply) return { error: r.error };
  if (r.reply.stop === "max_tokens") return { error: "AI ran out of room before finishing. Try again (fewer pictures helps)." };
  const s = cleanSummary(showAll(parseJson(r.reply), hider));
  if (!s) return { error: "AI didn't return a summary. Try again." };
  s.pictures_read = pictures.length;
  return { summary: s };
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** Check what the AI sent back before showing or saving it. */
export function cleanSummary(raw: unknown): LessonSummary | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const parent = str(r.parent_message, 4000);
  const prompt = str(r.worksheet_prompt, 6000);
  if (!parent || !prompt) return null;
  const list = (v: unknown, n: number) => (Array.isArray(v) ? v.map((x) => str(x, 300)).filter(Boolean).slice(0, n) : []);
  return {
    what_we_did: str(r.what_we_did, 1500),
    went_well: list(r.went_well, 4),
    mistakes: Array.isArray(r.mistakes)
      ? r.mistakes
          .slice(0, 6)
          .map((m) => (m ?? {}) as Record<string, unknown>)
          .map((m) => ({ question: str(m.question, 200), what_happened: str(m.what_happened, 300), why: str(m.why, 300) }))
          .filter((m) => m.question || m.what_happened)
      : [],
    topics: list(r.topics, 4).map((t) => t.toLowerCase()),
    how_it_went: r.how_it_went === "great" || r.how_it_went === "needs_practice" ? r.how_it_went : "good",
    homework: str(r.homework, 500),
    next_time: str(r.next_time, 500),
    parent_message: parent,
    worksheet_prompt: prompt,
    pictures_read: 0,
  };
}
