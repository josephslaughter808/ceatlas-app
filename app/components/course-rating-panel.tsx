"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "./auth-provider";

function StarField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="rating-field">
      <span>{label}</span>
      <div className="rating-stars">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            className={star <= value ? "rating-star rating-star--active" : "rating-star"}
            onClick={() => onChange(star)}
          >
            ★
          </button>
        ))}
      </div>
    </div>
  );
}

export default function CourseRatingPanel({
  courseId,
  average,
  count,
}: {
  courseId: string;
  average: number | null | undefined;
  count: number | null | undefined;
}) {
  const { user, session } = useAuth();
  const [overall, setOverall] = useState(5);
  const [content, setContent] = useState(5);
  const [instructor, setInstructor] = useState(5);
  const [logistics, setLogistics] = useState(5);
  const [value, setValue] = useState(5);
  const [comment, setComment] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!session?.access_token) return;

    setSubmitting(true);
    setMessage(null);

    try {
      const response = await fetch("/api/ratings/course", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          courseId,
          overallRating: overall,
          contentRating: content,
          instructorRating: instructor,
          logisticsRating: logistics,
          valueRating: value,
          comment,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Unable to save rating.");
      }

      setMessage("Rating saved. Refresh the page in a moment to see the updated average.");
      setComment("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save rating.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="card course-rating-panel">
      <div className="course-rating-panel__head">
        <div>
          <h2>Course Rating</h2>
          <p>{typeof average === "number" ? `${average.toFixed(1)}★ average from ${count || 0} ratings` : "No ratings yet"}</p>
        </div>
      </div>

      {!user ? (
        <p>
          <Link href="/account">Log in</Link> after the trip to rate the course experience and help sort the catalog by real attendee feedback.
        </p>
      ) : (
        <div className="course-rating-panel__form">
          <StarField label="Overall" value={overall} onChange={setOverall} />
          <StarField label="Content" value={content} onChange={setContent} />
          <StarField label="Instructor" value={instructor} onChange={setInstructor} />
          <StarField label="Logistics" value={logistics} onChange={setLogistics} />
          <StarField label="Value" value={value} onChange={setValue} />
          <label className="travel-form__notes">
            <span>Comment</span>
            <textarea
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              placeholder="What stood out once you actually took the course?"
            />
          </label>
          <div className="account-actions">
            <button type="button" className="travel-primary" onClick={handleSubmit} disabled={submitting}>
              {submitting ? "Saving..." : "Submit rating"}
            </button>
          </div>
          {message ? <p className="account-message">{message}</p> : null}
        </div>
      )}
    </section>
  );
}
