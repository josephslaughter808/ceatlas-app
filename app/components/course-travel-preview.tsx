"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { TravelSearchResponse } from "@/lib/travel/providers/types";
import { getMetroAirportCodes, inferAirportCodeFromLocation, inferCityCodeFromLocation, inferCityNameFromLocation } from "@/lib/travel/airport-lookup";

type SortFlight = "closest" | "fastest" | "cheapest";
type SortHotel = "closest" | "cheapest" | "rated";

function money(amount: number | null, currency = "USD") {
  return amount == null ? "Estimate pending" : new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
}

function duration(minutes: number | null | undefined) {
  if (!minutes) return "Duration pending";
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

export default function CourseTravelPreview({ courseId, title, location, startDate, endDate }: {
  courseId: string; title: string; location: string; startDate: string; endDate: string | null;
}) {
  const [primaryOrigin, setPrimaryOrigin] = useState(() => typeof window === "undefined" ? "DFW" : window.localStorage.getItem("ceatlas:home-airport") || "DFW");
  const [secondaryOrigin, setSecondaryOrigin] = useState(() => typeof window === "undefined" ? "DAL" : window.localStorage.getItem("ceatlas:secondary-airport") || "DAL");
  const [flightSort, setFlightSort] = useState<SortFlight>("cheapest");
  const [hotelSort, setHotelSort] = useState<SortHotel>("closest");
  const [results, setResults] = useState<TravelSearchResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const destination = inferAirportCodeFromLocation(location);
  const destinationAirports = useMemo(() => getMetroAirportCodes(destination), [destination]);

  useEffect(() => {
    if (!destination || !startDate) return;
    const controller = new AbortController();
    fetch("/api/travel/search", {
      method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.signal,
      body: JSON.stringify({
        originCode: primaryOrigin, originCodes: [primaryOrigin, secondaryOrigin],
        destinationCode: destination, destinationCodes: destinationAirports,
        hotelCityCode: inferCityCodeFromLocation(location, destination),
        hotelCityName: inferCityNameFromLocation(location), departureDate: startDate,
        returnDate: endDate || startDate, adults: 1,
      }),
    }).then((response) => response.json()).then(setResults).catch(() => null).finally(() => setLoading(false));
    return () => controller.abort();
  }, [destination, destinationAirports, endDate, location, primaryOrigin, secondaryOrigin, startDate]);

  const flights = useMemo(() => [...(results?.flights || [])].sort((a, b) => {
    if (flightSort === "closest") return (a.destinationDistanceMiles ?? 999) - (b.destinationDistanceMiles ?? 999);
    if (flightSort === "fastest") return (a.durationMinutes ?? 9999) - (b.durationMinutes ?? 9999);
    return (a.totalAmount ?? Infinity) - (b.totalAmount ?? Infinity);
  }).slice(0, 6), [flightSort, results]);

  const hotels = useMemo(() => [...(results?.hotels || [])].sort((a, b) => {
    if (hotelSort === "closest") return (a.distanceToVenueMiles ?? 999) - (b.distanceToVenueMiles ?? 999);
    if (hotelSort === "rated") return (b.rating ?? 0) - (a.rating ?? 0);
    return (a.totalAmount ?? Infinity) - (b.totalAmount ?? Infinity);
  }).slice(0, 6), [hotelSort, results]);

  if (!destination || !startDate) return null;

  return (
    <section className="course-travel card">
      <div className="course-travel__head">
        <div><p className="packages-builder__eyebrow">Travel around this course</p><h2>Flights and hotels, matched to the venue</h2><p>Compare the airports around {location} for the course date window.</p></div>
        <span className="course-travel__estimate">Preview estimates · Live inventory coming with API connection</span>
      </div>

      <div className="course-travel__origins">
        <label><span>Fly from</span><input value={primaryOrigin} maxLength={3} onChange={(event) => setPrimaryOrigin(event.target.value.toUpperCase())} /></label>
        <label><span>Also compare</span><input value={secondaryOrigin} maxLength={3} onChange={(event) => setSecondaryOrigin(event.target.value.toUpperCase())} /></label>
        <div><span>Arrive near course</span><strong>{destinationAirports.join(" · ")}</strong></div>
      </div>

      {loading ? <p className="course-travel__loading">Finding the best travel combinations…</p> : (
        <div className="course-travel__grid">
          <div>
            <div className="course-travel__section-head"><h3>Flights</h3><div className="travel-sort" aria-label="Sort flights">{(["closest", "fastest", "cheapest"] as SortFlight[]).map((sort) => <button key={sort} className={flightSort === sort ? "is-active" : ""} onClick={() => setFlightSort(sort)}>{sort}</button>)}</div></div>
            <div className="course-travel__list">{flights.map((flight) => <article key={flight.id}><div><strong>{flight.originCode} → {flight.destinationCode}</strong><span>{flight.title} · {flight.stops ? `${flight.stops} stop` : "Nonstop"}</span></div><div><strong>{money(flight.totalAmount, flight.currency || "USD")}</strong><span>{duration(flight.durationMinutes)} · {flight.destinationDistanceMiles?.toFixed(1)} mi to venue</span></div></article>)}</div>
          </div>
          <div>
            <div className="course-travel__section-head"><h3>Hotels</h3><div className="travel-sort" aria-label="Sort hotels">{(["closest", "cheapest", "rated"] as SortHotel[]).map((sort) => <button key={sort} className={hotelSort === sort ? "is-active" : ""} onClick={() => setHotelSort(sort)}>{sort === "rated" ? "highest rated" : sort}</button>)}</div></div>
            <div className="course-travel__list">{hotels.map((hotel) => <article key={hotel.id}><div><strong>{hotel.name}</strong><span>{hotel.rating?.toFixed(1)}★ · {hotel.distanceToVenueMiles?.toFixed(1)} mi to venue</span></div><div><strong>{money(hotel.totalAmount, hotel.currency || "USD")}</strong><span>estimated trip stay</span></div></article>)}</div>
          </div>
        </div>
      )}
      <div className="course-travel__footer"><p>Estimates demonstrate the shopping experience and are not bookable fares. Supplier names, availability, taxes, and final prices will refresh from live APIs.</p><Link className="button" href={`/travel?course=${encodeURIComponent(courseId)}`}>Build full trip for {title}</Link></div>
    </section>
  );
}
