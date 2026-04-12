import Link from "next/link";
import HomeStatsClient from "./components/home-stats-client";
import HomeFeaturedCoursesClient from "./components/home-featured-courses-client";
import { getCatalogOverview, getFeaturedCourses } from "@/lib/courses";

export const revalidate = 600;

export default async function HomePage() {
  const [stats, featuredCourses] = await Promise.all([
    getCatalogOverview(),
    getFeaturedCourses(6),
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

        <HomeStatsClient
          stats={{
            courses: stats.courseCount,
            providers: stats.providerCount,
            formatCount: stats.formatCount,
          }}
        />
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

        <HomeFeaturedCoursesClient courses={featuredCourses} />
      </section>
    </div>
  );
}
