"use client";

import { useMemo, useState } from "react";
import type { CourseRecord } from "@/lib/courses";
import CourseCard from "./coursecard";
import { useSavedCourses } from "./saved-courses-provider";

type FilterOption = {
  label: string;
  value: string;
};

function numericValue(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalize(value: string | null | undefined) {
  return String(value || "").trim().toLowerCase();
}

function interleaveByProvider(items: CourseRecord[]) {
  const providerBuckets = new Map<string, CourseRecord[]>();

  for (const item of items) {
    const provider = item.provider_name || "Unknown provider";
    const bucket = providerBuckets.get(provider) || [];
    bucket.push(item);
    providerBuckets.set(provider, bucket);
  }

  const orderedProviders = [...providerBuckets.keys()].sort((a, b) => a.localeCompare(b));
  const result: CourseRecord[] = [];
  let added = true;

  while (added) {
    added = false;

    for (const provider of orderedProviders) {
      const bucket = providerBuckets.get(provider);
      if (!bucket || bucket.length === 0) continue;
      result.push(bucket.shift() as CourseRecord);
      added = true;
    }
  }

  return result;
}

function toggleSelection(values: string[], nextValue: string) {
  return values.includes(nextValue)
    ? values.filter((value) => value !== nextValue)
    : [...values, nextValue];
}

function MultiSelectFilter({
  label,
  options,
  selectedValues,
  onToggle,
}: {
  label: string;
  options: FilterOption[];
  selectedValues: string[];
  onToggle: (value: string) => void;
}) {
  const summary = selectedValues.length === 0
    ? `All ${label.toLowerCase()}`
    : selectedValues.length === 1
      ? selectedValues[0]
      : `${selectedValues.length} ${label.toLowerCase()} selected`;

  return (
    <details className="multi-filter">
      <summary className="multi-filter__summary">
        <span className="multi-filter__label">{label}</span>
        <span className="multi-filter__value">{summary}</span>
      </summary>

      <div className="multi-filter__menu">
        {options.map((option) => (
          <label key={option.value} className="multi-filter__option">
            <input
              type="checkbox"
              checked={selectedValues.includes(option.value)}
              onChange={() => onToggle(option.value)}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    </details>
  );
}

export default function CourseCatalogClient({
  courses,
  filters,
  defaultSavedOnly = false,
}: {
  courses: CourseRecord[];
  filters: {
    providers: FilterOption[];
    formats: string[];
    topics: string[];
  };
  defaultSavedOnly?: boolean;
}) {
  const { savedCourseIds } = useSavedCourses();
  const [savedOnly, setSavedOnly] = useState(defaultSavedOnly);
  const [sortBy, setSortBy] = useState("balanced");
  const [search, setSearch] = useState("");
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [selectedProviders, setSelectedProviders] = useState<string[]>([]);
  const [selectedFormats, setSelectedFormats] = useState<string[]>([]);

  const visibleCourses = useMemo(() => {
    const searchTerm = normalize(search);

    const filtered = courses
      .filter((course) => (savedOnly ? savedCourseIds.includes(course.id) : true))
      .filter((course) => {
        if (selectedTopics.length === 0) return true;
        return selectedTopics.some((topic) => course.topic_bucket === topic);
      })
      .filter((course) => (selectedProviders.length === 0 ? true : selectedProviders.includes(course.provider_name || "")))
      .filter((course) => (selectedFormats.length === 0 ? true : selectedFormats.includes(course.next_format || "")))
      .filter((course) => {
        if (!searchTerm) return true;

        const haystack = normalize([
          course.title,
          course.description,
          course.category,
          course.topic,
          course.provider_name,
          course.next_location,
          course.next_format,
          course.instructor_display,
          ...(course.tags || []),
        ].join(" "));

        return haystack.includes(searchTerm);
      });

    if (sortBy === "balanced") {
      return interleaveByProvider(filtered);
    }

    return [...filtered].sort((a, b) => {
      if (sortBy === "popularity") {
        const aSaved = savedCourseIds.includes(a.id);
        const bSaved = savedCourseIds.includes(b.id);
        if (aSaved !== bSaved) return aSaved ? -1 : 1;
      }

      if (sortBy === "credits-high") {
        return (numericValue(b.credits) ?? -1) - (numericValue(a.credits) ?? -1);
      }

      if (sortBy === "rating-high") {
        return (numericValue(b.rating_average) ?? -1) - (numericValue(a.rating_average) ?? -1);
      }

      if (sortBy === "instructor") {
        return String(a.instructor_display || "ZZZ").localeCompare(String(b.instructor_display || "ZZZ"));
      }

      if (sortBy === "price-low") {
        return (numericValue(a.price) ?? Number.MAX_SAFE_INTEGER) - (numericValue(b.price) ?? Number.MAX_SAFE_INTEGER);
      }

      if (sortBy === "price-high") {
        return (numericValue(b.price) ?? -1) - (numericValue(a.price) ?? -1);
      }

      return String(a.title || "").localeCompare(String(b.title || ""));
    });
  }, [
    courses,
    savedCourseIds,
    savedOnly,
    search,
    selectedFormats,
    selectedProviders,
    selectedTopics,
    sortBy,
  ]);

  return (
    <>
      <div className="course-filters">
        <div className="course-filters__search">
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search title, topic, description, provider, or instructor"
            aria-label="Search courses"
          />
        </div>

        <div className="course-filters__row">
          <MultiSelectFilter
            label="Topics"
            options={filters.topics.map((topic) => ({ label: topic, value: topic }))}
            selectedValues={selectedTopics}
            onToggle={(value) => setSelectedTopics((current) => toggleSelection(current, value))}
          />

          <MultiSelectFilter
            label="Providers"
            options={filters.providers.map((provider) => ({
              label: provider.label,
              value: provider.value,
            }))}
            selectedValues={selectedProviders}
            onToggle={(value) => setSelectedProviders((current) => toggleSelection(current, value))}
          />

          <MultiSelectFilter
            label="Formats"
            options={filters.formats.map((format) => ({ label: format, value: format }))}
            selectedValues={selectedFormats}
            onToggle={(value) => setSelectedFormats((current) => toggleSelection(current, value))}
          />

          <button
            type="button"
            className="button"
            onClick={() => {
              setSearch("");
              setSelectedTopics([]);
              setSelectedProviders([]);
              setSelectedFormats([]);
            }}
          >
            Clear Filters
          </button>
        </div>
      </div>

      <div className="catalog-toolbar">
        <div className="catalog-toolbar__controls">
          <label className="saved-filter">
            <input
              type="checkbox"
              checked={savedOnly}
              onChange={(event) => setSavedOnly(event.target.checked)}
            />
            <span>Saved only</span>
          </label>

          <label className="sort-filter">
            <span>Sort</span>
            <select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
              <option value="balanced">Balanced providers</option>
              <option value="popularity">Popularity</option>
              <option value="rating-high">Highest rated</option>
              <option value="instructor">Instructor</option>
              <option value="credits-high">Highest credits</option>
              <option value="price-low">Lowest price</option>
              <option value="price-high">Highest price</option>
              <option value="title">Title A–Z</option>
            </select>
          </label>
        </div>

        <div className="catalog-toolbar__meta">
          <span>{savedCourseIds.length} saved</span>
          <span>{visibleCourses.length} showing</span>
        </div>
      </div>

      <div className="course-count">
        Showing <strong>{visibleCourses.length}</strong> courses
      </div>

      {visibleCourses.length === 0 ? (
        <div className="card">
          <h2>No courses matched this view.</h2>
          <p>Try clearing filters or broadening one of your selections.</p>
        </div>
      ) : (
        <div className="course-grid">
          {visibleCourses.map((course) => (
            <CourseCard key={course.id} course={course} />
          ))}
        </div>
      )}
    </>
  );
}
