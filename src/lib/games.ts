import type { Metadata } from "next";
// Every game in TutoringHub, in one list: the student room's Games tab and the games corner both use it.

export type GameId = "football" | "wolf-vs-sheep" | "magic-square" | "qm" | "tt" | "sd" | "fp" | "ff" | "fc" | "sb" | "ck" | "ms" | "cq" | "pb" | "ls" | "bp" | "pl" | "mn" | "ns";
export type GameInfo = {
  id: GameId;
  name: string;
  blurb: string;
  players: string;
  /** Mr Ken's own games, copied into /public/games. */
  src?: string;
  /** What it practises (the Play page groups by this). */
  topic: "Times tables" | "Fractions" | "Time & money" | "Thinking";
  /** Needs the whole screen (a board plus a tray), not the narrow card. */
  wide?: boolean;
  /** Tile colours for the games corner. */
  bg: string;
  fg: string;
};

export const GAMES: GameInfo[] = [
  { id: "football", name: "Football Times Tables", topic: "Times tables", blurb: "Every right answer is a goal", players: "1 player", bg: "#1d6b3a", fg: "#ffffff" },
  { id: "wolf-vs-sheep", name: "Wolf vs Sheep", topic: "Thinking", blurb: "Trap the wolf, or catch 7 sheep", players: "2 players, or against the computer", src: "/games/wolf-vs-sheep/index.html", bg: "#c79a5a", fg: "#2b1a08" },
  { id: "magic-square", name: "Magic Square Academy", topic: "Thinking", blurb: "Make every line add up the same", players: "1 player", src: "/games/magic-square/index.html", bg: "#4b3a9a", fg: "#ffffff" },
  { id: "qm", name: "Quick Maths", topic: "Thinking", blurb: "10 questions, beat your time", players: "1 player", bg: "#d9622b", fg: "#ffffff" },
  { id: "tt", name: "Times Tables Sprint", topic: "Times tables", blurb: "How many in 60 seconds?", players: "1 player", bg: "#0f6b62", fg: "#ffffff" },
  { id: "sd", name: "Mini Sudoku", topic: "Thinking", blurb: "Fill the grid with 1 to 4, or 1 to 6", players: "1 player", bg: "#2c5aa8", fg: "#ffffff" },
  { id: "fp", name: "Pizza Fractions", topic: "Fractions", blurb: "Shade slices, name fractions, make the same amount", players: "1 player · ages 6–9", bg: "#b8322a", fg: "#ffffff" },
  { id: "ff", name: "Fraction Face-off", topic: "Fractions", blurb: "Which fraction is bigger? 60 seconds", players: "1 player · ages 8–12", bg: "#7d2a6b", fg: "#ffffff" },
  { id: "fc", name: "Fraction Challenge", topic: "Fractions", blurb: "3/4 of 20, adding, equivalent fractions", players: "1 player · ages 9–12", bg: "#e8b23a", fg: "#2b1a08" },
  { id: "ck", name: "Clock Rescue", topic: "Time & money", blurb: "Set the clock, read the time, how much later?", players: "1 player · ages 6–11", bg: "#2f7d9a", fg: "#ffffff" },
  { id: "ms", name: "Money Shop", topic: "Time & money", blurb: "Pay and give change in baht or dollars", players: "1 player · ages 6–11", bg: "#3f8f4f", fg: "#ffffff" },
  { id: "cq", name: "Clock Tower Quest", topic: "Time & money", blurb: "Beat the monsters with your time skills", players: "1 player · ages 6–12", wide: true, bg: "#4b3b8f", fg: "#ffffff" },
  { id: "pb", name: "Piggy Bank Rain", topic: "Time & money", blurb: "Catch coins to fill the piggy exactly", players: "1 player · ages 5–9", bg: "#e07aa5", fg: "#ffffff" },
  { id: "ls", name: "My Little Shop", topic: "Time & money", blurb: "Run a shop, give change, buy upgrades", players: "1 player · ages 7–12", wide: true, bg: "#c2643c", fg: "#ffffff" },
  { id: "sb", name: "Shape Builder", topic: "Thinking", blurb: "Fit all 12 blocks into the animal", players: "1 player · ages 6–12", wide: true, bg: "#1f6f8b", fg: "#ffffff" },
  { id: "bp", name: "Balance Puzzles", topic: "Thinking", blurb: "What does each shape weigh?", players: "1 player · ages 7–12", bg: "#8b6d1f", fg: "#ffffff" },
  { id: "pl", name: "Picture Logic", topic: "Thinking", blurb: "Use the number clues to find the hidden picture", players: "1 player · ages 7–12", wide: true, bg: "#334155", fg: "#ffffff" },
  { id: "mn", name: "Make the Number", topic: "Thinking", blurb: "Join cards with + − × ÷ to hit the target", players: "1 player · ages 7–12", bg: "#1f2a44", fg: "#ffffff" },
  { id: "ns", name: "Number Snake", topic: "Thinking", blurb: "Draw the path 1, 2, 3 … through every square", players: "1 player · ages 6–12", bg: "#0f766e", fg: "#ffffff" },
];

/** Games built into TutoringHub (not Mr Ken's own pages in /public/games): what a screen picture may show. */
export const BUILT_IN = GAMES.filter((g) => !g.src && g.id !== "football").map((g) => g.id);

export const gameById = (id: string) => GAMES.find((g) => g.id === id) ?? null;

/** The games corner as its own iPad home-screen app: "Games" with its own icon, opening at /arcade. */
export const ARCADE_META: Metadata = {
  title: "Games corner",
  manifest: "/arcade/manifest.webmanifest",
  icons: { apple: "/icons/games-180.png" },
  appleWebApp: { capable: true, title: "Games", statusBarStyle: "black-translucent" },
};
