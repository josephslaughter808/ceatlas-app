import { getCourseFilters, getCourses } from "@/lib/courses";
import CourseCatalogClient from "../components/course-catalog-client";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function SavedPage() {
  const [courses, filters] = await Promise.all([
    getCourses(),
    getCourseFilters(),
  ]);

  return (
    <div className="container">
      <section className="page-header">
        <h1>Saved Planning Board</h1>
        <p>
          Keep your CE shortlist in one place now, then layer flights, hotels, and rental cars onto the same trip plan.
        </p>
      </section>

      <section className="saved-overview">
        <div className="card saved-overview__card">
          <h2>Saved Courses</h2>
          <p>Your bookmarked CE options live here and can also be filtered inside the catalog.</p>
        </div>
        <div className="card saved-overview__card">
          <h2>Flights Ready</h2>
          <p>Use the travel planner to jump from a saved course into live flight searches built around that trip.</p>
        </div>
        <div className="card saved-overview__card">
          <h2>Hotels & Cars Ready</h2>
          <p>Hotels and rental cars now plug into the same itinerary flow, even before direct booking APIs are connected.</p>
        </div>
      </section>

      <section className="saved-overview">
        <div className="card saved-overview__card">
          <h2>Travel Planning</h2>
          <p>Build a CE trip around any saved course, keep your itinerary in one place, and open live hotel, flight, and car searches from there.</p>
          <p>
            <Link href="/travel">Open travel planner</Link>
          </p>
        </div>
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
        defaultSavedOnly
      />
    </div>
  );
}
