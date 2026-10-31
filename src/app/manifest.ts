import type { MetadataRoute } from "next";

/** Lets Mr Ken add TutoringHub to the iPad (or phone) home screen as an app. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "TutoringHub",
    short_name: "TutoringHub",
    description: "Lessons, notes, parent feedback and package hours in one place.",
    start_url: "/",
    display: "standalone",
    background_color: "#f6f6f3",
    theme_color: "#0f6b62",
    icons: [
      { src: "/icons/tutor-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/tutor-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
