"use client";
import { usePathname } from "next/navigation";

/** Pages are a comfortable reading width; Home is a wider dashboard. */
export function AppMain({ children }: { children: React.ReactNode }) {
  const wide = usePathname() === "/";
  return <main className={`mx-auto px-4 pt-5 md:pt-8 ${wide ? "max-w-5xl" : "max-w-2xl"}`}>{children}</main>;
}
