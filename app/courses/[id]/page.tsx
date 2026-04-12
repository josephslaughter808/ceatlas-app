import { notFound } from "next/navigation";
import Link from "next/link";
import { getCourseById } from "@/lib/courses";
import CompareButton from "@/app/components/compare-button";
import CourseRatingPanel from "@/app/components/course-rating-panel";
import SaveCourseButton from "@/app/components/save-course-button";

type Params = Promise<{ id: string }>;

function formatDate(value: string | null | undefined) {
  if (!value) return "Not specified";

  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(parsed);
}

function renderList(items: string[] | null | undefined, fallback = "Not specified") {
  const lines = (items || [])
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) return <p>{fallback}</p>;

  if (lines.length <= 1) return <p>{lines[0]}</p>;

  return (
    <ul className="detail-list">
      {lines.map((line) => (
        <li key={line}>{line}</li>
      ))}
    </ul>
  );
}

function venueAddress(course: Awaited<ReturnType<typeof getCourseById>>) {
  if (!course) return "";
  if (course.next_session_address) return course.next_session_address;

  return [
    course.next_location,
    course.next_city,
    course.next_state,
    course.next_country,
  ].filter(Boolean).join(", ");
}

export default async function CourseDetailPage({
  params,
}: {
  params: Params;
}) {
  const { id } = await params;
  const course = await getCourseById(id);

  if (!course) {
    notFound();
  }

  const audience = course.topic_tags.filter((tag: string) => tag !== course.category);
  const providerLinks = [course.registration_url, course.source_url].filter(Boolean);
  const address = venueAddress(course);

  return (
    <div className="container course-detail">
      <Link href="/courses" className="course-back">← Back to courses</Link>

      <section className="course-detail__hero">
        <div className="course-detail__eyebrow">{course.provider_name || "Provider pending"}</div>
        <h1>{course.title || "Untitled course"}</h1>
        <p>{course.description || "Description coming soon."}</p>
      </section>

      <section className="course-detail__grid">
        <div className="card">
          <h2>Course Snapshot</h2>
          <div className="detail-pairs">
            <div><strong>Format</strong><span>{course.next_format || "Not specified"}</span></div>
            <div><strong>Type</strong><span>{course.category || "Not specified"}</span></div>
            <div><strong>Credits</strong><span>{course.credits_text || "Not specified"}</span></div>
            <div><strong>Price</strong><span>{course.detail_price || "Not specified"}</span></div>
            <div><strong>Start</strong><span>{formatDate(course.next_start_date)}</span></div>
            <div><strong>End</strong><span>{formatDate(course.next_end_date)}</span></div>
            <div><strong>Location</strong><span>{course.next_location || "Not specified"}</span></div>
            <div><strong>Venue Address</strong><span>{address || "Not specified"}</span></div>
            <div><strong>Provider</strong><span>{course.provider_name || "Not specified"}</span></div>
            <div><strong>Sessions</strong><span>{course.session_count || 0}</span></div>
          </div>
        </div>

        <div className="card">
          <h2>Topics & Audience</h2>
          <h3>Focus Areas</h3>
          {renderList(course.tags)}
          <h3>Audience</h3>
          {renderList(audience)}
          <h3>Provider Website</h3>
          {course.provider_website ? (
            <p>
              <a href={course.provider_website} target="_blank" rel="noreferrer">
                {course.provider_website}
              </a>
            </p>
          ) : (
            <p>Not specified</p>
          )}
        </div>
      </section>

      <section className="card course-detail__actions">
        <h2>Registration & Source</h2>
        <p>This course is synced from the provider catalog and linked back to the original source for registration.</p>
        <div className="course-detail__buttons">
          <SaveCourseButton courseId={course.id} />
          <CompareButton
            item={{
              id: course.id,
              kind: "course",
              title: course.title || "Untitled course",
              providerName: course.provider_name,
              topic: course.headline_topic || course.category,
              description: course.description,
              location: course.next_location,
              dateText: formatDate(course.next_start_date),
              priceText: course.detail_price,
              ratingAverage: course.rating_average,
              ratingCount: course.rating_count,
              details: [course.next_format || course.category || "Continuing education course"],
              href: `/courses/${course.id}`,
            }}
          />
          <Link className="button" href="/travel">
            Plan travel
          </Link>
          {course.registration_url ? (
            <a className="button" href={course.registration_url} target="_blank" rel="noreferrer">
              Go to provider page
            </a>
          ) : null}
          {course.source_url ? (
            <a href={course.source_url} target="_blank" rel="noreferrer">
              View provider catalog
            </a>
          ) : null}
        </div>
        {providerLinks.length === 0 ? <p>No provider links are available for this course yet.</p> : null}
      </section>

      <CourseRatingPanel
        courseId={course.id}
        average={course.rating_average}
        count={course.rating_count}
      />
    </div>
  );
}
