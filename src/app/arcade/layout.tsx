import type { Metadata, Viewport } from "next";
import { requireTutor } from "@/lib/auth";
import { ARCADE_META } from "@/lib/games";

export const metadata: Metadata = ARCADE_META;
export const viewport: Viewport = { themeColor: "#0b1d42" };

/** 🎮 The games corner (Mr Ken's iPad, onsite lessons): signed in as Mr Ken, but no app menu. */
export default async function ArcadeLayout({ children }: LayoutProps<"/arcade">) {
  await requireTutor();
  return children;
}
