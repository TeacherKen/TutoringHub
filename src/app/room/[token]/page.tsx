import type { Metadata } from "next";
import { getRoom } from "@/lib/room";
import { studentForToken } from "@/lib/practice";
import { Room } from "@/components/Room";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/room/[token]">): Promise<Metadata> {
  const { token } = await params;
  const kid = await studentForToken(token).catch(() => null);
  return {
    title: "My lesson",
    robots: { index: false, follow: false },
    referrer: "no-referrer",
    // "Add to Home Screen" gives the child their own app icon that opens their football game.
    manifest: `/room/${token}/manifest.webmanifest`,
    appleWebApp: { capable: true, title: kid?.first_name ?? "Football", statusBarStyle: "black" },
  };
}

export default async function RoomPage({ params, searchParams }: PageProps<"/room/[token]">) {
  const { token } = await params;
  const { tab } = await searchParams;
  const room = await getRoom(token);
  if (!room) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4 text-center">
        <h1 className="h1">This link doesn&apos;t work</h1>
        <p className="mt-2 text-muted">Ask Mr Ken for a new link.</p>
      </main>
    );
  }
  return <Room token={token} initial={room} initialTab={tab === "practice" ? "practice" : undefined} />;
}
