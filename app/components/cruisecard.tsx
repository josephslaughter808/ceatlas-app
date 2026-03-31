import CompareButton from "./compare-button";

type Cruise = {
  id: string;
  provider_name: string;
  title: string;
  description: string;
  topic: string;
  start_date: string;
  end_date: string;
  ship: string;
  itinerary: string;
  credits_text: string;
  audience: string;
  instructor_display: string;
  card_price: string;
  location: string;
  url: string;
  rating_average?: number | null;
  rating_count?: number | null;
};

function shortText(value: string | null | undefined, max = 180) {
  if (!value) return '';
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

export default function CruiseCard({ cruise }: { cruise: Cruise }) {
  const details = [
    cruise.provider_name,
    cruise.credits_text,
    cruise.ship,
  ].filter(Boolean).join(' • ');

  const nextDate = cruise.start_date || 'Dates pending';
  const location = cruise.location || cruise.itinerary || 'Itinerary pending';
  const rating = typeof cruise.rating_average === "number" ? `${cruise.rating_average.toFixed(1)}★` : null;

  return (
    <article className="course-card">
      <div className="course-card__content">
        <div className="course-card__header">
          <div className="course-card__eyebrow-row">
            <span className="course-card__eyebrow">{cruise.provider_name}</span>
            {cruise.topic ? (
              <span className="course-card__topic">{cruise.topic}</span>
            ) : null}
          </div>
        </div>

        <div className="course-card__main">
          <div className="course-card__copy">
            <h2 className="course-card__title">{cruise.title}</h2>
            {cruise.instructor_display ? (
              <p className="course-card__instructor">{cruise.instructor_display}</p>
            ) : null}
            <p className="course-card__details">{details || 'Cruise CE program'}</p>
          </div>

          <div className="course-card__meta">
            <span><strong>When:</strong> {nextDate}</span>
            <span><strong>Where:</strong> {shortText(location, 90)}</span>
            {cruise.card_price ? <span><strong>Price:</strong> {shortText(cruise.card_price, 80)}</span> : null}
            {rating ? <span><strong>Rating:</strong> {rating} ({cruise.rating_count || 0})</span> : null}
          </div>
        </div>

        <p className="course-card__description">{shortText(cruise.description, 240)}</p>
      </div>

      <div className="course-card__actions">
        <CompareButton
          item={{
            id: cruise.id,
            kind: "cruise",
            title: cruise.title,
            providerName: cruise.provider_name,
            topic: cruise.topic,
            description: cruise.description,
            location,
            dateText: nextDate,
            priceText: cruise.card_price,
            ratingAverage: cruise.rating_average,
            ratingCount: cruise.rating_count,
            details: [details],
            href: cruise.url,
          }}
        />
        <a href={cruise.url} className="button" target="_blank" rel="noreferrer">
          View Cruise
        </a>
      </div>
    </article>
  );
}
