import { NextRequest, NextResponse } from "next/server";
import { searchVeterinaryCourses, veterinaryCatalogFacets, veterinaryCatalogGeneratedAt } from "@/lib/veterinary-courses";
export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams;
  return NextResponse.json({ ...searchVeterinaryCourses({ q: p.get("q") || "", specialty: p.get("specialty") || "", format: p.get("format") || "", page: Number(p.get("page")) || 1, pageSize: Number(p.get("pageSize")) || 12 }), facets: veterinaryCatalogFacets, generatedAt: veterinaryCatalogGeneratedAt });
}
