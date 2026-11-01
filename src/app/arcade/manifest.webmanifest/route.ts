/** Added to the iPad home screen, the games corner opens as its own app, straight into the games. */
export function GET() {
  return Response.json(
    {
      name: "Games corner",
      short_name: "Games",
      start_url: "/arcade",
      scope: "/",
      display: "standalone",
      background_color: "#0b1d42",
      theme_color: "#0b1d42",
      icons: [
        { src: "/icons/games-192.png", sizes: "192x192", type: "image/png" },
        { src: "/icons/games-512.png", sizes: "512x512", type: "image/png" },
      ],
    },
    { headers: { "Content-Type": "application/manifest+json" } },
  );
}
