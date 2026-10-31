import { level, TABLES, UP_TO, factKey, type FactState } from "@/lib/facts";

const COLOR: Record<ReturnType<typeof level>, string> = {
  new: "bg-surface-2 text-muted",
  weak: "bg-red-200 text-red-900",
  learning: "bg-amber-200 text-amber-900",
  good: "bg-lime-200 text-lime-900",
  mastered: "bg-green-600 text-white",
};
const LABEL: Record<ReturnType<typeof level>, string> = {
  new: "Not tried yet",
  weak: "Needs practice",
  learning: "Learning",
  good: "Getting there",
  mastered: "Knows it!",
};

/** A chart of every times table fact, coloured by how well it's known. */
export function MasteryGrid({ progress, tables = [...TABLES], compact = false }: { progress: FactState[]; tables?: number[]; compact?: boolean }) {
  const byFact = new Map(progress.map((p) => [p.fact, p]));
  const mastered = (t: number) => Array.from({ length: UP_TO }, (_, i) => level(byFact.get(factKey(t, i + 1)))).filter((l) => l === "mastered").length;
  return (
    <div className="space-y-2">
      <div className="overflow-x-auto">
        <table className="w-full border-separate border-spacing-0.5 text-center text-xs tabular-nums">
          <thead>
            <tr>
              <th className="w-10" />
              {Array.from({ length: UP_TO }, (_, i) => (
                <th key={i} className="font-medium text-muted">
                  ×{i + 1}
                </th>
              ))}
              {compact ? null : <th className="w-12 font-medium text-muted">Known</th>}
            </tr>
          </thead>
          <tbody>
            {tables.map((t) => (
              <tr key={t}>
                <th className="text-right font-semibold">{t}×</th>
                {Array.from({ length: UP_TO }, (_, i) => {
                  const p = byFact.get(factKey(t, i + 1));
                  const l = level(p);
                  return (
                    <td
                      key={i}
                      className={`rounded ${compact ? "h-6" : "h-8"} ${COLOR[l]}`}
                      title={`${t} × ${i + 1} = ${t * (i + 1)} — ${LABEL[l]}${p ? ` (${p.correct} right, ${p.wrong} wrong)` : ""}`}
                    >
                      {compact ? "" : t * (i + 1)}
                    </td>
                  );
                })}
                {compact ? null : (
                  <td className="text-muted">
                    {mastered(t)}/{UP_TO}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
        {(Object.keys(LABEL) as (keyof typeof LABEL)[]).map((k) => (
          <span key={k} className="flex items-center gap-1">
            <span className={`inline-block h-3 w-3 rounded ${COLOR[k]}`} /> {LABEL[k]}
          </span>
        ))}
      </div>
    </div>
  );
}
