import Link from "next/link";
import HomeStatsClient from "./components/home-stats-client";
import HomeFeaturedCoursesClient from "./components/home-featured-courses-client";
import DisciplineExplorer from "./components/discipline-explorer";
import { getCatalogOverview, getFeaturedCourses } from "@/lib/courses";
import { disciplines } from "@/lib/disciplines";

export const revalidate = 600;

export default async function HomePage() {
  const [statsResult, featuredCoursesResult] = await Promise.allSettled([
    getCatalogOverview(),
    getFeaturedCourses(6),
  ]);
  const stats = statsResult.status === "fulfilled"
    ? statsResult.value
    : { courseCount: 0, providerCount: 0, formatCount: 40 };
  const featuredCourses = featuredCoursesResult.status === "fulfilled"
    ? featuredCoursesResult.value
    : [];

  return (
    <div className="container home-page">
      <section className="hero">
        <div className="hero__copy">
          <p className="hero__eyebrow">Continuing education, mapped for you</p>
          <h1>Your profession. Your credits. One place to explore.</h1>
          <p>
            Choose your discipline to find continuing education by topic, provider, format, and location. Dentistry is
            live today, with more professional catalogs taking shape next.
          </p>
          <div className="hero__actions">
            <Link href="#disciplines" className="button">Choose your discipline</Link>
            <Link href="/match" className="button button--light">Match a CE trip</Link>
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

      <section className="home-section match-home-cta card">
        <div className="match-home-cta__visual" aria-hidden="true"><span>De</span><i /><span>Md</span></div>
        <div>
          <p className="hero__eyebrow hero__eyebrow--dark">Planning with a partner?</p>
          <h2>Find two careers in the same place at the same time.</h2>
          <p>Pair disciplines, compare overlapping CE windows, and turn separate professional requirements into one shared trip.</p>
        </div>
        <Link href="/match" className="button">Try CE Trip Match</Link>
      </section>

      <section className="home-section discipline-section" id="disciplines">
        <div className="section-heading section-heading--stacked">
          <p className="hero__eyebrow hero__eyebrow--dark">Explore by discipline</p>
          <h2>Start with the credentials that matter to your career.</h2>
          <p className="discipline-section__intro">
            Select a field to enter its CE space. Preview disciplines show what we’re building and let you help shape what launches next.
          </p>
        </div>
        <DisciplineExplorer disciplines={disciplines} />
      </section>

      <section className="home-section home-section--centered">
        <div className="section-heading section-heading--stacked">
          <p className="hero__eyebrow hero__eyebrow--dark">Built for working professionals</p>
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
          <h2>Get your CE in front of professionals who are actively looking.</h2>
          <p>
            If you run CE, conferences, or hands-on training, CEAtlas can help the right audience discover your
            courses, compare them confidently, and plan around your events.
          </p>
        </div>
        <Link href="/list-your-ce" className="button">List your CE</Link>
      </section>

      <section className="home-section">
        <div className="section-heading">
          <div>
            <p className="featured-discipline-label">Now exploring: Dentistry</p>
            <h2>Featured Dental CE Right Now</h2>
          </div>
          <Link href="/courses">See all courses</Link>
        </div>

        <HomeFeaturedCoursesClient courses={featuredCourses} />
      </section>
    </div>
  );
}
