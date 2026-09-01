import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { disciplines, getDiscipline } from "@/lib/disciplines";

type DisciplinePageProps = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return disciplines.filter((discipline) => !discipline.live).map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: DisciplinePageProps): Promise<Metadata> {
  const discipline = getDiscipline((await params).slug);
  if (!discipline) return {};
  return {
    title: `${discipline.name} Continuing Education`,
    description: `Explore the upcoming CEAtlas ${discipline.name} continuing education space.`,
  };
}

export default async function DisciplinePage({ params }: DisciplinePageProps) {
  const discipline = getDiscipline((await params).slug);
  if (!discipline) notFound();
  if (discipline.live) redirect("/courses");

  return (
    <div className="container discipline-page">
      <Link href="/disciplines" className="discipline-page__back">← All disciplines</Link>
      <section className="discipline-page__hero" style={{ "--discipline-accent": discipline.accent } as React.CSSProperties}>
        <div>
          <p className="hero__eyebrow">{discipline.credential} on CEAtlas</p>
          <h1>{discipline.name} CE is coming into focus.</h1>
          <p>
            We’re building a dedicated place to discover, compare, save, and plan continuing education for
            {` ${discipline.name.toLowerCase()} professionals.`}
          </p>
          <div className="hero__actions">
            <Link href={`/match?first=${discipline.slug}&second=dentistry`} className="button">Try this discipline in Trip Match</Link>
            <Link href="/list-your-ce" className="button button--light">List CE in this discipline</Link>
          </div>
        </div>
        <div className="discipline-page__panel">
          <p className="discipline-card__credential">Planned exploration</p>
          <h2>What you’ll be able to compare</h2>
          <ul>
            {discipline.highlights.map((highlight) => <li key={highlight}>{highlight}</li>)}
            <li>Credits, price, format, and location</li>
            <li>Saved courses and travel planning</li>
          </ul>
        </div>
      </section>

      <section className="discipline-preview-flow">
        <div className="section-heading section-heading--stacked"><p className="hero__eyebrow hero__eyebrow--dark">The planned experience</p><h2>More than a list of courses.</h2></div>
        <div className="discipline-preview-flow__grid">
          <article className="card"><span>01</span><h3>Browse in your language</h3><p>Filter by {discipline.credential}, topic, provider, delivery format, and location.</p></article>
          <article className="card"><span>02</span><h3>Understand the fit</h3><p>Compare credit details and renewal context while keeping provider verification front and center.</p></article>
          <article className="card"><span>03</span><h3>Connect the trip</h3><p>Match this field with a partner’s discipline, save the best overlap, and plan travel together.</p></article>
        </div>
      </section>

      <section className="discipline-page__next card">
        <div>
          <p className="hero__eyebrow hero__eyebrow--dark">Help shape the catalog</p>
          <h2>Know a provider we should include?</h2>
          <p>Send us the organization or catalog and we’ll use it to prioritize this discipline’s rollout.</p>
        </div>
        <a href={`mailto:providers@ceatlas.co?subject=${encodeURIComponent(`${discipline.name} provider suggestion`)}`} className="button">
          Suggest a provider
        </a>
      </section>
    </div>
  );
}
