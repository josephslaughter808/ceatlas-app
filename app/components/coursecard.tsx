import Link from "next/link";
import CompareButton from "./compare-button";
import SaveCourseButton from "./save-course-button";
import TripCartButton from "./trip-cart-button";
import { getCourseCardLocation } from "@/lib/course-location";
import { formatCreditsForDisplay } from "@/lib/course-credits";

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
  credits?: number | null;
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

function formatCourseDate(value: string | null | undefined) {
  const text = String(value || '').trim();
  if (!text) return 'Available now';

  const isoDate = text.match(/^\d{4}-\d{2}-\d{2}$/)?.[0];
  if (!isoDate) return text;

  const parsed = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return text;

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(parsed);
}

function formatCourseDateRange(start: string | null | undefined, end: string | null | undefined) {
  const startLabel = formatCourseDate(start);
  if (!end || end === start) return startLabel;

  const endLabel = formatCourseDate(end);
  return `${startLabel} – ${endLabel}`;
}

export default function CourseCard({ course }: { course: Course }) {
  const details = [
    course.provider_name,
    course.next_format || course.category,
  ].filter(Boolean).join(' • ');
  const credits = formatCreditsForDisplay(course.credits_text, course.credits);

  const nextSession = formatCourseDateRange(course.next_start_date, course.next_end_date);
  const location = getCourseCardLocation({
    next_location: course.next_location,
    next_city: course.next_city,
  });
  const price = course.card_price || null;
  const rating = typeof course.rating_average === "number" ? `${course.rating_average.toFixed(1)}★` : null;
  const ratingCount = course.rating_count || 0;

  return (
    <article className="course-card course-catalog-row">
      <div className="course-catalog-row__course">
        <span className="course-catalog-row__accent" aria-hidden="true" />
        <div className="course-card__eyebrow-row">
          <span className="course-card__eyebrow">{course.headline_topic || course.category || 'Continuing education'}</span>
          <span className="course-card__topic">{credits || 'Credits not provided'}</span>
        </div>
        <h2 className="course-card__title">{course.title || 'Untitled course'}</h2>
        <p className="course-card__details">
          {course.provider_name || 'Provider pending'}
          {course.instructor_display ? `  •  ${shortText(course.instructor_display, 52)}` : ''}
        </p>
      </div>

      <div className="course-catalog-row__destination">
        <strong><span aria-hidden="true">⌖</span>{shortText(location, 52)}</strong>
        <span><span aria-hidden="true">□</span>{nextSession}</span>
      </div>

      <div className="course-catalog-row__details">
        <strong><span className="course-catalog-row__status" aria-hidden="true" />{course.next_format || 'Format pending'}</strong>
        <span>{rating ? `${rating} · ${ratingCount} reviews` : details || 'Course details'}</span>
        <div className="course-catalog-row__tools">
          <TripCartButton courseId={course.id} />
          <SaveCourseButton courseId={course.id} />
        </div>
      </div>

      <div className="course-catalog-row__price">
        <strong>{price ? shortText(price, 42) : 'See provider'}</strong>
        <span>{price ? 'course price' : 'for pricing'}</span>
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
        <Link href={`/courses/${course.id}`} className="course-catalog-row__arrow" aria-label={`View ${course.title || 'course'} details`}>
          →
        </Link>
      </div>
    </article>
  );
}
