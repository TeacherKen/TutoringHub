// 📝 Worksheets made by the AI. The AI writes only the content (questions and answers);
// TutoringHub lays it out as a calm A4 page to print or save as PDF, with the answers on the last page.

export type WsQuestion = { q: string; answer: string; lines: number };
export type Worksheet = {
  title: string;
  level: string;
  intro: string;
  tip: string;
  warm_up: WsQuestion[];
  example: { q: string; steps: string[]; answer: string };
  practice: WsQuestion[];
  word_problems: WsQuestion[];
  challenge: WsQuestion;
};

const Q = {
  type: "object",
  additionalProperties: false,
  properties: {
    q: { type: "string", description: "The question, in plain text. Use × ÷ − and fractions like 3/4 or 1 2/3." },
    answer: { type: "string", description: "The correct final answer, short, e.g. '18', '3/4', '2 h 15 min'. Double-check it." },
    lines: { type: "integer", description: "Lines of space for working: 1 for a quick fact, 3-6 for multi-step work." },
  },
  required: ["q", "answer", "lines"],
} as const;

/** The shape the AI must fill in (structured output). */
export const WORKSHEET_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string", description: "Short title naming the topic, e.g. 'Fractions of a set'. No names." },
    level: { type: "string", description: "The student's level, e.g. 'P4', as given in the brief." },
    intro: { type: "string", description: "One short, calm sentence to the student about what this sheet practises." },
    tip: { type: "string", description: "One short reminder of the key method, e.g. 'To find 3/4 of 24: divide by 4, then times 3.'" },
    warm_up: { type: "array", items: Q, description: "Exactly 3 easy questions they can already do." },
    example: {
      type: "object",
      additionalProperties: false,
      properties: {
        q: { type: "string" },
        steps: { type: "array", items: { type: "string" }, description: "2-5 short worked steps." },
        answer: { type: "string" },
      },
      required: ["q", "steps", "answer"],
    },
    practice: { type: "array", items: Q, description: "8-10 questions on the weak spots, from easy to harder." },
    word_problems: { type: "array", items: Q, description: "Exactly 2 word problems in real-life settings (Bangkok, school, shopping, sport)." },
    challenge: Q,
  },
  required: ["title", "level", "intro", "tip", "warm_up", "example", "practice", "word_problems", "challenge"],
} as const;

const str = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");

function cleanQ(raw: unknown): WsQuestion | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const q = str(r.q, 600);
  const answer = str(r.answer, 120);
  if (!q || !answer) return null;
  const lines = Number(r.lines);
  return { q, answer, lines: Number.isFinite(lines) ? Math.min(8, Math.max(1, Math.round(lines))) : 3 };
}
const cleanList = (v: unknown, max: number) => (Array.isArray(v) ? v.map(cleanQ).filter((q): q is WsQuestion => !!q).slice(0, max) : []);

/** Check what the AI sent back before saving or printing it. */
export function cleanWorksheet(raw: unknown): Worksheet | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const ex = (r.example ?? {}) as Record<string, unknown>;
  const practice = cleanList(r.practice, 12);
  const title = str(r.title, 80);
  if (!title || practice.length < 3) return null;
  const challenge = cleanQ(r.challenge);
  return {
    title,
    level: str(r.level, 20),
    intro: str(r.intro, 240),
    tip: str(r.tip, 240),
    warm_up: cleanList(r.warm_up, 5),
    example: {
      q: str(ex.q, 600),
      steps: Array.isArray(ex.steps) ? ex.steps.map((s) => str(s, 240)).filter(Boolean).slice(0, 6) : [],
      answer: str(ex.answer, 120),
    },
    practice,
    word_problems: cleanList(r.word_problems, 4),
    challenge: challenge ?? { q: "", answer: "", lines: 1 },
  };
}

/** Every question in order with its number, for the page and the answer key. */
export function numbered(w: Worksheet): { section: string; n: number; item: WsQuestion }[] {
  const out: { section: string; n: number; item: WsQuestion }[] = [];
  let n = 0;
  for (const [section, list] of [
    ["Warm-up", w.warm_up],
    ["Practice", w.practice],
    ["Word problems", w.word_problems],
    ["Challenge", w.challenge.q ? [w.challenge] : []],
  ] as const) {
    for (const item of list) out.push({ section, n: ++n, item });
  }
  return out;
}
