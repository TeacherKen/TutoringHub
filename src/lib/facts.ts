// Football Times Tables: remembering each fact (like 3x7) for each student.
// A simple "box" system: every fact sits in box 1–5. Quick right answers move it up a box,
// so it comes back less often; a wrong answer sends it back to box 1, so it comes back soon.

export const TABLES = [2, 3, 4, 5, 6, 7, 8, 9, 10] as const;
export const UP_TO = 10; // each table goes 1× to 10×
export const FAST_MS = 4000; // a "quick" answer
const DAY = 86_400_000;
/** How long until a fact in each box comes back. */
export const BOX_WAIT_DAYS = [0, 0, 1, 3, 7, 14]; // index = box

export type FactState = { fact: string; box: number; correct: number; wrong: number; avg_ms: number | null; due_at: string; last_seen: string | null };
export type Answer = { fact: string; correct: boolean; ms: number };

export const factKey = (table: number, n: number) => `${table}x${n}`;
export function parseFact(fact: string): [number, number] | null {
  // One spelling per fact ("3x7", never "03x7"), and only facts the game can ask (× 1 to × 10).
  const m = /^([1-9]\d?)x([1-9]\d?)$/.exec(fact);
  if (!m) return null;
  const a = Number(m[1]);
  const b = Number(m[2]);
  return a >= 1 && a <= 12 && b >= 1 && b <= UP_TO ? [a, b] : null;
}

export function factsFor(tables: number[]): string[] {
  return tables.flatMap((t) => Array.from({ length: UP_TO }, (_, i) => factKey(t, i + 1)));
}

/**
 * The new state of a fact after one answer. A fact only moves up a box when it was due, so
 * playing many rounds in one afternoon can't make it "known really well" in a day. A wrong
 * answer always sends it back to box 1.
 */
export function updateFact(prev: FactState | undefined, a: Answer, now: Date): FactState {
  const box0 = prev?.box ?? 1;
  const due = !prev || !prev.due_at || !(Date.parse(prev.due_at) > now.getTime());
  const box = !a.correct ? 1 : a.ms <= FAST_MS && due ? Math.min(5, box0 + 1) : Math.max(1, box0);
  const moved = !a.correct || box !== box0 || due;
  const seen = (prev?.correct ?? 0) + (prev?.wrong ?? 0);
  const avg = prev?.avg_ms != null ? Math.round((prev.avg_ms * Math.min(seen, 4) + a.ms) / (Math.min(seen, 4) + 1)) : Math.round(a.ms);
  return {
    fact: a.fact,
    box,
    correct: (prev?.correct ?? 0) + (a.correct ? 1 : 0),
    wrong: (prev?.wrong ?? 0) + (a.correct ? 0 : 1),
    avg_ms: avg,
    // Practised early and right: keep the date it was already due back.
    due_at: moved || !prev ? new Date(now.getTime() + BOX_WAIT_DAYS[box] * DAY).toISOString() : prev.due_at,
    last_seen: now.toISOString(),
  };
}

/**
 * Choose the 10 kicks for a round: facts that are due (weakest first), a few new ones,
 * then some from the chosen tables at random. No fact twice in a row.
 */
export function pickRound(tables: number[], progress: FactState[], now: Date, n = 10, rand: () => number = Math.random): string[] {
  const pool = factsFor(tables);
  if (!pool.length) return [];
  const known = new Map(progress.map((p) => [p.fact, p]));
  const due = pool
    .filter((f) => known.has(f) && Date.parse(known.get(f)!.due_at) <= now.getTime())
    .sort((a, b) => known.get(a)!.box - known.get(b)!.box || Date.parse(known.get(a)!.due_at) - Date.parse(known.get(b)!.due_at));
  const fresh = shuffle(pool.filter((f) => !known.has(f)), rand);
  const picked: string[] = [];
  const add = (f: string) => {
    if (picked.length < n && !picked.includes(f)) picked.push(f);
  };
  due.slice(0, 6).forEach(add);
  fresh.slice(0, 3).forEach(add);
  due.slice(6).forEach(add);
  shuffle(pool, rand).forEach(add);
  // Small pools (one table): allow repeats, but never the same fact twice in a row.
  while (picked.length < n) picked.push(pool[Math.floor(rand() * pool.length)]);
  const out = shuffle(picked, rand);
  for (let i = 1; i < out.length; i++) {
    if (out[i] === out[i - 1]) {
      const j = out.findIndex((f, k) => k > i && f !== out[i]);
      if (j > 0) [out[i], out[j]] = [out[j], out[i]];
    }
  }
  return out;
}

