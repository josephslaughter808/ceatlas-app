import Link from "next/link";
import HomeExplorer from "./components/home-explorer";
import HomeFeaturedCoursesClient from "./components/home-featured-courses-client";
import { getCatalogOverview, getFeaturedCourses } from "@/lib/courses";

export const revalidate = 600;

const pathways = [
  { icon: "◎", title: "Explore the map", copy: "See in-person CE by city and turn the globe into your course catalog.", href: "/courses", cta: "Browse destinations" },
  { icon: "✈", title: "Build a CE trip", copy: "Pair a course with flight, hotel, and ground travel options in one itinerary.", href: "/travel", cta: "Plan your trip" },
  { icon: "⇄", title: "Match two careers", copy: "Find overlapping dates and destinations for you and a travel partner.", href: "/match", cta: "Try Trip Match" },
];

export default async function HomePage() {
  const [statsResult, featuredResult] = await Promise.allSettled([getCatalogOverview(), getFeaturedCourses(3)]);
  const stats = statsResult.status === "fulfilled" ? statsResult.value : { courseCount: 0, providerCount: 0, formatCount: 40 };
  const featured = featuredResult.status === "fulfilled" ? featuredResult.value : [];

  return (
    <main className="atlas-home">
      <div className="container"><HomeExplorer /></div>

      <section className="atlas-proof">
        <div className="container atlas-proof__inner">
          <div><strong>{stats.courseCount ? stats.courseCount.toLocaleString() : "1,000+"}</strong><span>courses indexed</span></div>
          <i />
          <div><strong>{stats.providerCount ? stats.providerCount.toLocaleString() : "250+"}</strong><span>trusted providers</span></div>
          <i />
          <div><strong>5</strong><span>professions and growing</span></div>
          <p>One search. A world of CE.</p>
        </div>
      </section>

      <section className="container atlas-section">
        <div className="atlas-section__heading">
          <div><span className="atlas-kicker atlas-kicker--dark">Everything for the journey</span><h2>From requirement to reservation.</h2></div>
          <p>Stop juggling course directories, maps, and travel tabs. CEAtlas keeps the whole decision in view.</p>
        </div>
        <div className="atlas-pathways">
          {pathways.map((item, index) => (
            <Link className={`atlas-pathway atlas-pathway--${index + 1}`} href={item.href} key={item.title}>
              <span className="atlas-pathway__icon">{item.icon}</span>
              <span className="atlas-pathway__number">0{index + 1}</span>
              <h3>{item.title}</h3><p>{item.copy}</p><strong>{item.cta} →</strong>
            </Link>
          ))}
        </div>
      </section>

      <section className="container atlas-featured">
        <div className="atlas-section__heading">
          <div><span className="atlas-kicker atlas-kicker--dark">Worth the trip</span><h2>Upcoming courses to put on your map.</h2></div>
          <Link href="/courses" className="atlas-text-link">View all courses →</Link>
        </div>
        <HomeFeaturedCoursesClient courses={featured} />
      </section>

      <section className="container atlas-final-cta">
        <div><span className="atlas-kicker">Your next CE trip starts here</span><h2>Credit earned.<br />World explored.</h2></div>
        <div><p>Save courses, compare options, and build the full journey when you’re ready.</p><Link className="atlas-cta-light" href="/courses">Start exploring <span>→</span></Link></div>
      </section>
    </main>
  );
}
