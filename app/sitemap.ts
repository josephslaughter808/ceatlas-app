import type { MetadataRoute } from "next";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://ceatlas-app.vercel.app").replace(/\/$/, "");

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const routes = [
    "",
    "/courses",
    "/packages",
    "/cruises",
    "/travel",
    "/compare",
    "/account",
    "/list-your-ce",
    "/contact",
    "/privacy",
    "/terms",
  ];

  return routes.map((route) => ({
    url: `${SITE_URL}${route}`,
    lastModified: now,
    changeFrequency: route === "/courses" ? "daily" : "weekly",
    priority: route === "" ? 1 : route === "/courses" ? 0.95 : 0.7,
  }));
}
