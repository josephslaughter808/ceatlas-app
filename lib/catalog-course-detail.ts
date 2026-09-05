import physicianJson from "@/data/physician-courses.json";
import veterinaryJson from "@/data/veterinary-courses.json";
import lawJson from "@/data/law-courses.json";
import nursingJson from "@/data/nursing-courses.json";
import type { PhysicianCourse } from "./physician-courses";
import { getCatalogCourseKey } from "./catalog-course-key";

export const catalogDisciplines = ["medicine", "veterinary", "law", "nursing"] as const;
export type CatalogDiscipline = typeof catalogDisciplines[number];

const catalogs: Record<CatalogDiscipline, PhysicianCourse[]> = {
  medicine: (physicianJson as { courses: PhysicianCourse[] }).courses,
  veterinary: (veterinaryJson as { courses: PhysicianCourse[] }).courses,
  law: (lawJson as { courses: PhysicianCourse[] }).courses,
  nursing: (nursingJson as { courses: PhysicianCourse[] }).courses,
};

export function findCatalogCourse(discipline: CatalogDiscipline, key: string) {
  return catalogs[discipline].find((course) => getCatalogCourseKey(course) === key) || null;
}
