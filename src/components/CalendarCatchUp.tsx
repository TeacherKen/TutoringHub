"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { postJson } from "@/lib/postJson";

/** After the page shows: check the calendars in the background, and redraw only if something changed. */
export function CalendarCatchUp() {
  const router = useRouter();
  useEffect(() => {
    let alive = true;
    void postJson<{ changed?: boolean }>("/api/calendar/catch-up", {}).then((r) => {
      if (alive && r.changed) router.refresh();
    });
    return () => {
      alive = false;
    };
  }, [router]);
  return null;
}
