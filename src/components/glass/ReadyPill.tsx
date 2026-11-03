"use client";
import { useOptimistic, useTransition } from "react";
import { setLessonReady } from "@/app/actions/lessons";
import { play } from "@/lib/sounds";
import { toast } from "./Toast";
import type { Ready } from "@/lib/ready";

// 🟢/🟠 A lesson's status as a pill: green "ready", or orange with what's still to do.
// Tapping an orange one marks the lesson ready (tapping a ticked one undoes it). Lessons that are
// ready because new slides were uploaded just play a tap: there's nothing to tick.

export function ReadyPill({ lessonId, r, who, size = "md" }: { lessonId: string; r: Ready; who: string; size?: "md" | "lg" }) {
  const [pending, start] = useTransition();
  const [ready, setReady] = useOptimistic(r.ready);
  const fixed = r.ready && r.how === "slides";
  const todo = r.ready ? "not ready" : r.text.charAt(0).toLowerCase() + r.text.slice(1);
  const label = ready ? (fixed ? "slides ready" : "ready") : todo;

  function toggle() {
    if (fixed) {
      play("tap");
      toast(`${who}: ${r.text}`);
      return;
    }
    const next = !ready;
    play(next ? "success" : "undo");
    toast(next ? `${who} marked ready` : `${who}: not ready after all`);
    start(async () => {
      setReady(next);
      const f = new FormData();
      f.set("lesson_id", lessonId);
      f.set("ready", String(next));
      try {
        await setLessonReady(f);
      } catch {
        toast("Couldn't save that. Check the internet and try again.");
      }
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-busy={pending}
      title={fixed ? r.text : ready ? "Tap to undo" : `Tap when it's done (${todo})`}
      aria-label={`${who}: ${ready ? "ready" : todo}. ${fixed ? "" : ready ? "Tap to undo." : "Tap to mark ready."}`}
      className={`pill press cursor-pointer ${ready ? "ok" : "todo"} ${size === "lg" ? "min-h-10 px-3.5 text-sm" : "min-h-9"}`}
    >
      <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: ready ? "var(--th-ready)" : "var(--th-todo)" }} />
      {label}
    </button>
  );
}
