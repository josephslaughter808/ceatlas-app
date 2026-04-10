import { NextResponse } from "next/server";
import { getCourseFilters } from "@/lib/courses";

export async function GET() {
  const filters = await getCourseFilters();

  return NextResponse.json({
    providers: filters.providers.map((provider) => ({
      label: String(provider.provider || ""),
      value: String(provider.provider || ""),
    })),
    formats: filters.formats.filter((format): format is string => Boolean(format)),
    topics: filters.topics.filter((topic): topic is string => Boolean(topic)),
  }, {
    headers: {
      "Cache-Control": "s-maxage=600, stale-while-revalidate=3600",
    },
  });
}
