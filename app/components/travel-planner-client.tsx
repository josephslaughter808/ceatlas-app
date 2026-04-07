"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { CourseRecord } from "@/lib/courses";
import { useSavedCourses } from "./saved-courses-provider";
import { useTravelPlanner } from "./travel-planner-provider";
import { useAuth } from "./auth-provider";
import CompareButton from "./compare-button";

type TravelPlannerClientProps = {
  courses: CourseRecord[];
};

type PlannerFormState = {
  courseId: string;
  departureAirport: string;
  destinationCode: string;
  travelers: string;
  budget: string;
  hotelStyle: string;
  needsCar: boolean;
  notes: string;
};

const defaultFormState: PlannerFormState = {
  courseId: "",
  departureAirport: "",
  destinationCode: "",
  travelers: "1",
  budget: "",
  hotelStyle: "Comfort",
  needsCar: true,
  notes: "",
};

type TravelSearchResponse = {
  configured: boolean;
  flights: Array<{
    id: string;
    total: string | null;
    currency: string | null;
    stops: number | null;
    carriers: string[];
    departureAt: string | null;
    arrivalAt: string | null;
  }>;
  hotels: Array<{
    id: string;
    name: string;
    cityCode: string | null;
    total: string | null;
    currency: string | null;
  }>;
  warnings?: string[];
  error?: string;
};

