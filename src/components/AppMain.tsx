"use client";
import { usePathname } from "next/navigation";

/**
 * Pages use the full laptop width (TutoringHub is mostly used on a MacBook); a single lesson or student
 * is a narrower page, as it's mostly reading and writing notes. Phones look the same either way.
 */
export function AppMain({ children }: { children: React.ReactNode }) {
  const narrow = /^\/(lessons|students)\/.+/.test(usePathname());
  return <main className={`mx-auto px-4 pt-5 md:pt-8 ${narrow ? "max-w-3xl" : "max-w-5xl"}`}>{children}</main>;
}
