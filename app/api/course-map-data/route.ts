import { NextResponse } from "next/server";
import { getCoursesByIds, getMapCourses } from "@/lib/courses";
import { getPublicMapSessions } from "@/lib/db";

type SearchParamsShape = {
  search?: string;
  provider?: string | string[];
  format?: string | string[];
  topic?: string | string[];
  sort?: string;
};

const MAP_PAGE_SIZE = 10;

function toList(value: string | null) {
  if (!value) return [];
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function normalizeMapLocation(value: string | null | undefined) {
  const raw = String(value || "").trim().replace(/\s+/g, " ");
  if (!raw) return null;
  if (/^(test|travel destination|see course page)$/i.test(raw)) return null;
  if (/^location:\s*/i.test(raw)) {
    return normalizeMapLocation(raw.replace(/^location:\s*/i, ""));
  }
  if (/san antonio/i.test(raw)) return "San Antonio, TX";

  const cityStateMatches = [...raw.matchAll(/([A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+)*,\s*[A-Z]{2})/g)];
  if (cityStateMatches.length > 0) {
    return cityStateMatches[cityStateMatches.length - 1]?.[1]?.trim() || raw;
  }

  return raw;
}

function isMappableCourse(course: { next_location?: string | null; next_format?: string | null }) {
  const location = normalizeMapLocation(course.next_location);
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
  const location = normalizeMapLocation(searchParams.get("location")) || "";
  const dateStart = String(searchParams.get("dateStart") || "").trim();
  const dateEnd = String(searchParams.get("dateEnd") || "").trim();
  const page = Math.max(1, Number(searchParams.get("page")) || 1);

  const query: SearchParamsShape = {
    search: searchParams.get("search") || undefined,
    provider: toList(searchParams.get("provider")),
    format: toList(searchParams.get("format")),
    topic: toList(searchParams.get("topic")),
    sort: searchParams.get("sort") || "balanced",
  };

  const hasCatalogFilters = Boolean(
    query.search
    || (Array.isArray(query.provider) && query.provider.length)
    || (Array.isArray(query.format) && query.format.length)
    || (Array.isArray(query.topic) && query.topic.length)
    || (query.sort && query.sort !== "balanced")
  );

  if (!hasCatalogFilters) {
    const sessions = await getPublicMapSessions();
    const filteredSessions = sessions.filter((session) => {
      const locationName = normalizeMapLocation(session.location);
      const formatName = String(session.format || "").trim();
      if (!locationName) return false;
      if (/\bonline|self-paced|self paced|virtual\b/i.test(locationName)) return false;
      if (/^online$/i.test(formatName)) return false;
      return inDateWindow(session.start_date, dateStart, dateEnd);
    });

    const groupedLocations = new Map<string, { count: number; courseIds: string[] }>();

    for (const session of filteredSessions) {
      const locationName = normalizeMapLocation(session.location);
      if (!locationName) continue;
      const courseId = String(session.course_id || "").trim();
      const current = groupedLocations.get(locationName) || { count: 0, courseIds: [] };
      current.count += 1;
      if (courseId && !current.courseIds.includes(courseId)) {
        current.courseIds.push(courseId);
      }
      groupedLocations.set(locationName, current);
    }

    const locationEntries = [...groupedLocations.entries()]
      .sort((a, b) => b[1].count - a[1].count || a[0].localeCompare(b[0]))
      .map(([locationName, value]) => ({
        location: locationName,
        count: value.count,
        courseIds: value.courseIds,
      }))
      .slice(0, 250);

    const selectedEntry = locationEntries.find((entry) => entry.location === location) || null;
    const selectedCourseIds = selectedEntry?.courseIds || [];
    const totalSelectedCourses = selectedCourseIds.length;
    const totalPages = Math.max(1, Math.ceil(totalSelectedCourses / MAP_PAGE_SIZE));
    const currentPage = Math.min(page, totalPages);
    const start = (currentPage - 1) * MAP_PAGE_SIZE;
    const courses = selectedEntry
      ? await getCoursesByIds(selectedCourseIds.slice(start, start + MAP_PAGE_SIZE))
      : [];

    return NextResponse.json({
      locations: locationEntries.map(({ location: name, count }) => ({ location: name, count })),
      totalMappableCourses: filteredSessions.length,
      courseCountForSelection: totalSelectedCourses,
      currentPage,
      totalPages,
      courses,
    }, {
      headers: {
        "Cache-Control": "s-maxage=600, stale-while-revalidate=3600",
      },
    });
  }

  const allCourses = await getMapCourses(query);
  const mappableCourses = allCourses
    .filter(isMappableCourse)
    .filter((course) => inDateWindow(course.next_start_date, dateStart, dateEnd));

  const groupedLocations = new Map<string, number>();

  for (const course of mappableCourses) {
    const key = normalizeMapLocation(course.next_location);
    if (!key) continue;
    groupedLocations.set(key, (groupedLocations.get(key) || 0) + 1);
  }

  const locationEntries = [...groupedLocations.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([locationName, count]) => ({ location: locationName, count }))
    .slice(0, 250);

  const locationSet = new Set(locationEntries.map((entry) => entry.location));
  const visiblePool = mappableCourses.filter((course) => {
    const normalizedLocation = normalizeMapLocation(course.next_location);
    return normalizedLocation ? locationSet.has(normalizedLocation) : false;
  });
  const visibleCourses = location
    ? visiblePool.filter((course) => normalizeMapLocation(course.next_location) === location)
    : [];
  const totalSelectedCourses = visibleCourses.length;
  const totalPages = Math.max(1, Math.ceil(totalSelectedCourses / MAP_PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * MAP_PAGE_SIZE;

  return NextResponse.json({
    locations: locationEntries,
    totalMappableCourses: visiblePool.length,
    courseCountForSelection: totalSelectedCourses,
    currentPage,
    totalPages,
    courses: visibleCourses.slice(start, start + MAP_PAGE_SIZE),
  }, {
    headers: {
      "Cache-Control": "s-maxage=600, stale-while-revalidate=3600",
    },
  });
}
