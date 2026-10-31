import type { Metadata } from "next";
import { getRoom } from "@/lib/room";
import { Room } from "@/components/Room";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "My lesson",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

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
