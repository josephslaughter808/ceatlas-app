import { NextResponse } from "next/server";
import { getFeaturedCourses } from "@/lib/courses";

export async function GET() {
  const courses = await getFeaturedCourses(6);

  return NextResponse.json(courses, {
    headers: {
      "Cache-Control": "s-maxage=300, stale-while-revalidate=1800",
    },
  });
}
