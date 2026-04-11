import Link from "next/link";
import { getNonCeEventsPage } from "@/lib/courses";
import EventCard from "../components/event-card";

export const dynamic = "force-dynamic";

type EventsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function EventsPage({ searchParams }: EventsPageProps) {
  const params = (await searchParams) || {};
  const search = Array.isArray(params.search) ? params.search[0] || "" : params.search || "";
  const page = Number(Array.isArray(params.page) ? params.page[0] : params.page) || 1;
  const pageSize = Number(Array.isArray(params.pageSize) ? params.pageSize[0] : params.pageSize) || 50;
  const catalog = await getNonCeEventsPage(search, page, pageSize);

  const nextParams = new URLSearchParams();
  if (search.trim()) nextParams.set("search", search.trim());
  if (pageSize !== 50) nextParams.set("pageSize", String(pageSize));

  return (
    <div className="container">
      <section className="page-header">
        <h1>Dental Events</h1>
        <p>
          Browse dental seminars, conferences, and event listings that may be useful for planning, but do not yet have
          verified CE-credit information in CEAtlas.
        </p>
        <div className="hero__actions">
          <Link href="/courses" className="button">Back to Verified CE Courses</Link>
          <Link href="/events" className="button button--light">Unverified Events</Link>
        </div>
        <div className="launch-note">
          <strong>Important:</strong>
          <span>
            These listings are separated from CE courses because credit eligibility is unverified. Confirm CE, fees,
            and registration details directly with the organizer.
          </span>
        </div>
      </section>

      <div className="course-filters">
        <div className="course-filters__search">
          <form action="/events">
            <input
              type="search"
              name="search"
              defaultValue={search}
              placeholder="Search event title, topic, organizer, or location"
              aria-label="Search events"
            />
          </form>
        </div>
      </div>

      <div className="course-count">
        Showing <strong>{catalog.events.length ? ((catalog.currentPage - 1) * catalog.pageSize) + 1 : 0}-{Math.min(catalog.currentPage * catalog.pageSize, catalog.total)}</strong> of <strong>{catalog.total}</strong> non-CE event listings
      </div>

      {catalog.events.length === 0 ? (
        <div className="card">
          <h2>No events matched this search.</h2>
          <p>
            Try a broader keyword or return to the <Link href="/courses">verified CE courses</Link> catalog.
          </p>
        </div>
      ) : (
        <>
          <div className="course-grid">
            {catalog.events.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>

          {catalog.totalPages > 1 ? (
            <div className="catalog-pagination">
              <Link
                href={catalog.currentPage > 1 ? `/events?${new URLSearchParams({ ...Object.fromEntries(nextParams.entries()), page: String(catalog.currentPage - 1) }).toString()}` : "#"}
                className={`button button-secondary${catalog.currentPage === 1 ? " is-disabled" : ""}`}
                aria-disabled={catalog.currentPage === 1}
              >
                Previous
              </Link>

              <span className="catalog-pagination__label">
                Page {catalog.currentPage} of {catalog.totalPages}
              </span>

              <Link
                href={catalog.currentPage < catalog.totalPages ? `/events?${new URLSearchParams({ ...Object.fromEntries(nextParams.entries()), page: String(catalog.currentPage + 1) }).toString()}` : "#"}
                className={`button button-secondary${catalog.currentPage === catalog.totalPages ? " is-disabled" : ""}`}
                aria-disabled={catalog.currentPage === catalog.totalPages}
              >
                Next
              </Link>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
