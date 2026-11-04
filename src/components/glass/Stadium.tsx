import "@fontsource/outfit/600.css";
import "@fontsource/outfit/700.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import { GlassOrbs } from "@/components/GlassNav";
import { feelBootScript, STADIUM, themeBootScript, themeVars } from "@/lib/glassTheme";

/**
 * 🏟️ Pages the children see (their room, a match, the games corner menu): TutoringHub Glass in the
 * football game's colours (navy, gold, pitch green), never Mr Ken's theme. The games keep their own look.
 */
export function StadiumGlass({ children }: { children: React.ReactNode }) {
  return (
    <div className="th-glass th-stadium" style={themeVars(STADIUM) as React.CSSProperties}>
      <script dangerouslySetInnerHTML={{ __html: feelBootScript() }} />
      <GlassOrbs />
      <div className="relative z-10">{children}</div>
    </div>
  );
}

/** Pages outside the app shell that use Mr Ken's own theme (the sign-in page). */
export function ThemedGlass({ children }: { children: React.ReactNode }) {
  return (
    <div className="th-glass">
      <script dangerouslySetInnerHTML={{ __html: themeBootScript() }} />
      <GlassOrbs />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
