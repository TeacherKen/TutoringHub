import { notFound } from "next/navigation";
import { gameById } from "@/lib/games";
import { ArcadeGame } from "@/components/games/Arcade";
import { QuickMaths } from "@/components/games/QuickMaths";
import { TimesTables } from "@/components/games/TimesTables";
import { MiniSudoku } from "@/components/games/MiniSudoku";

export default async function ArcadeGamePage({ params }: PageProps<"/arcade/[game]">) {
  const { game } = await params;
  const g = gameById(game);
  if (!g || g.id === "football") notFound();
  return <ArcadeGame id={g.id}>{g.id === "qm" ? <QuickMaths /> : g.id === "tt" ? <TimesTables /> : g.id === "sd" ? <MiniSudoku /> : null}</ArcadeGame>;
}
