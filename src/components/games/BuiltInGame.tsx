"use client";
import type { GameId } from "@/lib/games";
import { QuickMaths } from "./QuickMaths";
import { TimesTables } from "./TimesTables";
import { MiniSudoku } from "./MiniSudoku";
import { PizzaFractions } from "./PizzaFractions";
import { FractionFaceoff } from "./FractionFaceoff";
import { FractionChallenge } from "./FractionChallenge";
import { ShapeBuilder } from "./ShapeBuilder";
import { ClockRescue } from "./ClockRescue";
import { MoneyShop } from "./MoneyShop";
import { ClockQuest } from "./ClockQuest";
import { PiggyRain } from "./PiggyRain";
import { LittleShop } from "./LittleShop";

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
    case "sb":
      return <ShapeBuilder />;
    case "ck":
      return <ClockRescue />;
    case "ms":
      return <MoneyShop />;
    case "cq":
      return <ClockQuest />;
    case "pb":
      return <PiggyRain />;
    case "ls":
      return <LittleShop />;
    default:
      return null;
  }
}
