import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { disciplines, getDiscipline } from "@/lib/disciplines";
import { getDisciplineIcon } from "@/lib/discipline-logo";
import { disciplineProofGeneratedAt, getDisciplineProofCourses } from "@/lib/discipline-proof-courses";
import { physicianCatalogCount, physicianCatalogFacets, physicianCatalogGeneratedAt, searchPhysicianCourses } from "@/lib/physician-courses";
import { PhysicianCatalogClient } from "@/app/components/physician-catalog-client";
import { searchVeterinaryCourses, veterinaryCatalogCount, veterinaryCatalogFacets, veterinaryCatalogGeneratedAt } from "@/lib/veterinary-courses";
import { lawCatalogCount, lawCatalogFacets, lawCatalogGeneratedAt, searchLawCourses } from "@/lib/law-courses";
import { nursingCatalogCount, nursingCatalogFacets, nursingCatalogGeneratedAt, searchNursingCourses } from "@/lib/nursing-courses";

type DisciplinePageProps = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return disciplines.filter((discipline) => !discipline.live).map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: DisciplinePageProps): Promise<Metadata> {
  const discipline = getDiscipline((await params).slug);
  if (!discipline) return {};
  return {
    title: `${discipline.name} Continuing Education`,
    description: discipline.slug === "medicine"
      ? "Search 10,000 current, accredited physician CME activities by specialty, format, credit, and availability."
      : discipline.slug === "veterinary" ? "Search current AAVSB RACE-approved veterinary continuing education."
      : discipline.slug === "law" ? "Search current continuing legal education by practice area and format."
      : discipline.slug === "nursing" ? `Search ${nursingCatalogCount.toLocaleString()} current, board-approved nursing continuing education activities.`
      : `Explore the upcoming CEAtlas ${discipline.name} continuing education space.`,
    icons: {
      icon: [{ url: getDisciplineIcon(discipline.slug), sizes: "512x512", type: "image/png" }],
      shortcut: [{ url: getDisciplineIcon(discipline.slug), type: "image/png" }],
    },
  };
}

