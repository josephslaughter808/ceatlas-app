import Link from "next/link";
import HomeExplorer from "./components/home-explorer";
import HomeFeaturedCoursesClient from "./components/home-featured-courses-client";
import { getCatalogOverview, getFeaturedCourses } from "@/lib/courses";

export const revalidate = 600;

const pathways = [
  { icon: "01", title: "Choose your course", copy: "Search by profession, topic, credits, provider, or a destination you want to explore.", href: "/courses", cta: "Explore verified CE" },
  { icon: "02", title: "Build your escape", copy: "Add flight, hotel, and ground travel options to the same working itinerary.", href: "/travel", cta: "Plan your trip" },
  { icon: "03", title: "Learn, then roam", copy: "Use Trip Match to find dates and destinations that work for you and a travel partner.", href: "/match", cta: "Try Trip Match" },
];

export default async function HomePage() {
  const [statsResult, featuredResult] = await Promise.allSettled([getCatalogOverview(), getFeaturedCourses(3)]);
  const stats = statsResult.status === "fulfilled" ? statsResult.value : { courseCount: 0, providerCount: 0, formatCount: 40 };
  const featured = featuredResult.status === "fulfilled" ? featuredResult.value : [];

  return (
    <main className="atlas-home">
      <div className="container"><HomeExplorer /></div>

      <section className="container atlas-featured atlas-featured--intro">
        <div className="atlas-section__heading">
          <div><span className="atlas-kicker atlas-kicker--dark">Explore the catalogue</span><h2>Trade the conference room<br />for the coastline.</h2></div>
          <Link href="/courses" className="atlas-text-link">View all courses →</Link>
        </div>
        <p className="atlas-featured__lede">Browse real continuing education opportunities, compare the details, and start shaping a trip around the course that fits.</p>
      </section>

      <section className="atlas-catalogue-section">
        <div className="container atlas-featured">
          <div className="atlas-section__heading">
            <div><span className="atlas-kicker atlas-kicker--dark">{stats.courseCount ? `${stats.courseCount.toLocaleString()} courses indexed` : "Live CE catalogue"}</span><h2>Find the course that moves you.</h2></div>
            <Link href="/courses" className="atlas-text-link">View all courses →</Link>
          </div>
          <HomeFeaturedCoursesClient courses={featured} />
        </div>
      </section>

      <section className="container atlas-how-panel">
        <div className="atlas-how-panel__intro">
          <span className="atlas-kicker">One booking, zero juggling</span>
          <h2>The smarter way to earn your credits.</h2>
          <p>CEAtlas connects trusted continuing education with the practical details of getting there, so you can focus on learning—and living.</p>
        </div>
        <div className="atlas-how-panel__steps">
          {pathways.map((item) => (
            <Link href={item.href} key={item.title}>
              <span>{item.icon}</span><h3>{item.title}</h3><p>{item.copy}</p><strong>{item.cta} →</strong>
            </Link>
          ))}
        </div>
      </section>

      <section className="container atlas-provider-cta">
        <div><span>Are you a CE provider?</span><h2>Bring your courses to remarkable places.</h2></div>
        <a href="mailto:providers@ceatlas.co">Partner with CEAtlas</a>
      </section>
    </main>
  );
}
