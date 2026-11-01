import { notFound } from "next/navigation";
import { gameById } from "@/lib/games";
import { ArcadeGame } from "@/components/games/Arcade";
import { BuiltInGame } from "@/components/games/BuiltInGame";

export default async function ArcadeGamePage({ params }: PageProps<"/arcade/[game]">) {
  const { game } = await params;
  const g = gameById(game);
  if (!g || g.id === "football") notFound();
  return (
    <ArcadeGame id={g.id}>
      <BuiltInGame id={g.id} />
    </ArcadeGame>
  );
}
