"use client";
import Link from "next/link";
import { play, type SoundKind } from "@/lib/sounds";

/** A normal link that plays a soft sound when tapped (tap, nav, open…). */
export function SoundLink({ sound = "tap", onClick, ...props }: React.ComponentProps<typeof Link> & { sound?: SoundKind }) {
  return (
    <Link
      {...props}
      onClick={(e) => {
        play(sound);
        onClick?.(e);
      }}
    />
  );
}
