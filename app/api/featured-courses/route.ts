import { NextResponse } from "next/server";
import { getFeaturedCourses } from "@/lib/courses";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit")) || 6));
  const courses = await getFeaturedCourses(limit);

  return NextResponse.json(courses, {
    headers: {
      "Cache-Control": "s-maxage=300, stale-while-revalidate=1800",
    },
  });
}
