import CourseCard from "./components/coursecard";
import { getCatalogOverview, getFeaturedCourses } from "@/lib/courses";
import Link from "next/link";

export default async function HomePage() {
  const [featuredCourses, overview] = await Promise.all([
    getFeaturedCourses(6),
    getCatalogOverview(),
  ]);

  return (
    <div className="container home-page">
      <section className="hero">
        <div className="hero__copy">
          <p className="hero__eyebrow">CEAtlas Catalog Sync</p>
          <h1>Continuing education, cleaned up and ready to use.</h1>
          <p>
            CEAtlas pulls live provider catalogs, deduplicates them, and turns scattered CE listings
            into one searchable catalog for your site and your database.
          </p>
          <div className="hero__actions">
            <Link href="/courses" className="button">Browse Courses</Link>
          </div>
        </div>

        <div className="hero__stats">
          <div className="card">
            <h2>{overview.courseCount}</h2>
            <p>Courses ready for the live catalog</p>
          </div>
          <div className="card">
            <h2>{overview.providerCount}</h2>
            <p>Providers synced into one searchable source of truth</p>
          </div>
          <div className="card">
            <h2>{overview.formatCount}</h2>
            <p>Formats surfaced cleanly for browsing and planning</p>
          </div>
        </div>
      </section>

      <section className="home-section">
        <h2>What the pipeline does</h2>
        <div className="home-grid">
          <div className="card">
            <h3>Scrape Provider Catalogs</h3>
            <p>Pulls CE listings from public and provider-specific catalog surfaces like ADA Engage.</p>
          </div>
          <div className="card">
            <h3>Normalize for Supabase</h3>
            <p>Maps course titles, pricing, dates, formats, instructors, credits, and tags into a stable row shape.</p>
          </div>
          <div className="card">
            <h3>Render Cleanly on Site</h3>
            <p>Uses the synced database as the website source of truth so the UI stays current automatically.</p>
          </div>
        </div>
      </section>

      <section className="home-section">
        <div className="section-heading">
          <h2>Fresh Catalog Preview</h2>
          <Link href="/courses">See all courses</Link>
        </div>

        <div className="course-grid">
          {featuredCourses.map((course) => (
            <CourseCard key={course.id} course={course} />
          ))}
        </div>
      </section>
    </div>
  );
}
