// 🎨 One colour per family (with packages) or per student (paying per class), the same on every page:
// Week, Students and the Money charts. Order: families with packages, then per-class students, each by
// name; colours 1–7 in that order, anyone after that shares colour 8. (Colours: --series-1…8 in globals.css.)

export type ColourStudent = { id: string; first_name: string; hour_account_id: string | null; active?: boolean | null };

/** "a:<account>" for a family with packages, "s:<student>" for a student paying per class. */
export function groupKeyFor(s: ColourStudent | undefined, withPackages: Set<string>, id = s?.id ?? ""): string {
  return s?.hour_account_id && withPackages.has(s.hour_account_id) ? `a:${s.hour_account_id}` : `s:${id}`;
}

export function colourSlots(input: {
  students: ColourStudent[];
  packages: { hour_account_id: string }[];
  accountNames: Map<string, string>;
}): { slotOfGroup: (key: string) => number; slotOfStudent: (id: string) => number; order: string[]; groupOf: (id: string) => string } {
  const withPackages = new Set(input.packages.map((p) => p.hour_account_id));
  const byId = new Map(input.students.map((s) => [s.id, s]));
  const name = (k: string) => (k.startsWith("a:") ? (input.accountNames.get(k.slice(2)) ?? "") : (byId.get(k.slice(2))?.first_name ?? ""));
  const order = [...new Set(input.students.filter((s) => s.active !== false).map((s) => groupKeyFor(s, withPackages)))].sort((a, b) =>
    a[0] === b[0] ? name(a).localeCompare(name(b)) : a < b ? -1 : 1,
  );
  const slotOfGroup = (k: string) => {
    const i = order.indexOf(k);
    return i >= 0 && i < 7 ? i + 1 : 8;
  };
  const groupOf = (id: string) => groupKeyFor(byId.get(id), withPackages, id);
  return { slotOfGroup, slotOfStudent: (id) => slotOfGroup(groupOf(id)), order, groupOf };
}
