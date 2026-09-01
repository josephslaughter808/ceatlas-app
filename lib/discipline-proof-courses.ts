import proofCatalog from "@/data/discipline-proof-courses.json";

export type DisciplineProofCourse = {
  id: string;
  discipline: string;
  provider: string;
  title: string;
  description: string;
  credits: string;
  format: string;
  start_date: string | null;
  location: string;
  url: string;
  source_url: string;
  status: string;
};

export function getDisciplineProofCourses(slug: string) {
  return (proofCatalog.courses as DisciplineProofCourse[]).filter((course) => course.discipline === slug);
}

export const disciplineProofGeneratedAt = proofCatalog.generated_at;
