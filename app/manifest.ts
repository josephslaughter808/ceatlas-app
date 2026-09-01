import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CEAtlas",
    short_name: "CEAtlas",
    description: "Continuing education discovery, comparison, matching, and travel planning by professional discipline.",
    start_url: "/",
    display: "standalone",
    background_color: "#f5efe4",
    theme_color: "#123b4a",
    icons: [
      { src: "/icon-192.png?v=10", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png?v=10", sizes: "512x512", type: "image/png" },
    ],
  };
}