function addDays(dateText: string | null, days: number) {
  if (!dateText) return "";
  const date = new Date(dateText);
  if (Number.isNaN(date.getTime())) return "";
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function buildBookingUrl(plan: { destination: string; startDate: string | null; endDate: string | null }) {
  const url = new URL("https://www.booking.com/searchresults.html");
  const affiliateId = process.env.NEXT_PUBLIC_BOOKING_AFFILIATE_ID;
  if (affiliateId) {
    url.searchParams.set("aid", affiliateId);
  }
  url.searchParams.set("ss", plan.destination);
  if (plan.startDate) url.searchParams.set("checkin", plan.startDate);
  if (plan.endDate) url.searchParams.set("checkout", plan.endDate);
  return url.toString();
}

function buildFlightSearchUrl(plan: { departureAirport: string; destination: string; startDate: string | null; endDate: string | null }) {
  const query = [
    "Flights",
    plan.departureAirport ? `from ${plan.departureAirport}` : "",
    plan.destination ? `to ${plan.destination}` : "",
    plan.startDate ? `on ${plan.startDate}` : "",
    plan.endDate ? `returning ${plan.endDate}` : "",
  ].filter(Boolean).join(" ");

  return `https://www.google.com/travel/flights?q=${encodeURIComponent(query)}`;
}

function buildCarSearchUrl(plan: { destination: string; startDate: string | null; endDate: string | null }) {
  const query = [
    "Rental cars",
    plan.destination,
    plan.startDate ? `from ${plan.startDate}` : "",
    plan.endDate ? `to ${plan.endDate}` : "",
  ].filter(Boolean).join(" ");

  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}

function summarizeFormat(course: CourseRecord) {
  return [
    course.provider_name,
    course.next_format || course.category,
    course.credits_text ? `${course.credits_text} credits` : null,
  ].filter(Boolean).join(" • ");
}

function formatPlanDates(startDate: string | null, endDate: string | null) {
  if (!startDate && !endDate) return "Dates flexible";
  if (startDate && endDate) return `${startDate} to ${endDate}`;
  return startDate || endDate || "Dates flexible";
}

export default function TravelPlannerClient({ courses }: TravelPlannerClientProps) {
  const { user } = useAuth();
  const { savedCourseIds } = useSavedCourses();
  const { plans, addPlan, removePlan } = useTravelPlanner();
  const [form, setForm] = useState<PlannerFormState>(defaultFormState);
  const [isSearching, setIsSearching] = useState(false);
  const [liveResults, setLiveResults] = useState<TravelSearchResponse | null>(null);

  const savedCourses = useMemo(() => {
    const filtered = courses.filter((course) => savedCourseIds.includes(course.id));
    return filtered.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
  }, [courses, savedCourseIds]);

  const availableCourses = savedCourses.length > 0 ? savedCourses : courses.slice(0, 60);
  const selectedCourse = availableCourses.find((course) => course.id === form.courseId) || availableCourses[0] || null;

  const tripStartDate = selectedCourse?.next_start_date || null;
  const tripEndDate = selectedCourse?.next_end_date || addDays(selectedCourse?.next_start_date || null, 2) || null;
  const destination = selectedCourse?.next_location || selectedCourse?.provider_name || "CE destination";

  const previewPlan = selectedCourse ? {
    destination,
    startDate: tripStartDate,
    endDate: tripEndDate,
    departureAirport: form.departureAirport.trim().toUpperCase(),
  } : null;

  function updateField<Key extends keyof PlannerFormState>(key: Key, value: PlannerFormState[Key]) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function handleCreatePlan() {
    if (!selectedCourse) return;

    addPlan({
      title: `${selectedCourse.title} Trip`,
      courseId: selectedCourse.id,
      courseTitle: selectedCourse.title || "Untitled course",
      destination,
      destinationCode: form.destinationCode.trim().toUpperCase(),
      startDate: tripStartDate,
      endDate: tripEndDate,
      departureAirport: form.departureAirport.trim().toUpperCase(),
      travelers: Number(form.travelers) || 1,
      budget: form.budget.trim(),
      hotelStyle: form.hotelStyle,
      needsCar: form.needsCar,
      notes: form.notes.trim(),
    });

    setForm((current) => ({
      ...defaultFormState,
      courseId: current.courseId,
      destinationCode: current.destinationCode,
    }));
  }

  async function handleLiveSearch() {
    if (!user) return;
    if (!selectedCourse || !tripStartDate) return;

    setIsSearching(true);
    setLiveResults(null);

    try {
      const response = await fetch("/api/travel/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          originCode: form.departureAirport.trim().toUpperCase(),
          destinationCode: form.destinationCode.trim().toUpperCase(),
          departureDate: tripStartDate,
          returnDate: tripEndDate || "",
          adults: Number(form.travelers) || 1,
        }),
      });

      const data = await response.json() as TravelSearchResponse;
      setLiveResults(data);
    } catch {
      setLiveResults({
        configured: false,
        flights: [],
        hotels: [],
        error: "Live travel search is unavailable right now. The outbound search links below still work.",
      });
    } finally {
      setIsSearching(false);
    }
  }

  if (!user) {
    return (
      <div className="travel-shell">
        <section className="travel-hero card">
          <div>
            <p className="packages-builder__eyebrow">Travel Planner</p>
            <h1>Build CE travel plans once you sign in.</h1>
            <p>
              The catalog stays public, but itinerary building, live travel search, and saved planning boards are account-only tools.
            </p>
          </div>
          <div className="travel-hero__stats">
            <div>
              <strong>{courses.length}</strong>
              <span>Courses still visible across the public catalog</span>
            </div>
            <div>
              <strong>Account</strong>
              <span>Required for saved itineraries and personalized planning tools</span>
            </div>
          </div>
        </section>

        <section className="card travel-gate">
          <p className="packages-builder__eyebrow">Members Only</p>
          <h2>Sign in to start building your CE trip.</h2>
          <p>
            Once you create an account, you can save courses, run live travel searches, keep itineraries, and move toward checkout on CEAtlas.
          </p>
          <div className="account-actions">
            <Link href="/account" className="travel-primary">Sign up</Link>
            <Link href="/account" className="travel-secondary">Log in</Link>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="travel-shell">
      <section className="travel-hero card">
        <div>
          <p className="packages-builder__eyebrow">Travel Planner</p>
          <h1>Turn a CE course into a real trip plan.</h1>
          <p>
            Build an itinerary around a saved course, then jump into live hotel, flight, and rental car searches
            while we prepare the deeper booking integrations.
          </p>
        </div>
        <div className="travel-hero__stats">
          <div>
            <strong>{savedCourses.length}</strong>
            <span>Saved courses ready to turn into trips</span>
          </div>
          <div>
            <strong>{plans.length}</strong>
            <span>Saved itineraries in your planner</span>
          </div>
        </div>
      </section>

      <section className="travel-grid">
        <div className="travel-planner card">
          <div className="travel-planner__head">
            <div>
              <p className="packages-builder__eyebrow">Build a Trip</p>
              <h2>Choose a course and shape the logistics.</h2>
            </div>
            {savedCourses.length === 0 ? (
              <p>
                No saved courses yet. You can still prototype a trip below, but the best workflow is to save a course
                first from the <Link href="/courses">catalog</Link>.
              </p>
            ) : (
              <p>Saved courses appear first so the planning flow starts with the CE you actually care about.</p>
            )}
          </div>

          <div className="travel-form">
            <label>
              <span>Course</span>
              <select
                value={form.courseId || selectedCourse?.id || ""}
                onChange={(event) => updateField("courseId", event.target.value)}
              >
                {availableCourses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.title} — {course.next_location || course.provider_name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Departure airport</span>
              <input
                value={form.departureAirport}
                onChange={(event) => updateField("departureAirport", event.target.value)}
                placeholder="DEN"
              />
            </label>

            <label>
              <span>Destination code</span>
              <input
                value={form.destinationCode}
                onChange={(event) => updateField("destinationCode", event.target.value)}
                placeholder="LAS"
              />
            </label>

            <label>
              <span>Travelers</span>
              <select
                value={form.travelers}
                onChange={(event) => updateField("travelers", event.target.value)}
              >
                <option value="1">1 traveler</option>
                <option value="2">2 travelers</option>
                <option value="3">3 travelers</option>
                <option value="4">4 travelers</option>
              </select>
            </label>

            <label>
              <span>Budget</span>
              <input
                value={form.budget}
                onChange={(event) => updateField("budget", event.target.value)}
                placeholder="$2,500 total"
              />
            </label>

            <label>
              <span>Hotel style</span>
              <select
                value={form.hotelStyle}
                onChange={(event) => updateField("hotelStyle", event.target.value)}
              >
                <option value="Comfort">Comfort</option>
                <option value="Upscale">Upscale</option>
                <option value="Luxury">Luxury</option>
                <option value="Resort">Resort</option>
              </select>
            </label>

            <label className="travel-form__checkbox">
              <input
                type="checkbox"
                checked={form.needsCar}
                onChange={(event) => updateField("needsCar", event.target.checked)}
              />
              <span>Plan for a rental car</span>
            </label>

            <label className="travel-form__notes">
              <span>Notes</span>
              <textarea
                value={form.notes}
                onChange={(event) => updateField("notes", event.target.value)}
                placeholder="Spa resort, direct flight only, extend trip for family weekend..."
              />
            </label>
          </div>

          {selectedCourse ? (
            <div className="travel-course-preview">
              <p className="packages-builder__eyebrow">Selected CE Anchor</p>
              <h3>{selectedCourse.title}</h3>
              <p>{summarizeFormat(selectedCourse)}</p>
              <p>{destination}</p>
              <p>{formatPlanDates(tripStartDate, tripEndDate)}</p>
            </div>
          ) : null}

          <div className="travel-actions">
            <button type="button" className="travel-primary" onClick={handleCreatePlan} disabled={!selectedCourse}>
              Save itinerary
            </button>
            <button
              type="button"
              className="travel-secondary"
              onClick={handleLiveSearch}
              disabled={!selectedCourse || !tripStartDate || !form.departureAirport.trim() || !form.destinationCode.trim() || isSearching}
            >
              {isSearching ? "Searching..." : "Search live travel"}
            </button>
          </div>
        </div>

        <div className="travel-links card">
          <p className="packages-builder__eyebrow">Live Search-Out</p>
          <h2>Use real travel sites now while we prepare direct booking integrations.</h2>
          <p>
            This gets dentists planning today: choose the CE course, then jump straight into live travel inventory.
            CEAtlas is not completing travel checkout yet.
          </p>

          {previewPlan ? (
            <div className="travel-link-list">
              <a href={buildFlightSearchUrl(previewPlan)} target="_blank" rel="noreferrer">
                Search flights
              </a>
              <a href={buildBookingUrl(previewPlan)} target="_blank" rel="noreferrer">
                Search hotels
              </a>
              {form.needsCar ? (
                <a href={buildCarSearchUrl(previewPlan)} target="_blank" rel="noreferrer">
                  Search rental cars
                </a>
              ) : null}
            </div>
          ) : (
            <p>Pick a course first and the travel search links will populate automatically.</p>
          )}

          <div className="travel-links__note">
            <strong>Next step:</strong>
            <span>
              These are planning/search links during beta. Confirm all travel prices and booking terms on the travel provider site.
            </span>
          </div>
        </div>
      </section>

      <section className="travel-results">
        <div className="section-heading">
          <h2>Live Travel Results</h2>
          <p>Powered by API search when keys are configured, with search-out links still available underneath.</p>
        </div>

        {!liveResults ? (
          <div className="card travel-empty">
            <h3>No live search yet</h3>
            <p>Enter an origin airport and destination code like `LAS`, then run a live search.</p>
          </div>
        ) : (
          <div className="travel-live-grid">
            <div className="card travel-live-card">
              <div className="travel-live-card__head">
                <h3>Flights</h3>
                <span>{liveResults.flights.length} found</span>
              </div>
              {liveResults.flights.length === 0 ? (
                <p>{liveResults.error || "No live flight results yet."}</p>
              ) : (
                <div className="travel-live-list">
                  {liveResults.flights.map((flight) => (
                    <div key={flight.id} className="travel-live-item">
                      <strong>{flight.total ? `${flight.currency || "USD"} ${flight.total}` : "Price pending"}</strong>
                      <span>{flight.carriers.join(", ") || "Carrier pending"}</span>
                      <span>{flight.departureAt || "Departure pending"} → {flight.arrivalAt || "Arrival pending"}</span>
                      <span>{flight.stops === 0 ? "Nonstop" : `${flight.stops || 0} stop${flight.stops === 1 ? "" : "s"}`}</span>
                      <CompareButton
                        item={{
                          id: `flight-${flight.id}`,
                          kind: "flight",
                          title: `${flight.carriers.join(", ") || "Flight option"} flight`,
                          priceText: flight.total ? `${flight.currency || "USD"} ${flight.total}` : "Price pending",
                          location: `${form.departureAirport.trim().toUpperCase()} to ${form.destinationCode.trim().toUpperCase()}`,
                          dateText: `${flight.departureAt || "Departure pending"} → ${flight.arrivalAt || "Arrival pending"}`,
                          details: [flight.stops === 0 ? "Nonstop" : `${flight.stops || 0} stops`],
                        }}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="card travel-live-card">
              <div className="travel-live-card__head">
                <h3>Hotels</h3>
                <span>{liveResults.hotels.length} found</span>
              </div>
              {liveResults.hotels.length === 0 ? (
                <p>Hotel API results may need a city-style code such as `LAS`, `NYC`, or `CHI`.</p>
              ) : (
                <div className="travel-live-list">
                  {liveResults.hotels.map((hotel) => (
                    <div key={hotel.id} className="travel-live-item">
                      <strong>{hotel.name}</strong>
                      <span>{hotel.cityCode || "City pending"}</span>
                      <span>{hotel.total ? `${hotel.currency || "USD"} ${hotel.total}` : "Rate pending"}</span>
                      <CompareButton
                        item={{
                          id: `hotel-${hotel.id}`,
                          kind: "hotel",
                          title: hotel.name,
                          location: hotel.cityCode || destination,
                          priceText: hotel.total ? `${hotel.currency || "USD"} ${hotel.total}` : "Rate pending",
                          dateText: formatPlanDates(tripStartDate, tripEndDate),
                        }}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {liveResults?.warnings?.length ? (
          <div className="travel-warnings">
            {liveResults.warnings.map((warning) => (
              <p key={warning}>{warning}</p>
            ))}
          </div>
        ) : null}
      </section>

      <section className="travel-board">
        <div className="section-heading">
          <h2>Saved Itineraries</h2>
          <p>Keep course ideas, departure plans, and hotel style in one place while you shape the trip.</p>
        </div>

        {plans.length === 0 ? (
          <div className="card travel-empty">
            <h3>No saved itineraries yet</h3>
            <p>Build one above and it will stay here in your browser as your planning board.</p>
          </div>
        ) : (
          <div className="travel-plan-grid">
            {plans.map((plan) => (
              <article key={plan.id} className="card travel-plan-card">
                <div className="travel-plan-card__top">
                  <div>
                    <p className="packages-builder__eyebrow">Itinerary</p>
                    <h3>{plan.title}</h3>
                  </div>
                  <button type="button" onClick={() => removePlan(plan.id)}>
                    Remove
                  </button>
                </div>
                <p>{plan.courseTitle}</p>
                <p>{plan.destination}</p>
                {plan.destinationCode ? <p>Code: {plan.destinationCode}</p> : null}
                <p>{formatPlanDates(plan.startDate, plan.endDate)}</p>
                <p>{plan.departureAirport ? `From ${plan.departureAirport}` : "Departure airport flexible"}</p>
                <p>{plan.travelers} traveler{plan.travelers === 1 ? "" : "s"} • {plan.hotelStyle}</p>
                {plan.budget ? <p>Budget: {plan.budget}</p> : null}
                {plan.notes ? <p>{plan.notes}</p> : null}
                <div className="travel-link-list">
                  <a
                    href={buildFlightSearchUrl({
                      destination: plan.destination,
                      startDate: plan.startDate,
                      endDate: plan.endDate,
                      departureAirport: plan.departureAirport,
                    })}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Flights
                  </a>
                  <a
                    href={buildBookingUrl({
                      destination: plan.destination,
                      startDate: plan.startDate,
                      endDate: plan.endDate,
                    })}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Hotels
                  </a>
                  {plan.needsCar ? (
                    <a
                      href={buildCarSearchUrl({
                        destination: plan.destination,
                        startDate: plan.startDate,
                        endDate: plan.endDate,
                      })}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Cars
                    </a>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
