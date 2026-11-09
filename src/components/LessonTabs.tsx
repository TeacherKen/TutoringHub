"use client";
import { useState, type ReactNode } from "react";

type View = "teach" | "after";

/**
 * The lesson page's two tabs. Both are already on the page, so switching is instant (no trip to the
 * server). The address bar still changes, so a refresh stays on the same tab.
 */
export function LessonTabs({ initial, sent, teach, after }: { initial: View; sent: boolean; teach: ReactNode; after: ReactNode }) {
  const [view, setView] = useState<View>(initial);
  const pick = (v: View) => {
    setView(v);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("view", v);
      url.hash = "";
      window.history.replaceState(window.history.state, "", url);
    } catch {
      /* the tab still changes */
    }
  };
  const tab = (v: View, label: string) => (
    <button type="button" onClick={() => pick(v)} className={`tab press ${view === v ? "is-on" : ""}`} aria-pressed={view === v}>
      {label}
    </button>
  );
  return (
    <>
      {/* Two jobs, two tabs: teaching the class, and the update afterwards. Picked by the time, switchable. */}
      <nav aria-label="Lesson page" className="glass flex gap-1 self-start rounded-[22px] p-1.5">
        {tab("teach", "🧑‍🏫 Teach")}
        {tab("after", `📮 After class${sent ? " ✓" : ""}`)}
      </nav>
      {view === "teach" ? teach : after}
    </>
  );
}
