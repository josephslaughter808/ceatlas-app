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
export function searchVeterinaryCourses({ q = "", specialty = "", format = "", page = 1, pageSize = 12 } = {}) {
  const query = q.trim().toLowerCase();
  const filtered = catalog.courses.filter((course) => {
    if (specialty && course.topic !== specialty) return false;
    if (format && course.format !== format) return false;
    return !query || `${course.title} ${course.provider} ${course.description} ${course.topic}`.toLowerCase().includes(query);
  });
  const size = Math.min(24, Math.max(1, pageSize));
  const pages = Math.max(1, Math.ceil(filtered.length / size));
  const safePage = Math.min(pages, Math.max(1, page));
  return { courses: filtered.slice((safePage - 1) * size, safePage * size), total: filtered.length, page: safePage, pages };
}
