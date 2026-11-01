/** Shown the moment a page is tapped, while it loads (so a tap never looks like nothing happened). */
export default function Loading() {
  return (
    <div className="space-y-4" role="status" aria-label="Loading">
      <div className="h-8 w-48 animate-pulse rounded-lg bg-surface-2" />
      <div className="card space-y-3">
        <div className="h-5 w-2/3 animate-pulse rounded bg-surface-2" />
        <div className="h-4 w-full animate-pulse rounded bg-surface-2" />
        <div className="h-4 w-5/6 animate-pulse rounded bg-surface-2" />
      </div>
      <div className="card space-y-3">
        <div className="h-5 w-1/2 animate-pulse rounded bg-surface-2" />
        <div className="h-4 w-full animate-pulse rounded bg-surface-2" />
        <div className="h-4 w-3/4 animate-pulse rounded bg-surface-2" />
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}
