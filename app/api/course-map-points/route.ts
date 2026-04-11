import { NextResponse } from "next/server";

type RequestBody = {
  locations?: string[];
};

type Point = {
  location: string;
  latitude: number;
  longitude: number;
  label: string;
};

const geocodeCache = new Map<string, Point | null>();

function cleanLocation(value: string) {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, 160);
}

function inferCountryCode(location: string) {
  if (/\b[A-Z]{2}\b/.test(location) || /\bUSA\b|\bUnited States\b/i.test(location)) return "US";
  if (/\bCanada\b|\bON\b|\bBC\b|\bAB\b/i.test(location)) return "CA";
  if (/\bPuerto Rico\b/i.test(location)) return "PR";
  return "";
}

async function geocodeLocation(location: string) {
  const normalized = cleanLocation(location);
  if (!normalized) return null;
  if (geocodeCache.has(normalized)) return geocodeCache.get(normalized) || null;

  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.searchParams.set("name", normalized);
  url.searchParams.set("count", "1");
  url.searchParams.set("language", "en");
  url.searchParams.set("format", "json");

  const countryCode = inferCountryCode(normalized);
  if (countryCode) {
    url.searchParams.set("countryCode", countryCode);
  }

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "CEAtlas/1.0",
      },
      next: { revalidate: 60 * 60 * 24 },
    });

    if (!response.ok) {
      geocodeCache.set(normalized, null);
      return null;
    }

    const data = await response.json() as {
      results?: Array<{
        latitude?: number;
        longitude?: number;
        name?: string;
        admin1?: string;
        country?: string;
      }>;
    };

    const first = data.results?.[0];
    if (typeof first?.latitude !== "number" || typeof first?.longitude !== "number") {
      geocodeCache.set(normalized, null);
      return null;
    }

    const point = {
      location: normalized,
      latitude: first.latitude,
      longitude: first.longitude,
      label: [first.name, first.admin1, first.country].filter(Boolean).join(", ") || normalized,
    };

    geocodeCache.set(normalized, point);
    return point;
  } catch {
    geocodeCache.set(normalized, null);
    return null;
  }
}

export async function POST(request: Request) {
  const body = await request.json() as RequestBody;
  const locations = [...new Set((body.locations || []).map(cleanLocation).filter(Boolean))].slice(0, 80);

  const results = await Promise.all(locations.map((location) => geocodeLocation(location)));

  return NextResponse.json({
    points: results.filter(Boolean),
  }, {
    headers: {
      "Cache-Control": "s-maxage=86400, stale-while-revalidate=604800",
    },
  });
}
