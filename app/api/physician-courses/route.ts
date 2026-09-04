import { NextRequest, NextResponse } from "next/server";
import { physicianCatalogFacets, physicianCatalogGeneratedAt, searchPhysicianCourses } from "@/lib/physician-courses";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const result = searchPhysicianCourses({
    q: params.get("q") || "",
    specialty: params.get("specialty") || "",
    format: params.get("format") || "",
    date: params.get("date") || "",
    sort: params.get("sort") || "relevance",
    page: Number(params.get("page")) || 1,
    pageSize: Number(params.get("pageSize")) || 12,
  });
  return NextResponse.json({ ...result, facets: physicianCatalogFacets, generatedAt: physicianCatalogGeneratedAt });
}
