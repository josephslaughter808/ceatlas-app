"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { track } from "@vercel/analytics";
import type { CourseRecord } from "@/lib/courses";
import type {
  TravelBookingRecord,
  TravelCarOption,
  TravelCheckoutDraft,
  TravelFlightOption,
  TravelHotelOption,
  TravelItineraryDraft,
  TravelSearchResponse,
} from "@/lib/travel/providers/types";
import { buildItineraryPriceBreakdown } from "@/lib/travel/itinerary";
import { useSavedCourses } from "./saved-courses-provider";
import { useAuth } from "./auth-provider";
import CompareButton from "./compare-button";

type TravelPlannerClientProps = {
  courses?: CourseRecord[];
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

function addDays(dateText: string | null, days: number) {
  if (!dateText) return "";
  const date = new Date(dateText);
  if (Number.isNaN(date.getTime())) return "";
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
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

function formatMoney(amount: number | null | undefined, currency = "USD") {
  if (amount == null || !Number.isFinite(amount)) return "Price pending";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

function toRecord(item: TravelFlightOption | TravelHotelOption | TravelCarOption) {
  if ("carriers" in item) {
    return {
      kind: "flight" as const,
      title: item.title,
      location: `${item.departureAt || "Departure pending"} → ${item.arrivalAt || "Arrival pending"}`,
      priceText: formatMoney(item.totalAmount, item.currency || "USD"),
      dateText: item.carriers.join(", ") || "Flight option",
      details: [item.stops === 0 ? "Nonstop" : `${item.stops || 0} stops`],
    };
  }

  if ("vehicleType" in item) {
    return {
      kind: "car" as const,
      title: item.name,
      location: item.pickupCode || "Pickup pending",
      priceText: formatMoney(item.totalAmount, item.currency || "USD"),
      dateText: item.vehicleType || "Rental car",
      details: [],
    };
  }

  return {
    kind: "hotel" as const,
    title: item.name,
    location: item.cityCode || "Destination pending",
    priceText: formatMoney(item.totalAmount, item.currency || "USD"),
    dateText: item.rating ? `${item.rating.toFixed(1)} rating` : "Hotel option",
    details: [],
  };
}

export default function TravelPlannerClient({ courses: initialCourses = [] }: TravelPlannerClientProps) {
  const { user, session } = useAuth();
  const { savedCourseIds } = useSavedCourses();
  const [form, setForm] = useState<PlannerFormState>(defaultFormState);
  const [isSearching, setIsSearching] = useState(false);
  const [savingItinerary, setSavingItinerary] = useState(false);
  const [preparingCheckout, setPreparingCheckout] = useState(false);
  const [travelMessage, setTravelMessage] = useState<string | null>(null);
  const [liveResults, setLiveResults] = useState<TravelSearchResponse | null>(null);
  const [catalogCourses, setCatalogCourses] = useState<CourseRecord[]>(initialCourses);
  const [savedCourseRecords, setSavedCourseRecords] = useState<CourseRecord[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(initialCourses.length === 0);
  const [selectedFlightId, setSelectedFlightId] = useState("");
  const [selectedHotelId, setSelectedHotelId] = useState("");
  const [selectedCarId, setSelectedCarId] = useState("");
  const [activeDraft, setActiveDraft] = useState<TravelItineraryDraft | null>(null);
  const [checkoutDraft, setCheckoutDraft] = useState<TravelCheckoutDraft | null>(null);
  const [savedItineraries, setSavedItineraries] = useState<TravelBookingRecord[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function loadCatalogCourses() {
      setCoursesLoading(true);
      try {
        const response = await fetch("/api/featured-courses?limit=60");
        if (!response.ok) return;
        const nextCourses = await response.json();
        if (!cancelled) {
          setCatalogCourses(nextCourses);
        }
      } finally {
        if (!cancelled) {
          setCoursesLoading(false);
        }
      }
    }

    loadCatalogCourses();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadSavedCourseRecords() {
      if (savedCourseIds.length === 0) {
        setSavedCourseRecords([]);
        return;
      }

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
        setSavedCourseRecords(nextCourses);
      }
    }

    loadSavedCourseRecords();

    return () => {
      cancelled = true;
    };
  }, [savedCourseIds]);

  useEffect(() => {
    let cancelled = false;
    async function loadItineraries() {
      if (!session?.access_token) {
        setSavedItineraries([]);
        return;
      }

      const response = await fetch("/api/travel/itinerary", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || cancelled) return;
      setSavedItineraries(payload?.itineraries || []);
    }

    loadItineraries();
    return () => {
      cancelled = true;
    };
  }, [session?.access_token]);

  const savedCourses = useMemo(() => {
    return [...savedCourseRecords].sort((a, b) => (a.title || "").localeCompare(b.title || ""));
  }, [savedCourseRecords]);

  const availableCourses = savedCourses.length > 0 ? savedCourses : catalogCourses;
  const selectedCourse = availableCourses.find((course) => course.id === form.courseId) || availableCourses[0] || null;

  const tripStartDate = selectedCourse?.next_start_date || null;
  const tripEndDate = selectedCourse?.next_end_date || addDays(selectedCourse?.next_start_date || null, 2) || null;
  const destination = selectedCourse?.next_location || selectedCourse?.provider_name || "CE destination";

  const selectedFlight = liveResults?.flights.find((item) => item.id === selectedFlightId) || null;
  const selectedHotel = liveResults?.hotels.find((item) => item.id === selectedHotelId) || null;
  const selectedCar = liveResults?.cars.find((item) => item.id === selectedCarId) || null;
  const currentPriceBreakdown = useMemo(() => buildItineraryPriceBreakdown({
    selectedFlight,
    selectedHotel,
    selectedCar: form.needsCar ? selectedCar : null,
  }), [form.needsCar, selectedCar, selectedFlight, selectedHotel]);

  function updateField<Key extends keyof PlannerFormState>(key: Key, value: PlannerFormState[Key]) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  async function handleLiveSearch() {
    if (!user || !selectedCourse || !tripStartDate) return;

    track("travel_live_search", {
      course_id: selectedCourse.id,
      has_departure_airport: Boolean(form.departureAirport.trim()),
      has_destination_code: Boolean(form.destinationCode.trim()),
      travelers: Number(form.travelers) || 1,
    });

    setIsSearching(true);
    setTravelMessage(null);
    setCheckoutDraft(null);

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
      setSelectedFlightId(data.flights[0]?.id || "");
      setSelectedHotelId(data.hotels[0]?.id || "");
      setSelectedCarId(data.cars[0]?.id || "");
      if (data.error) {
        setTravelMessage(data.error);
      } else if (data.warnings.length > 0) {
        setTravelMessage(data.warnings[0]);
      }
    } catch {
      setLiveResults(null);
      setTravelMessage("Live travel search is unavailable right now.");
    } finally {
      setIsSearching(false);
    }
  }

  async function handleCreatePlan() {
    if (!session?.access_token || !selectedCourse) return null;

    setSavingItinerary(true);
    setTravelMessage(null);

    try {
      const response = await fetch("/api/travel/itinerary", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          itineraryId: activeDraft?.id || null,
          title: `${selectedCourse.title} Trip`,
          courseId: selectedCourse.id,
          courseTitle: selectedCourse.title,
          destination,
          destinationCode: form.destinationCode.trim().toUpperCase(),
          departureAirport: form.departureAirport.trim().toUpperCase(),
          startDate: tripStartDate,
          endDate: tripEndDate,
          travelers: Number(form.travelers) || 1,
          budget: form.budget,
          hotelStyle: form.hotelStyle,
          needsCar: form.needsCar,
          notes: form.notes,
          selectedFlight,
          selectedHotel,
          selectedCar: form.needsCar ? selectedCar : null,
          providers: liveResults?.providers,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Unable to save itinerary.");
      }

      setActiveDraft(payload.itinerary);
      setCheckoutDraft(null);
      setTravelMessage("Itinerary saved to your CEAtlas account.");

      const refresh = await fetch("/api/travel/itinerary", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      const refreshPayload = await refresh.json().catch(() => null);
      if (refresh.ok) {
        setSavedItineraries(refreshPayload?.itineraries || []);
      }
      return payload.itinerary as TravelItineraryDraft;
    } catch (error) {
      setTravelMessage(error instanceof Error ? error.message : "Unable to save itinerary.");
      return null;
    } finally {
      setSavingItinerary(false);
    }
  }

  async function handlePrepareCheckout() {
    if (!session?.access_token) return;

    let itinerary = activeDraft;
    if (!itinerary) {
      itinerary = await handleCreatePlan();
    }
    if (!itinerary) {
      setTravelMessage("Save the itinerary before preparing checkout.");
      return;
    }

    setPreparingCheckout(true);
    setTravelMessage(null);

    try {
      const response = await fetch("/api/travel/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          itinerary,
          providers: liveResults?.providers,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Unable to prepare checkout.");
      }

      setCheckoutDraft(payload.checkout);
      if (payload.checkout?.stripeCheckoutUrl) {
        setTravelMessage("Checkout is ready. Use the button below to pay on CEAtlas.");
      } else {
        setTravelMessage("Checkout draft prepared. Add Stripe keys to activate live payment collection.");
      }
    } catch (error) {
      setTravelMessage(error instanceof Error ? error.message : "Unable to prepare checkout.");
    } finally {
      setPreparingCheckout(false);
    }
  }

  if (!user) {
    return (
      <div className="travel-shell">
        <section className="travel-hero card">
          <div>
            <p className="packages-builder__eyebrow">Travel Planner</p>
            <h1>Build CE travel plans once you sign in.</h1>
            <p>The catalog stays public, but itinerary building, live travel search, and saved planning boards are account-only tools.</p>
          </div>
          <div className="travel-hero__stats">
            <div>
              <strong>{coursesLoading ? "..." : catalogCourses.length}</strong>
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
          <p>Once you create an account, you can save courses, run live travel searches, keep itineraries, and move toward checkout on CEAtlas.</p>
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
          <h1>Build and price a CE trip on CEAtlas.</h1>
          <p>Choose a course, search live supplier inventory, select flights, hotels, and cars, then prepare a CEAtlas checkout with your service-fee breakdown.</p>
        </div>
        <div className="travel-hero__stats">
          <div>
            <strong>{savedCourses.length}</strong>
            <span>Saved courses ready to turn into trips</span>
          </div>
          <div>
            <strong>{savedItineraries.length}</strong>
            <span>Itineraries recorded in your CEAtlas account</span>
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
            <p>Saved courses appear first, then CEAtlas searches travel around that course anchor and date window.</p>
          </div>

          <div className="travel-form">
            <label>
              <span>Course</span>
              <select value={form.courseId || selectedCourse?.id || ""} onChange={(event) => updateField("courseId", event.target.value)} disabled={coursesLoading || availableCourses.length === 0}>
                {coursesLoading ? <option>Loading courses...</option> : availableCourses.map((course) => (
                  <option key={course.id} value={course.id}>{course.title} — {course.next_location || course.provider_name}</option>
                ))}
              </select>
            </label>

            <label>
              <span>Departure airport</span>
              <input value={form.departureAirport} onChange={(event) => updateField("departureAirport", event.target.value)} placeholder="DEN" />
            </label>

            <label>
              <span>Destination code</span>
              <input value={form.destinationCode} onChange={(event) => updateField("destinationCode", event.target.value)} placeholder="LAS" />
            </label>

            <label>
              <span>Travelers</span>
              <select value={form.travelers} onChange={(event) => updateField("travelers", event.target.value)}>
                <option value="1">1 traveler</option>
                <option value="2">2 travelers</option>
                <option value="3">3 travelers</option>
                <option value="4">4 travelers</option>
              </select>
            </label>

            <label>
              <span>Budget</span>
              <input value={form.budget} onChange={(event) => updateField("budget", event.target.value)} placeholder="$2,500 total" />
            </label>

            <label>
              <span>Hotel style</span>
              <select value={form.hotelStyle} onChange={(event) => updateField("hotelStyle", event.target.value)}>
                <option value="Comfort">Comfort</option>
                <option value="Upscale">Upscale</option>
                <option value="Luxury">Luxury</option>
                <option value="Resort">Resort</option>
              </select>
            </label>

            <label className="travel-form__checkbox">
              <input type="checkbox" checked={form.needsCar} onChange={(event) => updateField("needsCar", event.target.checked)} />
              <span>Include rental car planning</span>
            </label>

            <label className="travel-form__notes">
              <span>Notes</span>
              <textarea value={form.notes} onChange={(event) => updateField("notes", event.target.value)} placeholder="Direct flight only, walkable hotel, family extension..." />
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
            <button type="button" className="travel-secondary" onClick={handleLiveSearch} disabled={!selectedCourse || !tripStartDate || !form.departureAirport.trim() || !form.destinationCode.trim() || isSearching}>
              {isSearching ? "Searching..." : "Search live travel"}
            </button>
            <button type="button" className="travel-primary" onClick={handleCreatePlan} disabled={!selectedCourse || savingItinerary}>
              {savingItinerary ? "Saving..." : "Save itinerary to account"}
            </button>
          </div>
        </div>

        <div className="travel-links card">
          <p className="packages-builder__eyebrow">Checkout Summary</p>
          <h2>CEAtlas fee and booking draft</h2>
          <p>CEAtlas applies a 7% service fee to the selected travel subtotal. The checkout summary below is what we will send into Stripe.</p>
          <div className="travel-checkout-summary">
            <div><strong>Subtotal</strong><span>{formatMoney(currentPriceBreakdown.subtotal, currentPriceBreakdown.currency)}</span></div>
            <div><strong>CEAtlas fee</strong><span>{formatMoney(currentPriceBreakdown.serviceFee, currentPriceBreakdown.currency)}</span></div>
            <div><strong>Total</strong><span>{formatMoney(currentPriceBreakdown.total, currentPriceBreakdown.currency)}</span></div>
          </div>
          <div className="travel-actions">
            <button type="button" className="travel-primary" onClick={handlePrepareCheckout} disabled={!activeDraft && !selectedCourse || preparingCheckout}>
              {preparingCheckout ? "Preparing..." : "Prepare checkout"}
            </button>
            {checkoutDraft?.stripeCheckoutUrl ? (
              <a className="travel-secondary" href={checkoutDraft.stripeCheckoutUrl}>Open CEAtlas checkout</a>
            ) : null}
          </div>
          {checkoutDraft ? (
            <div className="travel-links__note">
              <strong>Checkout state:</strong>
              <span>{checkoutDraft.stripeCheckoutUrl ? "Stripe checkout ready." : "Draft ready; Stripe keys still needed for live payment."}</span>
            </div>
          ) : null}
          {travelMessage ? <p className="account-message">{travelMessage}</p> : null}
        </div>
      </section>

      <section className="travel-results">
        <div className="section-heading">
          <h2>Live Travel Results</h2>
          <p>Flights come from Duffel when configured, hotels and cars come from Booking.com when configured, and Amadeus remains the temporary fallback.</p>
        </div>

        {!liveResults ? (
          <div className="card travel-empty">
            <h3>No live search yet</h3>
            <p>Enter an origin airport and destination code like `LAS`, then run a live search.</p>
          </div>
        ) : (
          <>
            <div className="travel-provider-status">
              <span>{liveResults.providers.flights.provider}: {liveResults.providers.flights.mode}</span>
              <span>{liveResults.providers.hotels.provider}: {liveResults.providers.hotels.mode}</span>
              <span>{liveResults.providers.cars.provider}: {liveResults.providers.cars.mode}</span>
            </div>

            <div className="travel-live-grid">
              <div className="card travel-live-card">
                <div className="travel-live-card__head">
                  <h3>Flights</h3>
                  <span>{liveResults.flights.length} found</span>
                </div>
                {liveResults.flights.length === 0 ? (
                  <p>No flight results yet.</p>
                ) : (
                  <div className="travel-live-list">
                    {liveResults.flights.map((flight) => (
                      <div key={flight.id} className={`travel-live-item ${selectedFlightId === flight.id ? "travel-live-item--selected" : ""}`}>
                        <strong>{formatMoney(flight.totalAmount, flight.currency || "USD")}</strong>
                        <span>{flight.title}</span>
                        <span>{flight.departureAt || "Departure pending"} → {flight.arrivalAt || "Arrival pending"}</span>
                        <span>{flight.stops === 0 ? "Nonstop" : `${flight.stops || 0} stop${flight.stops === 1 ? "" : "s"}`}</span>
                        <div className="travel-live-actions">
                          <button type="button" className="travel-secondary" onClick={() => setSelectedFlightId(flight.id)}>
                            {selectedFlightId === flight.id ? "Selected" : "Select"}
                          </button>
                          <CompareButton item={{ id: `flight-${flight.id}`, ...toRecord(flight) }} />
                        </div>
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
                  <p>No hotel results yet.</p>
                ) : (
                  <div className="travel-live-list">
                    {liveResults.hotels.map((hotel) => (
                      <div key={hotel.id} className={`travel-live-item ${selectedHotelId === hotel.id ? "travel-live-item--selected" : ""}`}>
                        <strong>{hotel.name}</strong>
                        <span>{hotel.cityCode || destination}</span>
                        <span>{formatMoney(hotel.totalAmount, hotel.currency || "USD")}</span>
                        <div className="travel-live-actions">
                          <button type="button" className="travel-secondary" onClick={() => setSelectedHotelId(hotel.id)}>
                            {selectedHotelId === hotel.id ? "Selected" : "Select"}
                          </button>
                          <CompareButton item={{ id: `hotel-${hotel.id}`, ...toRecord(hotel) }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="card travel-live-card">
                <div className="travel-live-card__head">
                  <h3>Rental cars</h3>
                  <span>{liveResults.cars.length} found</span>
                </div>
                {liveResults.cars.length === 0 ? (
                  <p>Rental car results will appear here when Booking.com car access is configured.</p>
                ) : (
                  <div className="travel-live-list">
                    {liveResults.cars.map((car) => (
                      <div key={car.id} className={`travel-live-item ${selectedCarId === car.id ? "travel-live-item--selected" : ""}`}>
                        <strong>{car.name}</strong>
                        <span>{car.vehicleType || "Vehicle type pending"}</span>
                        <span>{formatMoney(car.totalAmount, car.currency || "USD")}</span>
                        <div className="travel-live-actions">
                          <button type="button" className="travel-secondary" onClick={() => setSelectedCarId(car.id)}>
                            {selectedCarId === car.id ? "Selected" : "Select"}
                          </button>
                          <CompareButton item={{ id: `car-${car.id}`, ...toRecord(car) }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
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
          <p>These itineraries are stored with your CEAtlas account so they can become real orders and purchase records.</p>
        </div>

        {savedItineraries.length === 0 ? (
          <div className="card travel-empty">
            <h3>No saved itineraries yet</h3>
            <p>Search travel, select options, and save the itinerary above.</p>
          </div>
        ) : (
          <div className="travel-plan-grid">
            {savedItineraries.map((plan) => (
              <article key={plan.orderId} className="card travel-plan-card">
                <div className="travel-plan-card__top">
                  <div>
                    <p className="packages-builder__eyebrow">Itinerary</p>
                    <h3>{plan.destination || "Travel order"}</h3>
                  </div>
                  <span>{plan.status}</span>
                </div>
                <p>{formatPlanDates(plan.startsOn, plan.endsOn)}</p>
                <p>{formatMoney(plan.totalAmount, plan.currency || "USD")}{plan.serviceFeeAmount ? ` • fee ${formatMoney(plan.serviceFeeAmount, plan.currency || "USD")}` : ""}</p>
                {plan.providerReferences.length > 0 ? (
                  <div className="account-list">
                    {plan.providerReferences.map((reference) => (
                      <span key={reference}>{reference}</span>
                    ))}
                  </div>
                ) : (
                  <p>Provider references will appear here after live booking confirmation.</p>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
