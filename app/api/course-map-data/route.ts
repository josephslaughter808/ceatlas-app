import { NextResponse } from "next/server";
import { getCoursesByIds, getMapCourses } from "@/lib/courses";
import { getPublicMapSessions } from "@/lib/db";
import { getPracticeStateName, normalizePracticeStateCode } from "@/lib/practice-states";

type SearchParamsShape = {
  search?: string;
  provider?: string | string[];
  format?: string | string[];
  topic?: string | string[];
  sort?: string;
};

type MapSession = {
  course_id?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  location?: string | null;
  format?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
};

type DrillLocation = {
  location: string;
  count: number;
};

const MAP_PAGE_SIZE = 10;

function toList(value: string | null) {
  if (!value) return [];
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function normalizeCountry(value: string | null | undefined) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^(usa|u\.s\.a\.|united states|us)$/i.test(raw)) return "United States";
  if (/^(uk|u\.k\.|united kingdom)$/i.test(raw)) return "United Kingdom";
  if (/^uae$/i.test(raw)) return "United Arab Emirates";
  return raw;
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

function formatCityLabel(city: string, stateCode: string, country: string) {
  if (stateCode) return `${city}, ${stateCode}`;
  if (country) return `${city}, ${country}`;
  return city;
}

function deriveSessionLabels(session: MapSession) {
  const rawLocation = normalizeMapLocation(session.location);
  const city = String(session.city || "").trim();
  const stateCode = normalizePracticeStateCode(session.state);
  const stateName = stateCode ? getPracticeStateName(stateCode) : "";
  const country = normalizeCountry(session.country);

  const cityLabel = city ? formatCityLabel(city, stateCode, country && country !== "United States" ? country : "") : "";
  const stateLabel = stateName || (String(session.state || "").trim() || "");
  const countryLabel = country;

  let topLevelLabel = rawLocation || cityLabel || stateLabel || countryLabel;

  if (countryLabel && countryLabel !== "United States") {
    topLevelLabel = countryLabel;
  } else if (stateLabel) {
    topLevelLabel = stateLabel;
  } else if (cityLabel) {
    topLevelLabel = cityLabel;
  }

  return {
    rawLocation,
    cityLabel,
    stateLabel,
    countryLabel,
    topLevelLabel: topLevelLabel || "",
  };
}

function inDateWindow(courseDate: string | null | undefined, dateStart: string, dateEnd: string) {
  const normalized = String(courseDate || "").trim();
  if (!dateStart && !dateEnd) return true;
  if (!normalized) return false;
  if (dateStart && normalized < dateStart) return false;
  if (dateEnd && normalized > dateEnd) return false;
  return true;
}

function isMappableCourse(course: { next_location?: string | null; next_format?: string | null }) {
  const location = normalizeMapLocation(course.next_location);
  const format = String(course.next_format || "").trim();
  if (!location) return false;
  if (/\bonline|self-paced|self paced|virtual\b/i.test(location)) return false;
  if (/^online$/i.test(format)) return false;
  return true;
}

function buildDrilldownLocations(sessions: MapSession[], selectedLocation: string) {
  const grouped = new Map<string, { count: number; courseIds: Set<string> }>();

  for (const session of sessions) {
    const labels = deriveSessionLabels(session);
    let childLabel = "";

    if (selectedLocation === labels.countryLabel && labels.cityLabel) {
      childLabel = labels.cityLabel;
    } else if (selectedLocation === labels.stateLabel && labels.cityLabel) {
      childLabel = labels.cityLabel;
    } else if (selectedLocation === labels.topLevelLabel && labels.cityLabel && labels.cityLabel !== labels.topLevelLabel) {
      childLabel = labels.cityLabel;
    }

    if (!childLabel) continue;

    const courseId = String(session.course_id || "").trim();
    const current = grouped.get(childLabel) || { count: 0, courseIds: new Set<string>() };
    current.count += 1;
    if (courseId) current.courseIds.add(courseId);
    grouped.set(childLabel, current);
  }

  return [...grouped.entries()]
    .sort((a, b) => b[1].count - a[1].count || a[0].localeCompare(b[0]))
    .map(([location, value]) => ({
      location,
      count: value.count,
      courseIds: [...value.courseIds],
    }));
}

