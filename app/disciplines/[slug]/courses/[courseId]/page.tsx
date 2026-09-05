import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import CourseTravelPreview from "@/app/components/course-travel-preview";
import { catalogDisciplines, findCatalogCourse, type CatalogDiscipline } from "@/lib/catalog-course-detail";

type Params = Promise<{ slug: string; courseId: string }>;

function isDiscipline(value: string): value is CatalogDiscipline {
  return catalogDisciplines.includes(value as CatalogDiscipline);
}

function formatDate(value: string) {
  if (!value) return "Available now";
  return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug, courseId } = await params;
  const course = isDiscipline(slug) ? findCatalogCourse(slug, courseId) : null;
  return { title: course ? `${course.title} | CEAtlas` : "Course | CEAtlas" };
}

export default async function CatalogCourseDetail({ params }: { params: Params }) {
  const { slug, courseId } = await params;
  if (!isDiscipline(slug)) notFound();
  const course = findCatalogCourse(slug, courseId);
  if (!course) notFound();
  const isOnline = /online|virtual|webinar|on[ -]?demand|self[ -]?paced/i.test(`${course.location} ${course.format}`);
  const creditName = slug === "law" ? "CLE credit" : slug === "medicine" ? "CME credit" : "CE credit";

  return (
    <div className="container course-detail catalog-course-detail">
      <Link href={`/disciplines/${slug}`} className="course-back">← Back to {slug}</Link>
      <section className="course-detail__hero">
        <div className="course-detail__eyebrow">{course.provider}</div>
        <h1>{course.title}</h1>
        <p>{course.description || `Accredited ${creditName} activity from ${course.provider}.`}</p>
      </section>
      <section className="course-detail__grid">
        <div className="card"><h2>Course snapshot</h2><div className="detail-pairs">
          <div><strong>Credit</strong><span>{course.credits_text || "Confirm with provider"}</span></div>
          <div><strong>Format</strong><span>{course.format || course.course_type}</span></div>
          <div><strong>Starts</strong><span>{formatDate(course.start_date)}</span></div>
          <div><strong>Available through</strong><span>{formatDate(course.end_date)}</span></div>
          <div><strong>Location</strong><span>{course.location || "See provider"}</span></div>
          <div><strong>Price</strong><span>{course.price || "See provider"}</span></div>
        </div></div>
        <div className="card"><h2>Accreditation & fit</h2><div className="detail-pairs">
          <div><strong>Accreditation</strong><span>{course.accreditation || "Provider-published accredited activity"}</span></div>
          <div><strong>Discipline</strong><span>{slug === "medicine" ? "Physician medicine" : slug}</span></div>
          <div><strong>Topic</strong><span>{course.topic || "General"}</span></div>
          <div><strong>Audience</strong><span>{course.audience || "Licensed professionals"}</span></div>
        </div></div>
      </section>
      {!isOnline && course.location && course.start_date ? <CourseTravelPreview courseId={courseId} title={course.title} location={course.location} startDate={course.start_date} endDate={course.end_date || null} /> : null}
      <section className="card course-detail__actions">
        <h2>Registration</h2>
        <p>CEAtlas helps you evaluate the course and plan the trip. Registration is completed with the accredited provider while direct marketplace licensing is being established.</p>
        <div className="course-detail__buttons"><a className="button" href={course.url} target="_blank" rel="noreferrer">Continue to accredited provider ↗</a><Link href={`/disciplines/${slug}`}>Keep browsing</Link></div>
      </section>
    </div>
  );
}
