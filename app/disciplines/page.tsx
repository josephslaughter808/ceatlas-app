import type { Metadata } from "next";
import Link from "next/link";
import DisciplineExplorer from "../components/discipline-explorer";
import { disciplines } from "@/lib/disciplines";

export const metadata: Metadata = {
  title: "Explore CE by Discipline",
  description: "Explore the professional disciplines CEAtlas serves today and the continuing education catalogs being built next.",
};

export default function DisciplinesPage() {
  return (
    <div className="container disciplines-page">
      <section className="disciplines-hero">
        <div>
          <p className="hero__eyebrow">One platform, many professions</p>
          <h1>Every discipline gets its own CE lens.</h1>
          <p>Requirements, credit language, providers, and specialties vary by profession. CEAtlas keeps those details distinct while connecting discovery, comparison, timing, place, and travel.</p>
        </div>
        <div className="disciplines-hero__proof"><strong>9</strong><span>discipline experiences mapped</span><strong>1</strong><span>live dental catalog proving the model</span></div>
      </section>
      <section className="discipline-section">
        <div className="section-heading section-heading--stacked"><p className="hero__eyebrow hero__eyebrow--dark">Choose a field</p><h2>See the experience through a professional’s eyes.</h2><p className="discipline-section__intro">Dentistry is live. Every preview shows the planned taxonomy and connects into the cross-discipline trip experience.</p></div>
        <DisciplineExplorer disciplines={disciplines} />
      </section>
      <section className="discipline-platform-story">
        <article className="card"><span>Discover</span><h3>Profession-aware catalogs</h3><p>Relevant providers, credit types, topics, and renewal context—not one undifferentiated event directory.</p></article>
        <article className="card"><span>Connect</span><h3>Cross-discipline matching</h3><p>Find shared programs or separate courses that overlap by destination and date.</p></article>
        <article className="card"><span>Plan</span><h3>One trip workspace</h3><p>Save the education, compare choices, and plan travel around the decision.</p></article>
      </section>
      <section className="vision-bridge card"><div><p className="hero__eyebrow hero__eyebrow--dark">See the whole product</p><h2>Follow the CEAtlas journey from search to shared trip.</h2></div><Link href="/how-it-works" className="button">How CEAtlas works</Link></section>
    </div>
  );
}
