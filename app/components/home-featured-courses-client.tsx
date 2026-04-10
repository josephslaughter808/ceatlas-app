"use client";

import { useEffect, useState } from "react";
import type { CourseRecord } from "@/lib/courses";
import CourseCard from "./coursecard";

const skeletonCards = Array.from({ length: 3 }, (_, index) => index);

export default function HomeFeaturedCoursesClient() {
  const [courses, setCourses] = useState<CourseRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadFeaturedCourses() {
      try {
        const response = await fetch("/api/featured-courses");
        if (!response.ok) return;
        const nextCourses = await response.json();
        if (!cancelled) {
          setCourses(nextCourses);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadFeaturedCourses();

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="course-grid">
        {skeletonCards.map((item) => (
          <article className="course-card course-card--skeleton" key={item}>
            <div className="course-card__content">
              <div className="skeleton-line skeleton-line--pill" />
              <div className="skeleton-line skeleton-line--title" />
              <div className="skeleton-line" />
              <div className="skeleton-line skeleton-line--short" />
            </div>
            <div className="course-card__actions">
              <div className="skeleton-line skeleton-line--button" />
            </div>
          </article>
        ))}
      </div>
    );
  }

  if (courses.length === 0) {
    return (
      <div className="card">
        <h3>Featured courses are loading a little slowly.</h3>
        <p>The full catalog is still available from the Courses page.</p>
      </div>
    );
  }

  return (
    <div className="course-grid">
      {courses.map((course) => (
        <CourseCard key={course.id} course={course} />
      ))}
    </div>
  );
}
