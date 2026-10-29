export type Matchable = { id: string; keywords: string[] };

function escape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** True if `keyword` appears in `title` as a whole word (any language, any case). */
export function containsWord(title: string, keyword: string): boolean {
  const k = keyword.trim();
  if (!k) return false;
  const re = new RegExp(`(^|[^\\p{L}\\p{N}])${escape(k)}($|[^\\p{L}\\p{N}])`, "iu");
  return re.test(title);
}

/** Ids of every student whose calendar keyword is in the event title. */
export function matchStudents(title: string, students: Matchable[]): string[] {
  return students.filter((s) => s.keywords.some((k) => containsWord(title, k))).map((s) => s.id);
}

export function isPreplyTitle(title: string): boolean {
  return containsWord(title, "preply");
}
