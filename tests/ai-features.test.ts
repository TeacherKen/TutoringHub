import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanWorksheet, numbered } from "@/lib/worksheet";

// A pretend database for the lesson summary and worksheet maker.
const db: Record<string, Record<string, unknown>[]> = {};
const inserted: Record<string, unknown>[] = [];
function query(table: string) {
  const rows = () => db[table] ?? [];
  let pendingInsert: Record<string, unknown> | null = null;
  const b: Record<string, unknown> = {};
  for (const m of ["select", "eq", "neq", "in", "gte", "lte", "not", "order", "limit"]) b[m] = () => b;
  b.maybeSingle = async () => ({ data: rows()[0] ?? null, error: null });
  b.single = async () => ({ data: pendingInsert ? { id: "w1", ...pendingInsert } : (rows()[0] ?? null), error: null });
  b.insert = (row: Record<string, unknown>) => {
    pendingInsert = row;
    inserted.push({ table, ...row });
    return b;
  };
  b.then = (ok: (v: unknown) => unknown, bad: (e: unknown) => unknown) => Promise.resolve({ data: rows(), error: null }).then(ok, bad);
  return b;
}
const storage = { from: () => ({ createSignedUrls: async (paths: string[]) => ({ data: paths.map((p) => ({ signedUrl: `https://files.example/${p}?token=1` })) }) }) };
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ from: query, storage }) }));

const { summariseLesson } = await import("@/lib/lessonSummary");
const { createWorksheet } = await import("@/lib/worksheetAI");

const SUMMARY = {
  what_we_did: "{child1} practised fractions of a set.",
  went_well: ["{child1} drew neat bar models"],
  mistakes: [{ question: "3/4 of 24", what_happened: "wrote 6", why: "found one quarter but didn't multiply by 3" }],
  topics: ["Fractions of a set"],
  how_it_went: "good",
  homework: "",
  next_time: "More fractions of a set.",
  parent_message: "Dear {parent1},\n{child1} worked on fractions today.",
  worksheet_prompt: "Create a worksheet for {child1} (P4) on fractions of a set.",
};
const SHEET = {
  title: "Fractions of a set",
  level: "P4",
  intro: "Practise finding a fraction of a number.",
  tip: "Divide by the bottom, then times by the top.",
  warm_up: [{ q: "24 ÷ 4", answer: "6", lines: 1 }],
  example: { q: "Find 3/4 of 24.", steps: ["24 ÷ 4 = 6", "6 × 3 = 18"], answer: "18" },
  practice: [
    { q: "Find 2/3 of 18.", answer: "12", lines: 3 },
    { q: "Find 3/5 of 20.", answer: "12", lines: 3 },
    { q: "Find 5/6 of 30.", answer: "25", lines: 3 },
  ],
  word_problems: [{ q: "{child1} has 24 stickers and gives away 3/8 of them. How many are left?", answer: "15", lines: 5 }],
  challenge: { q: "3/4 of a number is 27. What is the number?", answer: "36", lines: 4 },
};

const reply = (obj: unknown) =>
  new Response(JSON.stringify({ content: [{ type: "text", text: JSON.stringify(obj) }], usage: { input_tokens: 5000, output_tokens: 3000 }, stop_reason: "end_turn" }), { status: 200 });

beforeEach(() => {
  process.env.ANTHROPIC_API_KEY = "k";
  db.lessons = [
    {
      id: "11111111-1111-4111-8111-111111111111",
      start_at: "2026-11-01T02:00:00Z",
      end_at: "2026-11-01T03:00:00Z",
      learned: "Fractions of a set. Jaian mixed up the steps.",
      next_time: "",
      homework: "",
      how_it_went: "good",
      topics: [],
      lesson_students: [{ student_id: "s1", students: { id: "s1", first_name: "Jaian", level: "P4", parent_name: "Ms Aradhana", tt_tables: null } }],
    },
  ];
  db.lesson_materials = [{ storage_path: "l1/a.jpg", label: "Jaian's work · Fractions · page 1" }];
  db.practice_sessions = [];
  db.fact_progress = [];
  db.settings = [{ tone: "warm", allow_emoji: false, prompt_template: null, ai_pictures: false }];
  db.students = [{ first_name: "Jaian", parent_name: "Ms Aradhana" }];
  db.app_users = [];
  db.ai_usage = [];
  db.worksheets = [];
  inserted.length = 0;
});
afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.ANTHROPIC_API_KEY;
});

