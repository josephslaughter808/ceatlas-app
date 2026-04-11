import { notFound } from "next/navigation";
import Link from "next/link";
import { getEventById } from "@/lib/courses";

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
  const lines = (items || []).map((line) => line.trim()).filter(Boolean);

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

export default async function EventDetailPage({ params }: { params: Params }) {
  const { id } = await params;
  const event = await getEventById(id);

  if (!event) {
    notFound();
  }

  const audience = event.topic_tags.filter((tag: string) => tag !== event.category);

  return (
    <div className="container course-detail">
      <Link href="/events" className="course-back">← Back to events</Link>

      <section className="course-detail__hero">
        <div className="course-detail__eyebrow">{event.provider_name || "Event organizer"}</div>
        <h1>{event.title || "Untitled event"}</h1>
        <p>{event.description || "Event description coming soon."}</p>
      </section>

      <section className="launch-note">
        <strong>CE status:</strong>
        <span>This listing is stored in the events section because CE credit has not been verified yet.</span>
      </section>

      <section className="course-detail__grid">
        <div className="card">
          <h2>Event Snapshot</h2>
          <div className="detail-pairs">
            <div><strong>Format</strong><span>{event.next_format || "Not specified"}</span></div>
            <div><strong>Type</strong><span>{event.category || "Not specified"}</span></div>
            <div><strong>Credits</strong><span>Not verified</span></div>
            <div><strong>Price</strong><span>{event.detail_price || "Not specified"}</span></div>
            <div><strong>Start</strong><span>{formatDate(event.next_start_date)}</span></div>
            <div><strong>End</strong><span>{formatDate(event.next_end_date)}</span></div>
            <div><strong>Location</strong><span>{event.next_location || "Not specified"}</span></div>
            <div><strong>Organizer</strong><span>{event.provider_name || "Not specified"}</span></div>
          </div>
        </div>

        <div className="card">
          <h2>Topics & Context</h2>
          <h3>Tags</h3>
          {renderList(event.tags)}
          <h3>Audience</h3>
          {renderList(audience)}
          <h3>Organizer Website</h3>
          {event.provider_website ? (
            <p>
              <a href={event.provider_website} target="_blank" rel="noreferrer">
                {event.provider_website}
              </a>
            </p>
          ) : (
            <p>Not specified</p>
          )}
        </div>
      </section>

      <section className="card course-detail__actions">
        <h2>Verify With Organizer</h2>
        <p>Before treating this as CE, confirm credit, accreditation, fees, and registration details directly with the organizer.</p>
        <div className="course-detail__buttons">
          {event.registration_url ? (
            <a className="button" href={event.registration_url} target="_blank" rel="noreferrer">
              Open event page
            </a>
          ) : null}
          {event.source_url ? (
            <a href={event.source_url} target="_blank" rel="noreferrer">
              View source listing
            </a>
          ) : null}
        </div>
      </section>
    </div>
  );
}
