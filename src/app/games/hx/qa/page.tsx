"use client";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { BuiltInGame } from "@/components/games/BuiltInGame";
import type { GameId } from "@/lib/games";
function G() {
  const g = (useSearchParams().get("g") ?? "qm") as GameId;
  return <div id="g" className="mx-auto w-full max-w-5xl rounded-3xl bg-surface p-4 text-ink shadow-xl"><BuiltInGame id={g} /></div>;
}
export default function P() { return <div className="p-3"><Suspense><G /></Suspense></div>; }