describe("✨ lesson summary request", () => {
  it("asks Sonnet 5.5 for a filled-in form the way it accepts, with no names", async () => {
    const fetchMock = vi.fn(async () => reply(SUMMARY));
    vi.stubGlobal("fetch", fetchMock);
    const r = await summariseLesson("11111111-1111-4111-8111-111111111111");
    const body = JSON.parse(String((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body));
    expect(body.model).toBe("claude-sonnet-5-5");
    expect(body.tool_choice).toBeUndefined(); // Sonnet 5.5 rejects forced tool use
    expect(body.tools).toBeUndefined();
    expect(body.output_config.format.type).toBe("json_schema");
    expect(body.output_config.format.schema.additionalProperties).toBe(false);
    expect(body.max_tokens).toBeGreaterThanOrEqual(8000); // room for thinking
    const sent = JSON.stringify(body);
    expect(sent).not.toContain("Jaian");
    expect(sent).not.toContain("Aradhana");
    // names come back for Mr Ken
    expect(r.summary?.parent_message).toBe("Dear Ms Aradhana,\nJaian worked on fractions today.");
    expect(r.summary?.went_well[0]).toBe("Jaian drew neat bar models");
  });

  it("sends pictures only when the Settings switch is on", async () => {
    const fetchMock = vi.fn(async () => reply(SUMMARY));
    vi.stubGlobal("fetch", fetchMock);
    await summariseLesson("11111111-1111-4111-8111-111111111111");
    const images = (n: number) =>
      JSON.parse(String((fetchMock.mock.calls[n] as unknown as [string, RequestInit])[1].body)).messages[0].content.filter((c: { type: string }) => c.type === "image");
    expect(images(0)).toHaveLength(0);
    db.settings[0].ai_pictures = true;
    await summariseLesson("11111111-1111-4111-8111-111111111111");
    expect(images(1)).toHaveLength(1);
    // the picture's label is sent without the name
    expect(JSON.stringify(JSON.parse(String((fetchMock.mock.calls[1] as unknown as [string, RequestInit])[1].body)))).not.toContain("Jaian");
  });

  it("records the cost", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => reply(SUMMARY)));
    await summariseLesson("11111111-1111-4111-8111-111111111111");
    expect(inserted.find((r) => r.table === "ai_usage")).toMatchObject({ feature: "lesson_summary", model: "claude-sonnet-5-5", cost_usd: 0.04 });
  });
});

describe("📝 worksheet maker", () => {
  it("makes, checks and saves a worksheet, with names put back", async () => {
    const fetchMock = vi.fn(async () => reply(SHEET));
    vi.stubGlobal("fetch", fetchMock);
    const r = await createWorksheet("11111111-1111-4111-8111-111111111111", "Create a worksheet for Jaian (P4) on fractions of a set. Mistake: 3/4 of 24 → 6.");
    expect(r).toEqual({ id: "w1" });
    const body = JSON.parse(String((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body));
    expect(JSON.stringify(body)).not.toContain("Jaian");
    expect(body.output_config.format.type).toBe("json_schema");
    const saved = inserted.find((x) => x.table === "worksheets") as { content: { word_problems: { q: string }[] }; title: string };
    expect(saved.title).toBe("Fractions of a set");
    expect(saved.content.word_problems[0].q).toMatch(/^Jaian has 24 stickers/);
  });

  it("numbers the questions in order for the page and the answer key", () => {
    const ws = cleanWorksheet(SHEET)!;
    const all = numbered(ws);
    expect(all.map((x) => x.n)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(all.map((x) => x.section)).toEqual(["Warm-up", "Practice", "Practice", "Practice", "Word problems", "Challenge"]);
    expect(all.at(-1)?.item.answer).toBe("36");
  });

  it("refuses a worksheet that's missing its questions, and tidies odd values", () => {
    expect(cleanWorksheet({ ...SHEET, practice: [] })).toBeNull();
    expect(cleanWorksheet(null)).toBeNull();
    const odd = cleanWorksheet({ ...SHEET, practice: [...SHEET.practice, { q: "x", answer: "1", lines: 99 }, { q: "", answer: "2", lines: 1 }] })!;
    expect(odd.practice).toHaveLength(4);
    expect(odd.practice[3].lines).toBe(8);
  });
});

import { layoutPages, PAGE_H, worksheetBlocks } from "@/lib/worksheetSlides";
describe("📤 worksheet on the smart slides", () => {
  const ws = cleanWorksheet(SHEET)!;
  it("keeps every question, in order, with each section's heading on its first question", () => {
    const blocks = worksheetBlocks(ws);
    const qs = blocks.filter((b) => b.kind === "question");
    expect(qs.map((b) => (b.kind === "question" ? b.n : 0))).toEqual([1, 2, 3, 4, 5, 6]);
    expect(blocks.filter((b) => b.heading).map((b) => b.heading)).toEqual(["Warm-up", "Worked example", "Practice", "Word problems", "Challenge ★"]);
    expect(JSON.stringify(blocks)).not.toContain("answer key");
  });
  it("fills the left column, then the right, then a new page, never past the bottom", () => {
    const blocks = Array.from({ length: 9 }, () => worksheetBlocks(ws)[1]);
    const pages = layoutPages(blocks, () => 300, 200);
    expect(pages.flat()).toHaveLength(9);
    for (const page of pages) for (const p of page) expect(p.y + p.h).toBeLessThanOrEqual(PAGE_H);
    expect(pages[0].map((p) => p.x)).toEqual([pages[0][0].x, pages[0][1].x]); // page 1: one each side under the title
    expect(pages.length).toBeGreaterThan(2);
  });
});
