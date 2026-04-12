import { NextResponse } from "next/server";
import { getCatalogOverview } from "@/lib/courses";

export async function GET() {
  const stats = await getCatalogOverview();

  return NextResponse.json({
    courses: stats.courseCount,
    providers: stats.providerCount,
    formatCount: stats.formatCount,
  }, {
    headers: {
      "Cache-Control": "s-maxage=600, stale-while-revalidate=3600",
    },
  });
}
