import catalogJson from "@/data/physician-courses.json";

export type PhysicianCourse = {
  provider: string;
  url: string;
  title: string;
  description: string;
  course_type: string;
  format: string;
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
  } | null;
};

type Catalog = { generated_at: string; count: number; courses: PhysicianCourse[] };
const catalog = catalogJson as unknown as Catalog;

export const physicianCatalogGeneratedAt = catalog.generated_at;
export const physicianCatalogCount = catalog.count;

const specialties = [...new Set(catalog.courses.map((course) => course.topic).filter(Boolean))].sort();
const formats = [...new Set(catalog.courses.map((course) => course.format).filter(Boolean))].sort();

export const physicianCatalogFacets = { specialties, formats };

export function searchPhysicianCourses({ q = "", specialty = "", format = "", page = 1, pageSize = 12 } = {}) {
  const query = q.trim().toLowerCase();
  const filtered = catalog.courses.filter((course) => {
    if (specialty && course.topic !== specialty) return false;
    if (format && course.format !== format) return false;
    if (!query) return true;
    return `${course.title} ${course.provider} ${course.description} ${course.topic}`.toLowerCase().includes(query);
  });
  const safePageSize = Math.min(24, Math.max(1, pageSize));
  const pages = Math.max(1, Math.ceil(filtered.length / safePageSize));
  const safePage = Math.min(pages, Math.max(1, page));
  const start = (safePage - 1) * safePageSize;
  return { courses: filtered.slice(start, start + safePageSize), total: filtered.length, page: safePage, pages };
}

