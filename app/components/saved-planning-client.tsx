"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { CourseRecord } from "@/lib/courses";
import CourseCatalogClient from "./course-catalog-client";
import { useSavedCourses } from "./saved-courses-provider";

export default function SavedPlanningClient() {
  const { savedCourseIds } = useSavedCourses();
  const [courses, setCourses] = useState<CourseRecord[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadSavedCourses() {
      if (savedCourseIds.length === 0) {
        setCourses([]);
        return;
      }

      setLoading(true);
      try {
        const response = await fetch("/api/courses-by-ids", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ids: savedCourseIds }),
        });
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

    loadSavedCourses();

    return () => {
      cancelled = true;
    };
  }, [savedCourseIds]);

  return (
    <>
      <section className="saved-overview">
        <div className="card saved-overview__card">
          <h2>Travel Planning</h2>
          <p>Build a CE trip around any saved course, keep your itinerary in one place, and open live hotel, flight, and car searches from there.</p>
          <p>
            <Link href="/travel">Open travel planner</Link>
          </p>
        </div>
      </section>

      {savedCourseIds.length === 0 ? (
        <div className="card">
          <h2>No saved courses yet.</h2>
          <p>Browse the catalog and tap the bookmark icon on any course you want to keep.</p>
          <Link href="/courses" className="button">Browse courses</Link>
        </div>
      ) : loading ? (
        <div className="course-grid">
          {savedCourseIds.slice(0, 3).map((id) => (
            <article className="course-card course-card--skeleton" key={id}>
              <div className="course-card__content">
                <div className="skeleton-line skeleton-line--pill" />
                <div className="skeleton-line skeleton-line--title" />
                <div className="skeleton-line" />
                <div className="skeleton-line skeleton-line--short" />
              </div>
            </article>
          ))}
        </div>
      ) : (
        <CourseCatalogClient
          courses={courses}
          total={courses.length}
          currentPage={1}
          totalPages={1}
          pageSize={50}
          initialState={{
            search: "",
            sort: "balanced",
            topics: [],
            providers: [],
            formats: [],
          }}
          filters={{
            providers: [],
            formats: [],
            topics: [],
          }}
          defaultSavedOnly
        />
      )}
    </>
  );
}
