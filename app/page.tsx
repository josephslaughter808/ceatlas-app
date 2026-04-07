import CourseCard from "./components/coursecard";
import { getCatalogOverview, getFeaturedCourses } from "@/lib/courses";
import { getCatalogStats } from "@/lib/db";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [featuredCourses, overview, stats] = await Promise.all([
    getFeaturedCourses(6),
    getCatalogOverview(),
    getCatalogStats(),
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
            <Link href="/list-your-ce" className="button button--light">List your CE</Link>
          </div>
        </div>

        <div className="hero__stats">
          <div className="card">
            <h2>{stats.courses}</h2>
            <p>Courses ready for the live catalog</p>
          </div>
          <div className="card">
            <h2>{stats.providers}</h2>
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

      <section className="home-section launch-cta card">
        <div>
          <p className="hero__eyebrow">Beta Launch</p>
          <h2>CE providers can help us clean up the catalog faster.</h2>
          <p>
            If you run dental CE, conferences, cruises, or hands-on training, send us the official catalog link.
            We are prioritizing verified provider pages and beta sponsorship conversations before launch.
          </p>
        </div>
        <Link href="/list-your-ce" className="button">List your CE</Link>
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
