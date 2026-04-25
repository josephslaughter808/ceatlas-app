import Link from "next/link";
import CompareButton from "./compare-button";
import SaveCourseButton from "./save-course-button";
import TripCartButton from "./trip-cart-button";
import { getCourseCardLocation } from "@/lib/course-location";

type Course = {
  id: string;
  provider_name: string | null;
  title: string | null;
  description: string | null;
  next_location: string | null;
  next_city?: string | null;
  next_start_date: string | null;
  next_end_date: string | null;
  next_format: string | null;
  credits_text: string | null;
  price_text: string | null;
  price: number | null;
  category: string | null;
  headline_topic?: string | null;
  card_price?: string | null;
  instructor_display?: string | null;
  rating_average?: number | null;
  rating_count?: number | null;
};

function shortText(value: string | null | undefined, max = 180) {
  if (!value) return '';
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

export default function CourseCard({ course }: { course: Course }) {
  const details = [
    course.provider_name,
    course.next_format || course.category,
    course.credits_text ? `${course.credits_text} credits` : null,
  ].filter(Boolean).join(' • ');

  const nextSession = course.next_start_date || 'Available now';
  const location = getCourseCardLocation({
    next_location: course.next_location,
    next_city: course.next_city,
  });
  const price = course.card_price || null;
  const rating = typeof course.rating_average === "number" ? `${course.rating_average.toFixed(1)}★` : null;
  const ratingCount = course.rating_count || 0;

  return (
    <article className="course-card">
      <div className="course-card__content">
        <div className="course-card__header">
          <div className="course-card__eyebrow-row">
            <span className="course-card__eyebrow">{course.provider_name || 'Provider pending'}</span>
            {course.headline_topic ? (
              <span className="course-card__topic">{course.headline_topic}</span>
            ) : null}
          </div>
        </div>

        <div className="course-card__main">
          <div className="course-card__copy">
            <h2 className="course-card__title">{course.title || 'Untitled course'}</h2>
            {course.instructor_display ? (
              <p className="course-card__instructor">{course.instructor_display}</p>
            ) : null}
            <p className="course-card__details">{details || 'Continuing education course'}</p>
          </div>

          <div className="course-card__meta">
            <span><strong>When:</strong> {nextSession}</span>
            <span><strong>Where:</strong> {shortText(location, 80)}</span>
            {price ? <span><strong>Price:</strong> {shortText(price, 80)}</span> : null}
            {rating ? <span><strong>Rating:</strong> {rating} ({ratingCount})</span> : null}
          </div>
        </div>

        <p className="course-card__description">{shortText(course.description, 220)}</p>
      </div>

      <div className="course-card__actions">
        <div className="course-card__quick-actions">
          <TripCartButton courseId={course.id} />
          <SaveCourseButton courseId={course.id} />
        </div>
        <CompareButton
          item={{
            id: course.id,
            kind: "course",
            title: course.title || "Untitled course",
            providerName: course.provider_name,
            topic: course.headline_topic || course.category,
            description: course.description,
            location: location,
            dateText: nextSession,
            priceText: price,
            ratingAverage: course.rating_average,
            ratingCount: course.rating_count,
            details: [details],
            href: `/courses/${course.id}`,
          }}
        />
        <Link href={`/courses/${course.id}`} className="button">
          View Details
        </Link>
      </div>
    </article>
  );
}
