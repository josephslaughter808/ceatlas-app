import catalogJson from "@/data/veterinary-courses.json";
import type { PhysicianCourse } from "@/lib/physician-courses";

type Catalog = { generated_at: string; count: number; courses: PhysicianCourse[] };
const catalog = catalogJson as unknown as Catalog;
export const veterinaryCatalogGeneratedAt = catalog.generated_at;
export const veterinaryCatalogCount = catalog.count;
export const veterinaryCatalogFacets = {
  specialties: [...new Set(catalog.courses.map((course) => course.topic).filter(Boolean))].sort(),
  formats: [...new Set(catalog.courses.map((course) => course.format).filter(Boolean))].sort(),
};
export function searchVeterinaryCourses({ q = "", specialty = "", format = "", date = "", sort = "relevance", page = 1, pageSize = 12 } = {}) {
  const query = q.trim().toLowerCase();
  const today = new Date().toISOString().slice(0, 10); const yearEnd = `${today.slice(0, 4)}-12-31`; const next90 = new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10);
  const filtered = catalog.courses.filter((course) => {
    if (specialty && course.topic !== specialty) return false;
    if (format && course.format !== format) return false;
    const courseDate = course.start_date && course.start_date >= today ? course.start_date : course.start_date ? today : course.end_date;
    if (date === "this-year" && (!courseDate || courseDate > yearEnd)) return false;
    if (date === "next-90" && (!courseDate || courseDate < today || courseDate > next90)) return false;
    return !query || `${course.title} ${course.provider} ${course.description} ${course.topic}`.toLowerCase().includes(query);
  });
  if (sort === "date-asc" || sort === "date-desc") filtered.sort((a, b) => { const left = a.start_date && a.start_date >= today ? a.start_date : a.end_date || "9999-12-31"; const right = b.start_date && b.start_date >= today ? b.start_date : b.end_date || "9999-12-31"; return sort === "date-asc" ? left.localeCompare(right) : right.localeCompare(left); });
  const size = Math.min(24, Math.max(1, pageSize));
  const pages = Math.max(1, Math.ceil(filtered.length / size));
  const safePage = Math.min(pages, Math.max(1, page));
  return { courses: filtered.slice((safePage - 1) * size, safePage * size), total: filtered.length, page: safePage, pages };
}