export default async function DisciplinePage({ params }: DisciplinePageProps) {
  const discipline = getDiscipline((await params).slug);
  if (!discipline) notFound();
  if (discipline.live) redirect("/courses");
  const proofCourses = getDisciplineProofCourses(discipline.slug);
  const isMedicine = discipline.slug === "medicine";
  const isVeterinary = discipline.slug === "veterinary";
  const isLaw = discipline.slug === "law";
  const isNursing = discipline.slug === "nursing";
  const physicianInitial = isMedicine ? {
    ...searchPhysicianCourses({ pageSize: 12 }),
    facets: physicianCatalogFacets,
    generatedAt: physicianCatalogGeneratedAt,
  } : null;
  const veterinaryInitial = isVeterinary ? { ...searchVeterinaryCourses({ pageSize: 12 }), facets: veterinaryCatalogFacets, generatedAt: veterinaryCatalogGeneratedAt } : null;
  const lawInitial = isLaw ? { ...searchLawCourses({ pageSize: 12 }), facets: lawCatalogFacets, generatedAt: lawCatalogGeneratedAt } : null;
  const nursingInitial = isNursing ? { ...searchNursingCourses({ pageSize: 12 }), facets: nursingCatalogFacets, generatedAt: nursingCatalogGeneratedAt } : null;
  const refreshed = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(disciplineProofGeneratedAt));

  return (
    <div className="container discipline-page">
      <Link href="/disciplines" className="discipline-page__back">← All disciplines</Link>
      <section className="discipline-page__hero" style={{ "--discipline-accent": discipline.accent } as React.CSSProperties}>
        <div>
          <p className="hero__eyebrow">{discipline.credential} on CEAtlas</p>
          <h1>{isMedicine ? "Explore 10,000 accredited physician CME activities." : isVeterinary ? `Explore ${veterinaryCatalogCount.toLocaleString()} current RACE-approved veterinary CE activities.` : isLaw ? `Explore ${lawCatalogCount.toLocaleString()} current CLE courses.` : isNursing ? `Explore ${nursingCatalogCount.toLocaleString()} current board-approved nursing CE activities.` : `Explore real ${discipline.name} CE.`}</h1>
          <p>
            {isMedicine
              ? "Search active physician CME from accredited providers, organized by specialty, format, credit, and availability."
              : isVeterinary ? "Search verified veterinary education for veterinarians and veterinary technicians, plus destination and cruise CE."
              : isLaw ? "Search currently published continuing legal education by practice area, provider, and format. Credit eligibility remains jurisdiction-specific."
              : isNursing ? "Search currently published continuing education pre-approved for Florida Registered Nurses, organized by clinical topic, provider, format, and availability."
              : "This early proof catalog is already pulling live listings from public provider sources. Browse a few real examples while we build the full discovery experience."}
          </p>
          <div className="hero__actions">
            <Link href={`/match?first=${discipline.slug}&second=dentistry`} className="button">Try this discipline in Trip Match</Link>
            <Link href="/list-your-ce" className="button button--light">List CE in this discipline</Link>
          </div>
        </div>
        <div className="discipline-page__panel">
          <p className="discipline-card__credential">{isMedicine ? "Live physician catalog" : isVeterinary ? "Live veterinary catalog" : isLaw ? "Live legal catalog" : isNursing ? "Live nursing catalog" : "Working proof of concept"}</p>
          <h2>{isMedicine ? physicianCatalogCount.toLocaleString() : isVeterinary ? veterinaryCatalogCount.toLocaleString() : isLaw ? lawCatalogCount.toLocaleString() : isNursing ? nursingCatalogCount.toLocaleString() : proofCourses.length} current listings found</h2>
          <ul>
            {discipline.highlights.map((highlight) => <li key={highlight}>{highlight}</li>)}
            <li>Credits, price, format, and location</li>
            <li>Saved courses and travel planning</li>
          </ul>
        </div>
      </section>

      {physicianInitial ? <PhysicianCatalogClient initial={physicianInitial} /> : veterinaryInitial ? <PhysicianCatalogClient initial={veterinaryInitial} discipline="veterinary" /> : lawInitial ? <PhysicianCatalogClient initial={lawInitial} discipline="law" /> : nursingInitial ? <PhysicianCatalogClient initial={nursingInitial} discipline="nursing" /> : <section className="discipline-proof-catalog">
        <div className="discipline-proof-catalog__heading">
          <div>
            <p className="hero__eyebrow hero__eyebrow--dark">Live scraper results</p>
            <h2>A first look at the catalog.</h2>
            <p>These listings were collected from public CE provider pages and link back to the provider for current details and registration.</p>
          </div>
          <span className="discipline-proof-catalog__refresh">Refreshed {refreshed}</span>
        </div>
        <div className="discipline-proof-grid">
          {proofCourses.map((course) => (
            <article className="discipline-proof-card card" key={course.id}>
              <div className="discipline-proof-card__badges">
                <span>{course.status}</span>
                <span>{course.format}</span>
              </div>
              <div>
                <p className="discipline-proof-card__provider">{course.provider}</p>
                <h3>{course.title}</h3>
                <p>{course.description}</p>
              </div>
              <dl>
                <div><dt>Credit</dt><dd>{course.credits}</dd></div>
                <div><dt>{course.start_date ? "Date" : "Access"}</dt><dd>{course.start_date ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${course.start_date}T00:00:00Z`)) : "Available now"}</dd></div>
                <div><dt>Where</dt><dd>{course.location}</dd></div>
              </dl>
              <a className="discipline-proof-card__link" href={course.url} target="_blank" rel="noreferrer">View on provider site <span aria-hidden="true">↗</span></a>
            </article>
          ))}
        </div>
        <p className="discipline-proof-catalog__note">Proof-stage data: always confirm eligibility, accreditation, dates, and credit directly with the provider.</p>
      </section>}

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
