import { NextResponse } from "next/server";
import { getCourses } from "@/lib/courses";

type SearchParamsShape = {
  search?: string;
  provider?: string | string[];
  format?: string | string[];
  topic?: string | string[];
  sort?: string;
};

function toList(value: string | null) {
  if (!value) return [];
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function isMappableCourse(course: { next_location?: string | null; next_format?: string | null }) {
  const location = String(course.next_location || "").trim();
  const format = String(course.next_format || "").trim();
  if (!location) return false;
  if (/\bonline|self-paced|self paced\b/i.test(location)) return false;
  if (/^online$/i.test(format)) return false;
  return true;
}

function inDateWindow(courseDate: string | null | undefined, dateStart: string, dateEnd: string) {
  const normalized = String(courseDate || "").trim();
  if (!dateStart && !dateEnd) return true;
  if (!normalized) return false;
  if (dateStart && normalized < dateStart) return false;
  if (dateEnd && normalized > dateEnd) return false;
  return true;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const location = String(searchParams.get("location") || "").trim();
  const dateStart = String(searchParams.get("dateStart") || "").trim();
  const dateEnd = String(searchParams.get("dateEnd") || "").trim();

  const query: SearchParamsShape = {
    search: searchParams.get("search") || undefined,
    provider: toList(searchParams.get("provider")),
    format: toList(searchParams.get("format")),
    topic: toList(searchParams.get("topic")),
    sort: searchParams.get("sort") || "balanced",
  };

  const allCourses = await getCourses(query);
  const mappableCourses = allCourses
    .filter(isMappableCourse)
    .filter((course) => inDateWindow(course.next_start_date, dateStart, dateEnd));

  const groupedLocations = new Map<string, number>();

  for (const course of mappableCourses) {
    const key = String(course.next_location || "").trim();
    groupedLocations.set(key, (groupedLocations.get(key) || 0) + 1);
  }

  const locationEntries = [...groupedLocations.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([locationName, count]) => ({ location: locationName, count }))
    .slice(0, 250);

  const locationSet = new Set(locationEntries.map((entry) => entry.location));
  const visiblePool = mappableCourses.filter((course) => locationSet.has(String(course.next_location || "").trim()));
  const visibleCourses = location
    ? visiblePool.filter((course) => String(course.next_location || "").trim() === location)
    : visiblePool;

  return NextResponse.json({
    locations: locationEntries,
    totalMappableCourses: visiblePool.length,
    courseCountForSelection: visibleCourses.length,
    courses: visibleCourses.slice(0, 10),
  }, {
    headers: {
      "Cache-Control": "s-maxage=600, stale-while-revalidate=3600",
    },
  });
}
