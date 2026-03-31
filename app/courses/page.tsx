import { getCourseFilters, getCourses } from "@/lib/courses";
import CourseCatalogClient from "../components/course-catalog-client";

export default async function CoursesPage() {
  const [courses, filters] = await Promise.all([
    getCourses(),
    getCourseFilters(),
  ]);

  return (
    <div className="container">
      <section className="page-header">
        <h1>All CE Courses</h1>
        <p>
          Browse the latest CE inventory synced from provider catalogs and cleaned for easy comparison.
        </p>
      </section>

      <CourseCatalogClient
        courses={courses}
        filters={{
          providers: filters.providers.map((provider) => ({
            label: provider.provider || "",
            value: provider.provider || "",
          })),
          formats: filters.formats.filter((format): format is string => Boolean(format)),
          topics: filters.topics.filter((topic): topic is string => Boolean(topic)),
        }}
      />
    </div>
  );
}
