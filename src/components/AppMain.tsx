"use client";
import { usePathname } from "next/navigation";

/**
 * Pages use the full laptop width (TutoringHub is mostly used on a MacBook); a single lesson or student
 * is a narrower page, as it's mostly reading and writing notes. Each page fades in gently (page-enter);
 * the key makes it play again on every page change. Reduced-motion settings turn it off.
 */
export function AppMain({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const narrow = /^\/(lessons|students)\/.+/.test(path);
  return (
    <main key={path} className={`page-enter mx-auto pt-4 sm:pt-6 md:pt-8 ${narrow ? "max-w-3xl" : "max-w-[1240px]"}`}>
      {children}
    </main>
  );
}
