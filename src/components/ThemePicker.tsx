"use client";
import { useSyncExternalStore } from "react";
import { applyTheme, GLASS_THEMES } from "@/lib/glassTheme";
import { play } from "@/lib/sounds";

/** Settings → Colour theme: the glass background, accent and glows. Saved on this device only. */
export function ThemePicker() {
  // The theme on the page right now (set before the page draws, see themeBootScript).
  const current = useSyncExternalStore(
    (on) => {
      window.addEventListener("th-theme", on);
      return () => window.removeEventListener("th-theme", on);
    },
    () => document.documentElement.dataset.glass ?? "mint",
    () => "mint",
  );
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-label="Colour theme">
      {GLASS_THEMES.map((t) => {
        const on = current === t.id;
        return (
          <button
            key={t.id}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => {
              applyTheme(t.id);
              play("toggle");
            }}
            className={`press flex items-center gap-2.5 rounded-2xl border p-2.5 text-left text-sm font-medium ${on ? "border-[var(--th-accent-line)] bg-[var(--th-accent-soft)]" : "border-line bg-surface-2"}`}
          >
            <span
              aria-hidden
              className="relative h-9 w-9 shrink-0 overflow-hidden rounded-xl border border-white/15"
              style={{ background: `radial-gradient(circle at 30% 30%, rgba(${t.orbs[0]},0.7), transparent 60%), radial-gradient(circle at 80% 80%, rgba(${t.orbs[1]},0.6), transparent 55%), ${t.bg}` }}
            >
              <span className="absolute bottom-1 right-1 h-3 w-3 rounded-full" style={{ background: t.accent }} />
            </span>
            <span className="min-w-0">
              {t.name}
              {on ? <span className="block text-xs font-normal text-muted">In use</span> : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}
