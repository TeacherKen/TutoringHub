// Names never go to the AI. Before sending, every student's and parent's name is swapped for a
// placeholder like {child1} or {parent1}; when the answer comes back, the real names go back in.
// So the parent still reads "Dear Ms Gloy, IQ worked hard today…", but the AI only ever saw
// "Dear {parent1}, {child1} worked hard today…".

export type People = { students: { name: string }[]; parents: { name: string }[] };

const TITLES = /^(mr|mrs|ms|miss|mdm|madam|dr|khun|aunty|auntie|uncle)\.?\s+/i;
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Every way a name might be written: the whole name, the first word, and (for parents) without "Ms". */
function spellings(name: string, parent: boolean): string[] {
  const full = name.trim().replace(/\s+/g, " ");
  if (!full) return [];
  const out = new Set([full]);
  const first = full.split(" ")[0];
  if (!parent && first.length >= 2) out.add(first);
  if (parent) {
    // "Ms Aradhana" → also "Aradhana"; "Chloe L." → also "Chloe".
    const bare = full.replace(TITLES, "");
    if (bare && bare !== full && bare.length >= 3) out.add(bare);
    const bareFirst = bare.split(" ")[0];
    if (bareFirst.length >= 3) out.add(bareFirst);
  }
  return [...out];
}

export type Hider = {
  /** Swap names for placeholders. */
  hide: (text: string) => string;
  /** Put the real names back. */
  show: (text: string) => string;
  /** The placeholder for a name (for building prompts), e.g. "{child1}". */
  tokenFor: (name: string) => string;
};

export function makeHider(people: People): Hider {
  type Entry = { re: RegExp; token: string; len: number };
  const entries: Entry[] = [];
  const real = new Map<string, string>(); // token → name to put back
  const add = (name: string, token: string, parent: boolean) => {
    if (!real.has(token)) real.set(token, name.trim().replace(/\s+/g, " "));
    for (const s of spellings(name, parent)) {
      // Short names like "IP" or "IQ" only match in capitals, so "ip" inside normal text is safe.
      const flags = s.length <= 3 ? "g" : "gi";
      entries.push({ re: new RegExp(`(?<![\\p{L}\\p{N}_])${esc(s)}(?![\\p{L}\\p{N}_])`, flags + "u"), token, len: s.length });
    }
  };
  const seen = new Map<string, string>();
  let c = 0;
  let p = 0;
  for (const s of people.students) {
    const key = s.name.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    const token = `{child${++c}}`;
    seen.set(key, token);
    add(s.name, token, false);
  }
  for (const s of people.parents) {
    const key = s.name.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    const token = `{parent${++p}}`;
    seen.set(key, token);
    add(s.name, token, true);
  }
  // Longest first, so "Ms Aradhana" is swapped before "Aradhana".
  entries.sort((a, b) => b.len - a.len);

  return {
    hide(text) {
      let out = text;
      for (const e of entries) out = out.replace(e.re, e.token);
      return out;
    },
    show(text) {
      return text.replace(/\{\s*(child|parent)\s*(\d+)\s*\}/gi, (m, kind: string, n: string) => real.get(`{${kind.toLowerCase()}${n}}`) ?? m);
    },
    tokenFor(name) {
      return seen.get(name.trim().toLowerCase()) ?? name;
    },
  };
}

/** Put real names back into every piece of text in an AI answer (strings, lists, objects). */
export function showAll<T>(value: T, h: Hider): T {
  if (typeof value === "string") return h.show(value) as T;
  if (Array.isArray(value)) return value.map((v) => showAll(v, h)) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, showAll(v, h)])) as T;
  }
  return value;
}

/** Told to the AI with every request, so it keeps the placeholders exactly. */
export const NAMES_NOTE =
  "Privacy: every person's name has been replaced with a placeholder such as {child1} or {parent1}. Use these placeholders exactly as written, with the curly brackets, wherever you would write that person's name (e.g. \"Dear {parent1},\" or \"{child1}'s answer\"). Never guess or invent real names.";