function shuffle<T>(arr: T[], rand: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Check what a browser sends back after a round. */
export function cleanAnswers(raw: unknown): Answer[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(0, 40)
    .map((r) => (r ?? {}) as Record<string, unknown>)
    .filter((r) => typeof r.fact === "string" && parseFact(r.fact) !== null && typeof r.correct === "boolean")
    .map((r) => ({ fact: r.fact as string, correct: r.correct as boolean, ms: Math.max(0, Math.min(120_000, Number(r.ms) || 0)) }));
}

export function cleanTables(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.map(Number).filter((n) => Number.isInteger(n) && n >= 2 && n <= 12))].sort((a, b) => a - b).slice(0, 11);
}

/** Colour band for the mastery chart. */
export function level(p: FactState | undefined): "new" | "weak" | "learning" | "good" | "mastered" {
  if (!p) return "new";
  if (p.box <= 1) return "weak";
  if (p.box === 2) return "learning";
  if (p.box <= 4) return "good";
  return "mastered";
}

// ---- Game modes ------------------------------------------------------------------------------
// Every question is built from a times tables fact "t x n" (t = the table), so division and
// missing-number questions count towards the same chart: 24 ÷ 4 and ? × 4 = 24 both practise 4 × 6.

export const MODES = ["times", "divide", "missing", "mixed"] as const;
export type GameMode = (typeof MODES)[number];
export type QuestionKind = "times" | "divide" | "missingL" | "missingR";
export type Question = { fact: string; kind: QuestionKind };

export const MODE_NAMES: Record<GameMode, string> = { times: "Times", divide: "Divide", missing: "Missing number", mixed: "Mixed" };
export const MODE_EXAMPLES: Record<GameMode, string> = { times: "4 × 6 = ?", divide: "24 ÷ 4 = ?", missing: "? × 4 = 24", mixed: "All three" };

export const cleanMode = (m: unknown): GameMode => (MODES as readonly unknown[]).includes(m) ? (m as GameMode) : "times";

/** Which kinds of question a mode may ask. */
export function kindsFor(mode: GameMode): QuestionKind[] {
  if (mode === "divide") return ["divide"];
  if (mode === "missing") return ["missingL", "missingR"];
  if (mode === "mixed") return ["times", "divide", "missingL", "missingR"];
  return ["times"];
}

export function makeQuestion(fact: string, mode: GameMode, rand: () => number = Math.random): Question {
  const kinds = kindsFor(mode);
  return { fact, kind: kinds[Math.floor(rand() * kinds.length)] };
}

/** The number the child has to type. */
export function answerFor(q: Question): number {
  const [t, n] = parseFact(q.fact) ?? [0, 0];
  return q.kind === "times" ? t * n : n;
}

/** The question in pieces; null marks the box the child fills in. */
export function questionParts(q: Question): (string | null)[] {
  const [t, n] = parseFact(q.fact) ?? [0, 0];
  if (q.kind === "divide") return [String(t * n), "÷", String(t), "=", null];
  if (q.kind === "missingL") return [null, "×", String(t), "=", String(t * n)];
  if (q.kind === "missingR") return [String(t), "×", null, "=", String(t * n)];
  return [String(t), "×", String(n), "=", null];
}

/** The question written out with its answer, e.g. "24 ÷ 4 = 6". */
export function questionWithAnswer(q: Question): string {
  const a = String(answerFor(q));
  return questionParts(q)
    .map((p) => p ?? a)
    .join(" ");
}

export const isKind = (k: unknown): k is QuestionKind => k === "times" || k === "divide" || k === "missingL" || k === "missingR";
