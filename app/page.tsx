import CourseCard from "./components/coursecard";
import { getCatalogOverview, getFeaturedCourses, type CourseRecord } from "@/lib/courses";
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
          <p className="hero__eyebrow">Dental CE, Conferences, Travel</p>
          <h1>Find the right CE faster, and plan the trip around it.</h1>
          <p>
            CEAtlas helps dentists compare continuing education courses, conferences, cruises, and hands-on trainings
            in one place. Search by topic, provider, format, and location, then save the options that fit your goals.
          </p>
          <div className="hero__actions">
            <Link href="/courses" className="button">Browse Courses</Link>
            <Link href="/packages" className="button button--light">Explore Packages</Link>
          </div>
        </div>

        <div className="hero__stats">
          <div className="card hero-stat-card">
            <p className="hero-stat-card__value">{stats.courses.toLocaleString()}</p>
            <p className="hero-stat-card__label">Courses and events to compare</p>
          </div>
          <div className="card hero-stat-card">
            <p className="hero-stat-card__value">{stats.providers.toLocaleString()}</p>
            <p className="hero-stat-card__label">Providers, societies, and event hosts</p>
          </div>
          <div className="card hero-stat-card">
            <p className="hero-stat-card__value">{overview.formatCount.toLocaleString()}</p>
            <p className="hero-stat-card__label">Formats to browse, compare, and plan around</p>
          </div>
        </div>
      </section>

      <section className="home-section home-section--centered">
        <div className="section-heading section-heading--stacked">
          <p className="hero__eyebrow hero__eyebrow--dark">Why Dentists Use CEAtlas</p>
          <h2>Built to make CE discovery feel clear, fast, and worth your time.</h2>
        </div>
        <div className="home-grid">
          <div className="card home-feature-card">
            <h3>Compare Options Side by Side</h3>
            <p>See topics, providers, prices, locations, and formats together instead of bouncing between dozens of provider websites.</p>
          </div>
          <div className="card home-feature-card">
            <h3>Plan CE Around Real Life</h3>
            <p>Use CEAtlas to narrow choices by specialty, save favorites, and build a trip around conferences, cruises, and destination courses.</p>
          </div>
          <div className="card home-feature-card">
            <h3>Stay Focused on What Matters</h3>
            <p>Spend less time hunting through scattered calendars and more time choosing the CE that actually fits your practice and goals.</p>
          </div>
        </div>
      </section>

      <section className="home-section launch-cta card">
        <div>
          <p className="hero__eyebrow">For Providers</p>
          <h2>Get your CE in front of dentists who are actively looking.</h2>
          <p>
            If you run dental CE, conferences, cruises, or hands-on training, CEAtlas can help more dentists discover
            your courses, compare them confidently, and plan travel around your events.
          </p>
        </div>
        <Link href="/list-your-ce" className="button">List your CE</Link>
      </section>

      <section className="home-section">
        <div className="section-heading">
          <h2>Featured CE Right Now</h2>
          <Link href="/courses">See all courses</Link>
        </div>

        <div className="course-grid">
          {featuredCourses.map((course: CourseRecord) => (
            <CourseCard key={course.id} course={course} />
          ))}
        </div>
      </section>
    </div>
  );
}
