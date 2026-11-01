"use client";
import Link from "next/link";
import { useEffect } from "react";

/** Shown when a page fails to load (e.g. the database didn't answer). Grown-up and child versions. */
export function ErrorScreen({ error, retry, kid = false, home = true }: { error: unknown; retry: () => void; kid?: boolean; home?: boolean }) {
  useEffect(() => console.error(error), [error]);
  const code = error instanceof Error && "digest" in error ? String((error as Error & { digest?: string }).digest ?? "") : "";

  if (kid)
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-[#0b1d42] px-6 text-center text-white">
        <p className="text-6xl" aria-hidden>
          ⚽
        </p>
        <h1 className="text-3xl font-bold">Oops! The game didn&apos;t load.</h1>
        <p className="max-w-sm text-lg text-white/80">Tap the button to try again. If it still doesn&apos;t work, tell Mr&nbsp;Ken.</p>
        <button type="button" onClick={retry} className="min-h-14 rounded-2xl bg-[#ffc629] px-8 text-xl font-bold text-[#0b1d42] active:scale-95">
          Try again
        </button>
      </main>
    );

  return (
    <div className="card mx-auto mt-6 max-w-md space-y-3">
      <h1 className="h2">Something went wrong</h1>
      <p className="text-muted">This page didn&apos;t load. It&apos;s usually a short internet or database hiccup, and nothing saved was lost.</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-primary" onClick={retry}>
          Try again
        </button>
        {home ? (
          <Link href="/" className="btn-secondary">
            Go home
          </Link>
        ) : null}
      </div>
      {code ? <p className="text-xs text-muted">Error code {code}</p> : null}
    </div>
  );
}
