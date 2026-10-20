import type { MetadataRoute } from "next";

/** For "Add to Home Screen": the app's name and icons. iOS uses `apple-icon.png` beside this file. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Last Layer",
    short_name: "Last Layer",
    description: "Learn and drill cube algorithms, and time your solves.",
    start_url: "/",
    display: "standalone",
    background_color: "#0a0a0a",
    theme_color: "#0a0a0a",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
