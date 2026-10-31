import type { Metadata } from "next";
import { getMatch } from "@/lib/match";
import { Match } from "@/components/games/Match";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Times tables match",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function MatchPage({ params }: PageProps<"/match/[token]">) {
  const { token } = await params;
  const state = await getMatch(token);
  if (!state) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4 text-center">
        <h1 className="h1">This match link doesn&apos;t work</h1>
        <p className="mt-2 text-muted">Ask Mr Ken to start a new match.</p>
      </main>
    );
  }
  return (
    <main className="mx-auto min-h-dvh max-w-6xl px-3 py-3 sm:px-4 sm:py-4">
      <Match key={token} token={token} initial={state} />
    </main>
  );
}
