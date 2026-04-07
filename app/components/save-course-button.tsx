"use client";

import Link from "next/link";
import { track } from "@vercel/analytics";
import { useSavedCourses } from "./saved-courses-provider";
import { useAuth } from "./auth-provider";

export default function SaveCourseButton({ courseId }: { courseId: string }) {
  const { user } = useAuth();
  const { isSaved, toggleSavedCourse } = useSavedCourses();
  const saved = isSaved(courseId);

  if (!user) {
    return (
      <Link
        href="/account"
        className="save-button"
        aria-label="Log in to save courses"
        title="Log in to save courses"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" className="save-button__icon">
          <path
            d="M7 4.5h10a1 1 0 0 1 1 1V20l-6-3.6L6 20V5.5a1 1 0 0 1 1-1Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
        </svg>
      </Link>
    );
  }

  return (
    <button
      type="button"
      className={saved ? "save-button save-button--active" : "save-button"}
      onClick={() => {
        track(saved ? "course_unsave" : "course_save", { course_id: courseId });
        toggleSavedCourse(courseId);
      }}
      aria-pressed={saved}
      aria-label={saved ? "Remove from saved courses" : "Save course"}
      title={saved ? "Saved" : "Save course"}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" className="save-button__icon">
        <path
          d="M7 4.5h10a1 1 0 0 1 1 1V20l-6-3.6L6 20V5.5a1 1 0 0 1 1-1Z"
          fill={saved ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
