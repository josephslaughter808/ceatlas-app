import { NextRequest, NextResponse } from "next/server";
import { lawCatalogFacets, lawCatalogGeneratedAt, searchLawCourses } from "@/lib/law-courses";
export const runtime = "nodejs";
export async function GET(request: NextRequest) { const p = request.nextUrl.searchParams; return NextResponse.json({ ...searchLawCourses({ q: p.get("q") || "", specialty: p.get("specialty") || "", format: p.get("format") || "", date: p.get("date") || "", sort: p.get("sort") || "relevance", page: Number(p.get("page")) || 1, pageSize: Number(p.get("pageSize")) || 12 }), facets: lawCatalogFacets, generatedAt: lawCatalogGeneratedAt }); }
