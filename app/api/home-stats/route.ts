import { NextResponse } from "next/server";
import { getCatalogStats, getPublicSessionFormats } from "@/lib/db";

export async function GET() {
  const [stats, formats] = await Promise.all([
    getCatalogStats(),
    getPublicSessionFormats(),
  ]);

  return NextResponse.json({
    courses: stats.courses,
    providers: stats.providers,
    formatCount: new Set(formats.filter(Boolean)).size,
  }, {
    headers: {
      "Cache-Control": "s-maxage=600, stale-while-revalidate=3600",
    },
  });
}
