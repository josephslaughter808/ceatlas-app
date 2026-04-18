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

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", normalized);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("accept-language", "en");

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "CEAtlas/1.0 (support@ceatlas.co)",
        "Accept-Language": "en-US,en;q=0.9",
      },
      next: { revalidate: 60 * 60 * 24 },
    });

    if (!response.ok) {
      geocodeCache.set(normalized, null);
      return null;
    }

    const data = await response.json() as Array<{
      lat?: string;
      lon?: string;
      name?: string;
      display_name?: string;
    }>;

    const first = data?.[0];
    const latitude = Number(first?.lat);
    const longitude = Number(first?.lon);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      geocodeCache.set(normalized, null);
      return null;
    }

    const point = {
      location: normalized,
      latitude,
      longitude,
      label: first.display_name || first.name || normalized,
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
  const locations = [...new Set((body.locations || []).map(cleanLocation).filter(Boolean))].slice(0, 250);

  const results = await Promise.all(locations.map((location) => geocodeLocation(location)));

  return NextResponse.json({
    points: results.filter(Boolean),
  }, {
    headers: {
      "Cache-Control": "s-maxage=86400, stale-while-revalidate=604800",
    },
  });
}
