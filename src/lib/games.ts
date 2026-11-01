import type { Metadata } from "next";
// Every game in TutoringHub, in one list: the student room's Games tab and the games corner both use it.

export type GameId = "football" | "wolf-vs-sheep" | "magic-square" | "qm" | "tt" | "sd";
export type GameInfo = {
  id: GameId;
  name: string;
  blurb: string;
  players: string;
  /** Mr Ken's own games, copied into /public/games. */
  src?: string;
  /** Tile colours for the games corner. */
  bg: string;
  fg: string;
};

export const GAMES: GameInfo[] = [
  { id: "football", name: "Football Times Tables", blurb: "Every right answer is a goal", players: "1 player", bg: "#1d6b3a", fg: "#ffffff" },
  { id: "wolf-vs-sheep", name: "Wolf vs Sheep", blurb: "Trap the wolf, or catch 7 sheep", players: "2 players, or against the computer", src: "/games/wolf-vs-sheep/index.html", bg: "#c79a5a", fg: "#2b1a08" },
  { id: "magic-square", name: "Magic Square Academy", blurb: "Make every line add up the same", players: "1 player", src: "/games/magic-square/index.html", bg: "#4b3a9a", fg: "#ffffff" },
  { id: "qm", name: "Quick Maths", blurb: "10 questions, beat your time", players: "1 player", bg: "#d9622b", fg: "#ffffff" },
  { id: "tt", name: "Times Tables Sprint", blurb: "How many in 60 seconds?", players: "1 player", bg: "#0f6b62", fg: "#ffffff" },
  { id: "sd", name: "Mini Sudoku", blurb: "Fill the grid with 1 to 4, or 1 to 6", players: "1 player", bg: "#2c5aa8", fg: "#ffffff" },
];

export const gameById = (id: string) => GAMES.find((g) => g.id === id) ?? null;

/** The games corner as its own iPad home-screen app: "Games" with its own icon, opening at /arcade. */
export const ARCADE_META: Metadata = {
  title: "Games corner",
  manifest: "/arcade/manifest.webmanifest",
  icons: { apple: "/icons/games-180.png" },
  appleWebApp: { capable: true, title: "Games", statusBarStyle: "black-translucent" },
};