function buildTopLevelLocations(sessions: MapSession[]) {
  const grouped = new Map<string, { count: number; courseIds: Set<string> }>();

  for (const session of sessions) {
    const labels = deriveSessionLabels(session);
    const topLabel = labels.topLevelLabel;
    if (!topLabel) continue;
    const courseId = String(session.course_id || "").trim();
    const current = grouped.get(topLabel) || { count: 0, courseIds: new Set<string>() };
    current.count += 1;
    if (courseId) current.courseIds.add(courseId);
    grouped.set(topLabel, current);
  }

  return [...grouped.entries()]
    .sort((a, b) => b[1].count - a[1].count || a[0].localeCompare(b[0]))
    .map(([location, value]) => ({
      location,
      count: value.count,
      courseIds: [...value.courseIds],
    }))
    .slice(0, 250);
}

function findCitySelection(sessions: MapSession[], selectedLocation: string) {
  const matchingSessions = sessions.filter((session) => deriveSessionLabels(session).cityLabel === selectedLocation);
  if (!matchingSessions.length) return null;

  const firstMatch = deriveSessionLabels(matchingSessions[0]);
  const parentLocation = firstMatch.countryLabel && firstMatch.countryLabel !== "United States"
    ? firstMatch.countryLabel
    : (firstMatch.stateLabel || firstMatch.topLevelLabel);

  const siblingCities = parentLocation ? buildDrilldownLocations(sessions, parentLocation) : [];
  const selectedEntry = siblingCities.find((entry) => entry.location === selectedLocation) || null;

  return {
    siblingCities,
    selectedEntry,
  };
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
    const filteredSessions = sessions.filter((session: MapSession) => {
      const labels = deriveSessionLabels(session);
      const formatName = String(session.format || "").trim();
      if (!labels.topLevelLabel) return false;
      if (/\bonline|self-paced|self paced|virtual\b/i.test(labels.rawLocation || labels.topLevelLabel)) return false;
      if (/^online$/i.test(formatName)) return false;
      return inDateWindow(session.start_date, dateStart, dateEnd);
    });

    const topLevelLocations = buildTopLevelLocations(filteredSessions);
    const topLevelSelection = location
      ? topLevelLocations.find((entry) => entry.location === location) || null
      : null;
    const drilldownLocations = topLevelSelection ? buildDrilldownLocations(filteredSessions, location) : [];
    const citySelection = location && !topLevelSelection
      ? findCitySelection(filteredSessions, location)
      : null;
    const hasChildCities = drilldownLocations.length > 0;

    const visibleLocations = hasChildCities
      ? drilldownLocations
      : (citySelection?.siblingCities.length ? citySelection.siblingCities : topLevelLocations);
    const selectedCourseIds = hasChildCities
      ? []
      : (citySelection?.selectedEntry?.courseIds || topLevelSelection?.courseIds || []);
    const selectedCourses = selectedCourseIds.length
      ? await getCoursesByIds(selectedCourseIds)
      : [];
    const totalSelectedCourses = hasChildCities
      ? Number(topLevelSelection?.count || 0)
      : selectedCourses.length;
    const selectedLocationType = hasChildCities
      ? "region"
      : (selectedCourseIds.length ? "city" : "world");
    const totalPages = Math.max(1, Math.ceil(totalSelectedCourses / MAP_PAGE_SIZE));
    const currentPage = Math.min(page, totalPages);
    const start = (currentPage - 1) * MAP_PAGE_SIZE;
    const courses = selectedCourses.slice(start, start + MAP_PAGE_SIZE);

    return NextResponse.json({
      locations: visibleLocations.map(({ location: name, count }) => ({ location: name, count })),
      totalMappableCourses: filteredSessions.length,
      courseCountForSelection: totalSelectedCourses,
      currentPage,
      totalPages,
      selectedLocationType,
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
    selectedLocationType: location ? "city" : "world",
    courses: visibleCourses.slice(start, start + MAP_PAGE_SIZE),
  }, {
    headers: {
      "Cache-Control": "s-maxage=600, stale-while-revalidate=3600",
    },
  });
}
