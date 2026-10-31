import { NextResponse } from "next/server";
import { studentForToken } from "@/lib/practice";

// A child's own home-screen app: the icon opens straight into their football game.
export async function GET(_req: Request, ctx: RouteContext<"/room/[token]/manifest.webmanifest">) {
  const { token } = await ctx.params;
  const s = await studentForToken(token);
  if (!s) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(
    {
      name: `${s.first_name}'s Football Times Tables`,
      short_name: s.first_name,
      start_url: `/room/${token}?tab=practice`,
      scope: `/room/${token}`,
      display: "standalone",
      background_color: "#0b1d42",
      theme_color: "#0b1d42",
      icons: [
        { src: "/icons/kid-192.png", sizes: "192x192", type: "image/png" },
        { src: "/icons/kid-512.png", sizes: "512x512", type: "image/png" },
      ],
    },
    { headers: { "Content-Type": "application/manifest+json", "Cache-Control": "no-store" } },
  );
}
