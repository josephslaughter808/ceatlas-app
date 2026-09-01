import type { MetadataRoute } from "next";
import { disciplines } from "@/lib/disciplines";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://ceatlas-app.vercel.app").replace(/\/$/, "");

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const routes = [
    "",
    "/courses",
    "/match",
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

  const disciplineRoutes = disciplines.filter((discipline) => !discipline.live).map((discipline) => `/disciplines/${discipline.slug}`);

  return [...routes, ...disciplineRoutes].map((route) => ({
    url: `${SITE_URL}${route}`,
    lastModified: now,
    changeFrequency: route === "/courses" ? "daily" : "weekly",
    priority: route === "" ? 1 : route === "/courses" ? 0.95 : 0.7,
  }));
}
