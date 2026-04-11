"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { track } from "@vercel/analytics";
import { usePathname, useRouter } from "next/navigation";
import type { CourseRecord } from "@/lib/courses";
import CourseCard from "./coursecard";
import { useSavedCourses } from "./saved-courses-provider";
import { useAuth } from "./auth-provider";
import { supabase } from "@/lib/supabase";
import StateRequirementsPanel from "./state-requirements-panel";
import { getPracticeStateName, normalizePracticeStateCode } from "@/lib/practice-states";

type FilterOption = {
  label: string;
  value: string;
};

function toggleSelection(values: string[], nextValue: string) {
  return values.includes(nextValue)
    ? values.filter((value) => value !== nextValue)
    : [...values, nextValue];
}

function sameSelections(a: string[], b: string[]) {
  if (a.length !== b.length) return false;

  const aSorted = [...a].sort();
  const bSorted = [...b].sort();

  return aSorted.every((value, index) => value === bSorted[index]);
}

function MultiSelectFilter({
  label,
  options,
  selectedValues,
  onToggle,
  loading = false,
}: {
  label: string;
  options: FilterOption[];
  selectedValues: string[];
  onToggle: (value: string) => void;
  loading?: boolean;
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
        {loading && options.length === 0 ? (
          <div className="multi-filter__empty">Loading {label.toLowerCase()}...</div>
        ) : null}
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

function CourseMapPanel({ courses }: { courses: CourseRecord[] }) {
  const locations = useMemo(() => {
    const grouped = new Map<string, CourseRecord[]>();

    for (const course of courses) {
      const location = String(course.next_location || "").trim();
      if (!location || /online|self-paced|self paced/i.test(location)) continue;
      const bucket = grouped.get(location) || [];
      bucket.push(course);
      grouped.set(location, bucket);
    }

    return [...grouped.entries()]
      .map(([location, locationCourses]) => ({
        location,
        courses: locationCourses,
      }))
      .sort((a, b) => b.courses.length - a.courses.length || a.location.localeCompare(b.location));
  }, [courses]);

  const [selectedLocation, setSelectedLocation] = useState("");

  useEffect(() => {
    setSelectedLocation(locations[0]?.location || "");
  }, [locations]);

  const activeLocation = locations.find((entry) => entry.location === selectedLocation) || locations[0] || null;

  if (!locations.length) {
    return (
      <div className="course-map-panel card">
        <div className="course-map-panel__empty">
          <h2>Map View</h2>
          <p>
            This filtered result is mostly online or self-paced right now, so there is nothing useful to pin on the
            map yet.
          </p>
        </div>
      </div>
    );
  }

  const mapUrl = `https://www.google.com/maps?q=${encodeURIComponent(activeLocation?.location || "")}&output=embed`;

  return (
    <div className="course-map-panel card">
      <div className="course-map-panel__sidebar">
        <div className="course-map-panel__heading">
          <span className="course-map-panel__kicker">Map View</span>
          <h2>Explore current results by location</h2>
          <p>Select a location to preview it on the map and see the matching courses there.</p>
        </div>

        <div className="course-map-panel__locations">
          {locations.map((entry) => (
            <button
              key={entry.location}
              type="button"
              className={`course-map-panel__location${entry.location === activeLocation?.location ? " is-active" : ""}`}
              onClick={() => setSelectedLocation(entry.location)}
            >
              <span>{entry.location}</span>
              <strong>{entry.courses.length}</strong>
            </button>
          ))}
        </div>

        {activeLocation ? (
          <div className="course-map-panel__list">
            <h3>{activeLocation.location}</h3>
            <ul>
              {activeLocation.courses.slice(0, 8).map((course) => (
                <li key={course.id}>{course.title || "Untitled course"}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      <div className="course-map-panel__viewer">
        <iframe
          title={activeLocation?.location || "Course map"}
          src={mapUrl}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
      </div>
    </div>
  );
}

export default function CourseCatalogClient({
  courses,
  total,
  currentPage,
  totalPages,
  pageSize,
  initialState,
  filters,
  defaultSavedOnly = false,
}: {
  courses: CourseRecord[];
  total: number;
  currentPage: number;
  totalPages: number;
  pageSize: number;
  initialState: {
    search: string;
    sort: string;
    topics: string[];
    providers: string[];
    formats: string[];
  };
  filters: {
    providers: FilterOption[];
    formats: string[];
    topics: string[];
  };
  defaultSavedOnly?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();
  const { savedCourseIds } = useSavedCourses();
  const [isPending, startTransition] = useTransition();
  const [savedOnly, setSavedOnly] = useState(defaultSavedOnly);
  const [sortBy, setSortBy] = useState(initialState.sort);
  const [search, setSearch] = useState(initialState.search);
  const [selectedTopics, setSelectedTopics] = useState<string[]>(initialState.topics);
  const [selectedProviders, setSelectedProviders] = useState<string[]>(initialState.providers);
  const [selectedFormats, setSelectedFormats] = useState<string[]>(initialState.formats);
  const [viewMode, setViewMode] = useState<"list" | "map">("list");
  const [practiceStateCode, setPracticeStateCode] = useState("");
  const [availableFilters, setAvailableFilters] = useState(filters);
  const [filtersLoading, setFiltersLoading] = useState(filters.providers.length === 0 || filters.formats.length === 0);

  useEffect(() => {
    setSortBy(initialState.sort);
    setSearch(initialState.search);
    setSelectedTopics(initialState.topics);
    setSelectedProviders(initialState.providers);
    setSelectedFormats(initialState.formats);
  }, [initialState]);

  useEffect(() => {
    let cancelled = false;

    async function loadFilters() {
      setFiltersLoading(true);
      try {
        const response = await fetch("/api/course-filters");
        if (!response.ok) return;
        const nextFilters = await response.json();
        if (!cancelled) {
          setAvailableFilters(nextFilters);
        }
      } finally {
        if (!cancelled) {
          setFiltersLoading(false);
        }
      }
    }

    loadFilters();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadPracticeState() {
      if (!user) {
        setPracticeStateCode("");
        return;
      }

      const { data } = await supabase
        .from("profiles")
        .select("state_of_practice")
        .maybeSingle();

      if (cancelled) return;
      setPracticeStateCode(normalizePracticeStateCode(data?.state_of_practice || user.user_metadata?.state_of_practice));
    }

    loadPracticeState();

    return () => {
      cancelled = true;
    };
  }, [user]);

  const providerSuggestions = useMemo(() => {
    const stateName = getPracticeStateName(practiceStateCode);
    if (!stateName) return [];

    return availableFilters.providers
      .map((provider) => provider.label)
      .filter((provider) => provider.toLowerCase().includes(stateName.toLowerCase()))
      .slice(0, 4);
  }, [availableFilters.providers, practiceStateCode]);

  const visibleCourses = useMemo(
    () => courses.filter((course) => (savedOnly ? savedCourseIds.includes(course.id) : true)),
    [courses, savedCourseIds, savedOnly]
  );
  const hasPendingFilterChanges = search.trim() !== initialState.search.trim()
    || sortBy !== initialState.sort
    || !sameSelections(selectedTopics, initialState.topics)
    || !sameSelections(selectedProviders, initialState.providers)
    || !sameSelections(selectedFormats, initialState.formats);

  const visibleTotal = savedOnly ? visibleCourses.length : total;
  const currentPageSafe = Math.min(currentPage, totalPages);
  const pageStart = visibleTotal === 0 ? 0 : (savedOnly ? 1 : ((currentPageSafe - 1) * pageSize + 1));
  const pageEnd = visibleTotal === 0 ? 0 : (savedOnly ? visibleCourses.length : Math.min(currentPageSafe * pageSize, visibleTotal));

  function pushQuery(next: {
    search?: string;
    sort?: string;
    topics?: string[];
    providers?: string[];
    formats?: string[];
    page?: number;
    pageSize?: number;
  }) {
    const params = new URLSearchParams();
    const nextSearch = next.search ?? search;
    const nextSort = next.sort ?? sortBy;
    const nextTopics = next.topics ?? selectedTopics;
    const nextProviders = next.providers ?? selectedProviders;
    const nextFormats = next.formats ?? selectedFormats;
    const nextPage = next.page ?? 1;
    const nextPageSize = next.pageSize ?? pageSize;

    if (nextSearch.trim()) params.set("search", nextSearch.trim());
    if (nextSort && nextSort !== "balanced") params.set("sort", nextSort);
    if (nextTopics.length) params.set("topic", nextTopics.join(","));
    if (nextProviders.length) params.set("provider", nextProviders.join(","));
    if (nextFormats.length) params.set("format", nextFormats.join(","));
    if (nextPage > 1) params.set("page", String(nextPage));
    if (nextPageSize !== 50) params.set("pageSize", String(nextPageSize));

    const query = params.toString();
    startTransition(() => {
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    });
  }

  function handleFilterToggle(filterName: "topic" | "provider" | "format", value: string) {
    track("course_filter_toggle", {
      filter: filterName,
      value: filterName === "provider" ? "provider_selected" : value,
    });
  }

  return (
    <>
      <StateRequirementsPanel
        stateCode={practiceStateCode}
        providerSuggestions={providerSuggestions}
        signedIn={Boolean(user)}
      />

      <div className="course-filters">
        <div className="course-filters__search">
          <input
            type="search"
            value={search}
            onChange={(event) => {
              const value = event.target.value;
              if (!search && value) {
                track("course_search_start");
              }
              setSearch(value);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                track("course_filters_apply", { source: "search" });
                pushQuery({ search, sort: sortBy, topics: selectedTopics, providers: selectedProviders, formats: selectedFormats, page: 1 });
              }
            }}
            placeholder="Search title, topic, description, provider, or instructor"
            aria-label="Search courses"
          />
        </div>

        <div className="course-filters__row">
          <MultiSelectFilter
            label="Topics"
            options={availableFilters.topics.map((topic) => ({ label: topic, value: topic }))}
            selectedValues={selectedTopics}
            onToggle={(value) => {
              handleFilterToggle("topic", value);
              const nextTopics = toggleSelection(selectedTopics, value);
              setSelectedTopics(nextTopics);
            }}
          />

          <MultiSelectFilter
            label="Providers"
            options={availableFilters.providers.map((provider) => ({
              label: provider.label,
              value: provider.value,
            }))}
            selectedValues={selectedProviders}
            loading={filtersLoading}
            onToggle={(value) => {
              handleFilterToggle("provider", value);
              const nextProviders = toggleSelection(selectedProviders, value);
              setSelectedProviders(nextProviders);
            }}
          />

          <MultiSelectFilter
            label="Formats"
            options={availableFilters.formats.map((format) => ({ label: format, value: format }))}
            selectedValues={selectedFormats}
            loading={filtersLoading}
            onToggle={(value) => {
              handleFilterToggle("format", value);
              const nextFormats = toggleSelection(selectedFormats, value);
              setSelectedFormats(nextFormats);
            }}
          />

          <button
            type="button"
            className="button button-secondary"
            onClick={() => {
              track("course_filters_apply", {
                source: "button",
                topics: selectedTopics.length,
                providers: selectedProviders.length,
                formats: selectedFormats.length,
              });
              pushQuery({
                search,
                sort: sortBy,
                topics: selectedTopics,
                providers: selectedProviders,
                formats: selectedFormats,
                page: 1,
              });
            }}
            disabled={!hasPendingFilterChanges || isPending}
          >
            {isPending ? "Applying..." : "Apply Filters"}
          </button>

          <button
            type="button"
            className="button"
            onClick={() => {
              track("course_filters_clear");
              setSearch("");
              setSelectedTopics([]);
              setSelectedProviders([]);
              setSelectedFormats([]);
              setSortBy("balanced");
              pushQuery({
                search: "",
                topics: [],
                providers: [],
                formats: [],
                sort: "balanced",
                page: 1,
                pageSize: 50,
              });
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
              onChange={(event) => {
                track("course_saved_only_toggle", { enabled: event.target.checked });
                setSavedOnly(event.target.checked);
              }}
            />
            <span>Saved only</span>
          </label>

          <label className="sort-filter">
            <span>Sort</span>
            <select
              value={sortBy}
              onChange={(event) => {
                track("course_sort_change", { sort: event.target.value });
                setSortBy(event.target.value);
              }}
            >
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

          <label className="sort-filter">
            <span>Page size</span>
            <select
              value={pageSize}
              onChange={(event) => {
                const nextSize = Number(event.target.value);
                track("course_page_size_change", { size: nextSize });
                pushQuery({ pageSize: nextSize, page: 1 });
              }}
            >
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </label>
        </div>

        <div className="catalog-toolbar__meta">
          {isPending ? <span>Updating results...</span> : null}
          <span>{savedCourseIds.length} saved</span>
          <span>{pageStart}-{pageEnd || 0} of {visibleTotal}</span>
        </div>
      </div>

      <div className="catalog-view-toggle" role="tablist" aria-label="Course results view">
        <button
          type="button"
          className={`catalog-view-toggle__button${viewMode === "list" ? " is-active" : ""}`}
          onClick={() => setViewMode("list")}
        >
          List view
        </button>
        <button
          type="button"
          className={`catalog-view-toggle__button${viewMode === "map" ? " is-active" : ""}`}
          onClick={() => setViewMode("map")}
        >
          Map view
        </button>
      </div>

      <div className="course-count">
        Showing <strong>{pageStart}-{pageEnd || 0}</strong> of <strong>{visibleTotal}</strong> courses
      </div>

      {visibleCourses.length === 0 ? (
        <div className="card">
          <h2>No courses matched this view.</h2>
          <p>Try clearing filters or broadening one of your selections.</p>
        </div>
      ) : (
        <>
          {viewMode === "map" ? <CourseMapPanel courses={visibleCourses} /> : null}

          <div className="course-grid">
            {visibleCourses.map((course) => (
              <CourseCard key={course.id} course={course} />
            ))}
          </div>

          {!savedOnly ? <div className="catalog-pagination">
            <button
              type="button"
              className="button button-secondary"
              onClick={() => pushQuery({ page: Math.max(1, currentPageSafe - 1) })}
              disabled={currentPageSafe === 1}
            >
              Previous
            </button>

            <span className="catalog-pagination__label">
              Page {currentPageSafe} of {totalPages}
            </span>

            <button
              type="button"
              className="button button-secondary"
              onClick={() => pushQuery({ page: Math.min(totalPages, currentPageSafe + 1) })}
              disabled={currentPageSafe === totalPages}
            >
              Next
            </button>
          </div> : null}
        </>
      )}
    </>
  );
}
