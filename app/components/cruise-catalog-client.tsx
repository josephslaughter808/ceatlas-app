"use client";

import { useMemo, useState } from "react";
import type { CruiseRecord } from "@/lib/cruises";
import CruiseCard from "./cruisecard";

function normalize(value: string | null | undefined) {
  return String(value || "").trim().toLowerCase();
}

function extractNumericValue(value: string | null | undefined) {
  if (!value) return null;
  const matches = value.match(/\$([\d,]+(?:\.\d+)?)/g);
  if (!matches?.length) return null;

  const numbers = matches
    .map((match) => Number.parseFloat(match.replace(/[$,]/g, "")))
    .filter((number) => Number.isFinite(number));

  return numbers.length ? Math.min(...numbers) : null;
}

function extractCredits(value: string | null | undefined) {
  if (!value) return null;
  const match = value.match(/(\d+(?:\.\d+)?)/);
  if (!match) return null;

  const credits = Number.parseFloat(match[1]);
  return Number.isFinite(credits) ? credits : null;
}

function parseTime(value: string | null | undefined) {
  if (!value) return Number.MAX_SAFE_INTEGER;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : Number.MAX_SAFE_INTEGER;
}

export default function CruiseCatalogClient({ cruises }: { cruises: CruiseRecord[] }) {
  const [search, setSearch] = useState("");
  const [provider, setProvider] = useState("all");
  const [topic, setTopic] = useState("all");
  const [destination, setDestination] = useState("all");
  const [sortBy, setSortBy] = useState("date");

  const providerOptions = useMemo(
    () => [...new Set(cruises.map((cruise) => cruise.provider_name).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [cruises],
  );

  const topicOptions = useMemo(
    () => [...new Set(cruises.map((cruise) => cruise.topic).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [cruises],
  );

  const destinationOptions = useMemo(
    () =>
      [...new Set(cruises.map((cruise) => cruise.location || cruise.itinerary).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b),
      ),
    [cruises],
  );

  const visibleCruises = useMemo(() => {
    const searchTerm = normalize(search);

    const filtered = cruises.filter((cruise) => {
      if (provider !== "all" && cruise.provider_name !== provider) return false;
      if (topic !== "all" && cruise.topic !== topic) return false;

      const cruiseDestination = cruise.location || cruise.itinerary || "";
      if (destination !== "all" && cruiseDestination !== destination) return false;

      if (!searchTerm) return true;

      const haystack = normalize(
        [
          cruise.title,
          cruise.description,
          cruise.provider_name,
          cruise.topic,
          cruise.ship,
          cruise.location,
          cruise.itinerary,
          cruise.instructor_display,
        ].join(" "),
      );

      return haystack.includes(searchTerm);
    });

    return [...filtered].sort((a, b) => {
      if (sortBy === "price-low") {
        return (extractNumericValue(a.card_price) ?? Number.MAX_SAFE_INTEGER) - (extractNumericValue(b.card_price) ?? Number.MAX_SAFE_INTEGER);
      }

      if (sortBy === "price-high") {
        return (extractNumericValue(b.card_price) ?? -1) - (extractNumericValue(a.card_price) ?? -1);
      }

      if (sortBy === "credits-high") {
        return (extractCredits(b.credits_text) ?? -1) - (extractCredits(a.credits_text) ?? -1);
      }

      if (sortBy === "provider") {
        return String(a.provider_name || "").localeCompare(String(b.provider_name || ""));
      }

      if (sortBy === "destination") {
        return String(a.location || a.itinerary || "").localeCompare(String(b.location || b.itinerary || ""));
      }

      if (sortBy === "title") {
        return String(a.title || "").localeCompare(String(b.title || ""));
      }

      return parseTime(a.start_date) - parseTime(b.start_date);
    });
  }, [cruises, destination, provider, search, sortBy, topic]);

  return (
    <>
      <div className="course-filters cruise-filters">
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by cruise, ship, destination, provider, or instructor"
          aria-label="Search cruises"
        />

        <select value={provider} onChange={(event) => setProvider(event.target.value)} aria-label="Filter by provider">
          <option value="all">All providers</option>
          {providerOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>

        <select value={topic} onChange={(event) => setTopic(event.target.value)} aria-label="Filter by topic">
          <option value="all">All topics</option>
          {topicOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>

        <select
          value={destination}
          onChange={(event) => setDestination(event.target.value)}
          aria-label="Filter by destination"
        >
          <option value="all">All destinations</option>
          {destinationOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>

      <div className="catalog-toolbar">
        <div className="catalog-toolbar__controls">
          <label className="sort-filter">
            <span>Sort</span>
            <select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
              <option value="date">Next departure</option>
              <option value="price-low">Lowest price</option>
              <option value="price-high">Highest price</option>
              <option value="credits-high">Highest credits</option>
              <option value="provider">Provider</option>
              <option value="destination">Destination</option>
              <option value="title">Title A-Z</option>
            </select>
          </label>
        </div>

        <div className="catalog-toolbar__meta">
          <span>{providerOptions.length} providers</span>
          <span>{visibleCruises.length} showing</span>
        </div>
      </div>

      <div className="course-count">
        Showing <strong>{visibleCruises.length}</strong> cruises
      </div>

      {visibleCruises.length === 0 ? (
        <div className="card">
          <h2>No cruises matched this view.</h2>
          <p>Try a broader destination or clear one of the filters to reopen the catalog.</p>
        </div>
      ) : (
        <div className="course-grid">
          {visibleCruises.map((cruise) => (
            <CruiseCard key={cruise.id} cruise={cruise} />
          ))}
        </div>
      )}
    </>
  );
}
