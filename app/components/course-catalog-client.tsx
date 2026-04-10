"use client";

import { useEffect, useMemo, useState } from "react";
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
  const [savedOnly, setSavedOnly] = useState(defaultSavedOnly);
  const [sortBy, setSortBy] = useState(initialState.sort);
  const [search, setSearch] = useState(initialState.search);
  const [selectedTopics, setSelectedTopics] = useState<string[]>(initialState.topics);
  const [selectedProviders, setSelectedProviders] = useState<string[]>(initialState.providers);
  const [selectedFormats, setSelectedFormats] = useState<string[]>(initialState.formats);
  const [practiceStateCode, setPracticeStateCode] = useState("");

  useEffect(() => {
    setSortBy(initialState.sort);
    setSearch(initialState.search);
    setSelectedTopics(initialState.topics);
    setSelectedProviders(initialState.providers);
    setSelectedFormats(initialState.formats);
  }, [initialState]);

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

    return filters.providers
      .map((provider) => provider.label)
      .filter((provider) => provider.toLowerCase().includes(stateName.toLowerCase()))
      .slice(0, 4);
  }, [filters.providers, practiceStateCode]);

  const visibleCourses = useMemo(
    () => courses.filter((course) => (savedOnly ? savedCourseIds.includes(course.id) : true)),
    [courses, savedCourseIds, savedOnly]
  );

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
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
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
              pushQuery({ search: value, page: 1 });
            }}
            placeholder="Search title, topic, description, provider, or instructor"
            aria-label="Search courses"
          />
        </div>

        <div className="course-filters__row">
          <MultiSelectFilter
            label="Topics"
            options={filters.topics.map((topic) => ({ label: topic, value: topic }))}
            selectedValues={selectedTopics}
            onToggle={(value) => {
              handleFilterToggle("topic", value);
              const nextTopics = toggleSelection(selectedTopics, value);
              setSelectedTopics(nextTopics);
              pushQuery({ topics: nextTopics, page: 1 });
            }}
          />

          <MultiSelectFilter
            label="Providers"
            options={filters.providers.map((provider) => ({
              label: provider.label,
              value: provider.value,
            }))}
            selectedValues={selectedProviders}
            onToggle={(value) => {
              handleFilterToggle("provider", value);
              const nextProviders = toggleSelection(selectedProviders, value);
              setSelectedProviders(nextProviders);
              pushQuery({ providers: nextProviders, page: 1 });
            }}
          />

          <MultiSelectFilter
            label="Formats"
            options={filters.formats.map((format) => ({ label: format, value: format }))}
            selectedValues={selectedFormats}
            onToggle={(value) => {
              handleFilterToggle("format", value);
              const nextFormats = toggleSelection(selectedFormats, value);
              setSelectedFormats(nextFormats);
              pushQuery({ formats: nextFormats, page: 1 });
            }}
          />

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
                pushQuery({ sort: event.target.value, page: 1 });
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
          <span>{savedCourseIds.length} saved</span>
          <span>{pageStart}-{pageEnd || 0} of {visibleTotal}</span>
        </div>
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
