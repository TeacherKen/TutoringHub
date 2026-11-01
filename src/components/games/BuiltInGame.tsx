"use client";
import type { GameId } from "@/lib/games";
import { QuickMaths } from "./QuickMaths";
import { TimesTables } from "./TimesTables";
import { MiniSudoku } from "./MiniSudoku";
import { PizzaFractions } from "./PizzaFractions";
import { FractionFaceoff } from "./FractionFaceoff";
import { FractionChallenge } from "./FractionChallenge";

/** The games that are part of TutoringHub itself, by id (the student room and the games corner both use this). */
export function BuiltInGame({ id }: { id: GameId }) {
  switch (id) {
    case "qm":
      return <QuickMaths />;
    case "tt":
      return <TimesTables />;
    case "sd":
      return <MiniSudoku />;
    case "fp":
      return <PizzaFractions />;
    case "ff":
      return <FractionFaceoff />;
    case "fc":
      return <FractionChallenge />;
    default:
      return null;
  }
}
