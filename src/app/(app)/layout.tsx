import "@fontsource/outfit/500.css";
import "@fontsource/outfit/600.css";
import "@fontsource/outfit/700.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/barlow-condensed/700-italic.css";
import "@fontsource/barlow-condensed/800-italic.css";
import { requireSignedIn } from "@/lib/auth";
import { GlassNav, GlassOrbs } from "@/components/GlassNav";
import { AppMain } from "@/components/AppMain";
import { themeBootScript } from "@/lib/glassTheme";

import type { Viewport } from "next";

export const viewport: Viewport = { themeColor: "#071719" };

// The signed-in app, in TutoringHub Glass: dark background with drifting glows, the glass top bar, then the page.
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const me = await requireSignedIn();
  return (
    <div className="th-glass pb-12">
      {/* The colour theme saved on this device, applied before the page draws */}
      <script dangerouslySetInnerHTML={{ __html: themeBootScript() }} />
      <GlassOrbs />
      <div className="relative z-10 px-3 pt-3 sm:px-5">
        <GlassNav role={me.role === "tutor" ? "tutor" : "viewer"} />
        <AppMain>{children}</AppMain>
      </div>
    </div>
  );
}
