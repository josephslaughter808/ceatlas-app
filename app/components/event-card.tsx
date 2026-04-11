import Link from "next/link";
import type { EventRecord } from "@/lib/courses";

function shortText(value: string | null | undefined, max = 180) {
  if (!value) return "";
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

export default function EventCard({ event }: { event: EventRecord }) {
  const details = [
    event.provider_name,
    event.next_format || event.category,
    "CE credit not verified",
  ].filter(Boolean).join(" • ");

  const nextSession = event.next_start_date || "Date not specified";
  const location = event.next_location || "Location not specified";

  return (
    <article className="course-card">
      <div className="course-card__content">
        <div className="course-card__header">
          <div className="course-card__eyebrow-row">
            <span className="course-card__eyebrow">{event.provider_name || "Event organizer"}</span>
            {event.headline_topic ? (
              <span className="course-card__topic">{event.headline_topic}</span>
            ) : null}
          </div>
        </div>

        <div className="course-card__main">
          <div className="course-card__copy">
            <h2 className="course-card__title">{event.title || "Untitled event"}</h2>
            <p className="course-card__details">{details}</p>
          </div>

          <div className="course-card__meta">
            <span><strong>When:</strong> {nextSession}</span>
            <span><strong>Where:</strong> {shortText(location, 80)}</span>
            <span><strong>Status:</strong> Verify CE credit with organizer</span>
          </div>
        </div>

        <p className="course-card__description">{shortText(event.description, 220)}</p>
      </div>

      <div className="course-card__actions">
        <Link href={`/events/${event.id}`} className="button">
          View Event
        </Link>
        {event.registration_url ? (
          <a href={event.registration_url} target="_blank" rel="noreferrer" className="button button-secondary">
            Open Source
          </a>
        ) : null}
      </div>
    </article>
  );
}
