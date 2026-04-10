import { NextResponse } from "next/server";
import { getCoursesByIds } from "@/lib/courses";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const ids = Array.isArray(body.ids)
    ? body.ids.filter((id: unknown): id is string => typeof id === "string")
    : [];

  const courses = await getCoursesByIds(ids.slice(0, 250));

  return NextResponse.json(courses, {
    headers: {
      "Cache-Control": "private, max-age=60",
    },
  });
}
