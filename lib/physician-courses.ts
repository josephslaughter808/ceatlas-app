import catalogJson from "@/data/physician-courses.json";

export type PhysicianCourse = {
  provider: string;
  url: string;
  title: string;
  description: string;
  course_type: string;
  format: string;
  audience?: string;
  topic: string;
  credits: number | null;
  credits_text: string;
  price: string;
  start_date: string;
  end_date: string;
  location: string;
  accreditation: string;
  metadata: {
    accme_activity_id?: string;
    registration?: string;
    is_moc?: boolean;
    approval_scope?: string;
    cebroker_offering_id?: string;
    cebroker_course_id?: string;
  } | null;
};

type Catalog = { generated_at: string; count: number; courses: PhysicianCourse[] };
const catalog = catalogJson as unknown as Catalog;

export const physicianCatalogGeneratedAt = catalog.generated_at;
export const physicianCatalogCount = catalog.count;

const specialties = [...new Set(catalog.courses.map((course) => course.topic).filter(Boolean))].sort();
const formats = [...new Set(catalog.courses.map((course) => course.format).filter(Boolean))].sort();

export const physicianCatalogFacets = { specialties, formats };

export function searchPhysicianCourses({ q = "", specialty = "", format = "", date = "", sort = "relevance", page = 1, pageSize = 12 } = {}) {
  const query = q.trim().toLowerCase();
  const today = new Date().toISOString().slice(0, 10);
  const yearEnd = `${today.slice(0, 4)}-12-31`;
  const next90 = new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10);
  const filtered = catalog.courses.filter((course) => {
    if (specialty && course.topic !== specialty) return false;
    if (format && course.format !== format) return false;
    const courseDate = course.start_date && course.start_date >= today ? course.start_date : course.start_date ? today : course.end_date;
    if (date === "this-year" && (!courseDate || courseDate > yearEnd)) return false;
    if (date === "next-90" && (!courseDate || courseDate < today || courseDate > next90)) return false;
    if (!query) return true;
    return `${course.title} ${course.provider} ${course.description} ${course.topic}`.toLowerCase().includes(query);
  });
  if (sort === "date-asc" || sort === "date-desc") filtered.sort((a, b) => {
    const left = a.start_date && a.start_date >= today ? a.start_date : a.end_date || "9999-12-31";
    const right = b.start_date && b.start_date >= today ? b.start_date : b.end_date || "9999-12-31";
    return sort === "date-asc" ? left.localeCompare(right) : right.localeCompare(left);
  });
  const safePageSize = Math.min(24, Math.max(1, pageSize));
  const pages = Math.max(1, Math.ceil(filtered.length / safePageSize));
  const safePage = Math.min(pages, Math.max(1, page));
  const start = (safePage - 1) * safePageSize;
  return { courses: filtered.slice(start, start + safePageSize), total: filtered.length, page: safePage, pages };
}
