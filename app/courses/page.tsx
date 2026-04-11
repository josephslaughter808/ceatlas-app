import { getCoursesPage, getDefaultCourseFilters } from "@/lib/courses";
import Link from "next/link";
import CourseCatalogClient from "../components/course-catalog-client";

export const dynamic = "force-dynamic";

type CoursesPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CoursesPage({ searchParams }: CoursesPageProps) {
  const params = (await searchParams) || {};
  const page = Number(Array.isArray(params.page) ? params.page[0] : params.page) || 1;
  const pageSize = Number(Array.isArray(params.pageSize) ? params.pageSize[0] : params.pageSize) || 50;

  const catalog = await getCoursesPage({
    search: Array.isArray(params.search) ? params.search[0] : params.search,
    provider: params.provider,
    format: params.format,
    topic: params.topic,
    sort: Array.isArray(params.sort) ? params.sort[0] : params.sort,
  }, page, pageSize);
  const filters = getDefaultCourseFilters();

  return (
    <div className="container">
      <section className="page-header">
        <h1>All CE Courses</h1>
        <p>
          Browse the latest CE inventory synced from provider catalogs and cleaned for easy comparison.
        </p>
        <div className="hero__actions">
          <Link href="/courses" className="button">Verified CE Courses</Link>
          <Link href="/events" className="button button--light">Browse Unverified Events</Link>
        </div>
        <div className="launch-note">
          <strong>Beta catalog note:</strong>
          <span>
            CEAtlas helps you discover and compare CE options. Always confirm credits, fees, cancellation rules,
            and state-board eligibility directly with the provider before registering.
          </span>
        </div>
      </section>

      <CourseCatalogClient
        courses={catalog.courses}
        total={catalog.total}
        currentPage={catalog.currentPage}
        totalPages={catalog.totalPages}
        pageSize={catalog.pageSize}
        initialState={{
          search: Array.isArray(params.search) ? params.search[0] || "" : params.search || "",
          sort: Array.isArray(params.sort) ? params.sort[0] || "balanced" : params.sort || "balanced",
          topics: typeof params.topic === "string" ? params.topic.split(",").filter(Boolean) : Array.isArray(params.topic) ? params.topic : [],
          providers: typeof params.provider === "string" ? params.provider.split(",").filter(Boolean) : Array.isArray(params.provider) ? params.provider : [],
          formats: typeof params.format === "string" ? params.format.split(",").filter(Boolean) : Array.isArray(params.format) ? params.format : [],
        }}
        filters={{
          providers: filters.providers.map((provider) => ({
            label: String(provider.provider || ""),
            value: String(provider.provider || ""),
          })),
          formats: filters.formats.filter((format): format is string => Boolean(format)),
          topics: filters.topics.filter((topic): topic is string => Boolean(topic)),
        }}
      />
    </div>
  );
}
