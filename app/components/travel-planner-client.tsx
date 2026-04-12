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
import { inferAirportCodeFromLocation } from "@/lib/travel/airport-lookup";
import { useAuth } from "./auth-provider";
import CompareButton from "./compare-button";
import { useTripCart } from "./trip-cart-provider";

const HOME_AIRPORT_STORAGE_KEY = "ceatlas:home-airport";

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

function formatFlightDateTime(value: string | null | undefined) {
  if (!value) return "Time pending";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatFlightDay(value: string | null | undefined) {
  if (!value) return "Day pending";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  }).format(date);
}

function formatFlightTime(value: string | null | undefined) {
  if (!value) return "Time pending";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatFlightLine(
  fromCode: string | null | undefined,
  toCode: string | null | undefined,
  departAt: string | null | undefined,
  arriveAt: string | null | undefined,
) {
  return `${fromCode || "Origin"} to ${toCode || "Destination"} • ${formatFlightDay(departAt)} • ${formatFlightTime(departAt)} to ${formatFlightTime(arriveAt)}`;
}

function formatCourseSchedule(startDate: string | null, endDate: string | null) {
  if (startDate && endDate && startDate === endDate) {
    const date = new Date(startDate);
    if (!Number.isNaN(date.getTime())) {
      return new Intl.DateTimeFormat("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
      }).format(date);
    }
  }

  return formatPlanDates(startDate, endDate);
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
  const { tripCourseIds } = useTripCart();
  const [form, setForm] = useState<PlannerFormState>(defaultFormState);
  const [isSearching, setIsSearching] = useState(false);
  const [savingItinerary, setSavingItinerary] = useState(false);
  const [preparingCheckout, setPreparingCheckout] = useState(false);
  const [travelMessage, setTravelMessage] = useState<string | null>(null);
  const [liveResults, setLiveResults] = useState<TravelSearchResponse | null>(null);
  const [tripCourseRecords, setTripCourseRecords] = useState<CourseRecord[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(false);
  const [selectedFlightId, setSelectedFlightId] = useState("");
  const [selectedHotelId, setSelectedHotelId] = useState("");
  const [selectedCarId, setSelectedCarId] = useState("");
  const [activeDraft, setActiveDraft] = useState<TravelItineraryDraft | null>(null);
  const [checkoutDraft, setCheckoutDraft] = useState<TravelCheckoutDraft | null>(null);
  const [savedItineraries, setSavedItineraries] = useState<TravelBookingRecord[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function loadTripCourseRecords() {
      if (tripCourseIds.length === 0) {
        setTripCourseRecords([]);
        return;
      }

      setCoursesLoading(true);
      const response = await fetch("/api/courses-by-ids", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ids: tripCourseIds }),
      });
      if (response.ok) {
        const nextCourses = await response.json();
        if (!cancelled) {
          setTripCourseRecords(nextCourses);
        }
      }
      if (!cancelled) {
        setCoursesLoading(false);
      }
    }

    loadTripCourseRecords();

    return () => {
      cancelled = true;
    };
  }, [tripCourseIds]);

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

  const cartCourses = useMemo(() => {
    return [...tripCourseRecords].sort((a, b) => (a.title || "").localeCompare(b.title || ""));
  }, [tripCourseRecords]);

  const availableCourses = cartCourses;
  const selectedCourse = availableCourses.find((course) => course.id === form.courseId) || availableCourses[0] || null;

  const tripStartDate = selectedCourse?.next_start_date || null;
  const tripEndDate = selectedCourse?.next_end_date || addDays(selectedCourse?.next_start_date || null, 2) || null;
  const destination = selectedCourse?.next_location || selectedCourse?.provider_name || "CE destination";
  const inferredDestinationCode = inferAirportCodeFromLocation(selectedCourse?.next_location);

  useEffect(() => {
    if (!availableCourses.length) {
      if (form.courseId) {
        setForm(defaultFormState);
      }
      return;
    }

    if (!form.courseId || !availableCourses.some((course) => course.id === form.courseId)) {
      setForm((current) => ({
        ...current,
        courseId: availableCourses[0].id,
      }));
    }
  }, [availableCourses, form.courseId]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const metadataAirport = String(user?.user_metadata?.home_airport || "").trim().toUpperCase();
    const storedAirport = String(window.localStorage.getItem(HOME_AIRPORT_STORAGE_KEY) || "").trim().toUpperCase();
    const nextAirport = metadataAirport || storedAirport;
    if (!nextAirport) return;

    setForm((current) => ({
      ...current,
      departureAirport: current.departureAirport || nextAirport,
    }));
  }, [user?.user_metadata?.home_airport]);

  useEffect(() => {
    if (!selectedCourse) return;

    setForm((current) => {
      const nextDestinationCode = inferredDestinationCode || current.destinationCode;
      if (nextDestinationCode === current.destinationCode && current.courseId === selectedCourse.id) {
        return current;
      }

      return {
        ...current,
        courseId: selectedCourse.id,
        destinationCode: nextDestinationCode,
      };
    });
  }, [inferredDestinationCode, selectedCourse]);

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

  useEffect(() => {
    if (!user || !selectedCourse || !tripStartDate) return;
    if (!form.departureAirport.trim() || !form.destinationCode.trim()) return;

    const timeout = window.setTimeout(() => {
      void handleLiveSearch();
    }, 450);

    return () => window.clearTimeout(timeout);
  }, [
    user,
    selectedCourse?.id,
    tripStartDate,
    tripEndDate,
    form.departureAirport,
    form.destinationCode,
    form.travelers,
    form.needsCar,
  ]);

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
              <strong>{tripCourseIds.length}</strong>
              <span>Courses currently sitting in your trip cart</span>
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
            <Link href="/account?mode=signup" className="travel-primary">Sign up</Link>
            <Link href="/account?mode=signin" className="travel-secondary">Log in</Link>
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
            <strong>{cartCourses.length}</strong>
            <span>Trip-cart courses ready to turn into itineraries</span>
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
              <h2>Choose a cart course and shape the logistics.</h2>
            </div>
            <p>Your trip cart drives this planner. CEAtlas auto-fills the route around the selected course, date window, and your saved home airport.</p>
          </div>

          {availableCourses.length === 0 ? (
            <div className="travel-empty">
              <h3>Your trip cart is empty.</h3>
              <p>Add courses to the trip cart from the course catalog, then come back here to build flights, hotels, and rental plans around them.</p>
              <div className="account-actions">
                <Link href="/courses" className="travel-primary">Browse courses</Link>
              </div>
            </div>
          ) : (
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
                <span>Home airport</span>
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
          )}

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
            <button type="button" className="travel-secondary" onClick={handleLiveSearch} disabled={!selectedCourse || !tripStartDate || !form.departureAirport.trim() || !form.destinationCode.trim() || isSearching || availableCourses.length === 0}>
              {isSearching ? "Searching..." : "Refresh live options"}
            </button>
            <button type="button" className="travel-primary" onClick={handleCreatePlan} disabled={!selectedCourse || savingItinerary || availableCourses.length === 0}>
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
          <p>Flights come from Duffel when configured, hotels and cars come from Booking.com when configured, and CEAtlas refreshes the route automatically around your selected cart course.</p>
        </div>

        {!liveResults ? (
          <div className="card travel-empty">
            <h3>No live search yet</h3>
            <p>Select a trip-cart course and make sure your home airport and destination code are filled in. CEAtlas will update live options automatically from there.</p>
          </div>
        ) : (
          <>
            <div className="travel-provider-status">
              <span>{liveResults.providers.flights.provider}: {liveResults.providers.flights.mode}</span>
              <span>{liveResults.providers.hotels.provider}: {liveResults.providers.hotels.mode}</span>
              <span>{liveResults.providers.cars.provider}: {liveResults.providers.cars.mode}</span>
            </div>
            {liveResults.providers.flights.message ? (
              <div className="travel-warnings">
                <p>{liveResults.providers.flights.message}</p>
              </div>
            ) : null}

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
                        <div className="flight-leg">
                          <span className="flight-leg__label">Outbound</span>
                          <span className="flight-leg__summary">
                            Leave <strong>{formatFlightDay(flight.departureAt)}</strong> at <strong className="flight-leg__time">{formatFlightTime(flight.departureAt)}</strong>
                          </span>
                          <span className="flight-leg__route">
                            {flight.originCode || form.departureAirport || "Origin"} to {flight.destinationCode || form.destinationCode || "Destination"}
                            {" "}
                            arriving at <strong className="flight-leg__time">{formatFlightTime(flight.arrivalAt)}</strong>
                          </span>
                        </div>
                        {flight.returnDepartureAt || flight.returnArrivalAt ? (
                          <div className="flight-leg">
                            <span className="flight-leg__label">Return</span>
                            <span className="flight-leg__summary">
                              Leave <strong>{formatFlightDay(flight.returnDepartureAt)}</strong> at <strong className="flight-leg__time">{formatFlightTime(flight.returnDepartureAt)}</strong>
                            </span>
                            <span className="flight-leg__route">
                              {flight.returnOriginCode || flight.destinationCode || form.destinationCode || "Destination"} to {flight.returnDestinationCode || flight.originCode || form.departureAirport || "Origin"}
                              {" "}
                              arriving at <strong className="flight-leg__time">{formatFlightTime(flight.returnArrivalAt)}</strong>
                            </span>
                          </div>
                        ) : (
                          <span>Return: one-way or not returned by supplier yet</span>
                        )}
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

        <section className="itinerary-option itinerary-option--dashboard travel-itinerary-live">
          <div className="itinerary-option__intro">
            <div>
              <p className="packages-builder__eyebrow">Selected Itinerary</p>
              <h2>Structured trip summary</h2>
            </div>
            <p>Your trip stays visible here while you choose flights, hotels, and rental cars. Any card you have not picked yet will stay in place until you do.</p>
          </div>

          <div className="itinerary-option__body">
            <div className="itinerary-option__main">
              <div className="itinerary-detail-card">
                <p className="itinerary-detail-card__eyebrow">Course</p>
                {selectedCourse ? (
                  <>
                    <h3>{selectedCourse.title}</h3>
                    <p>{destination}</p>
                    <p>{formatCourseSchedule(tripStartDate, tripEndDate)}</p>
                  </>
                ) : (
                  <>
                    <h3>Not selected yet</h3>
                    <p>Choose a course from your cart to anchor the itinerary.</p>
                  </>
                )}
              </div>

              <div className="itinerary-detail-card itinerary-detail-card--flight">
                <p className="itinerary-detail-card__eyebrow">Flight</p>
                {selectedFlight ? (
                  <>
                    <h3>{selectedFlight.title}</h3>
                    <div className="itinerary-flight">
                      <div className="itinerary-flight__row">
                        <span className="itinerary-flight__label">Outbound</span>
                        <div className="itinerary-flight__content">
                          <p>
                            Leave <strong>{formatFlightDay(selectedFlight.departureAt)}</strong> at{" "}
                            <strong className="itinerary-flight__time">{formatFlightTime(selectedFlight.departureAt)}</strong>
                          </p>
                          <p>
                            {(selectedFlight.originCode || form.departureAirport || "Origin")} to {(selectedFlight.destinationCode || form.destinationCode || "Destination")}, arrive at{" "}
                            <strong className="itinerary-flight__time">{formatFlightTime(selectedFlight.arrivalAt)}</strong>
                          </p>
                        </div>
                      </div>
                      <div className="itinerary-flight__row">
                        <span className="itinerary-flight__label">Inbound</span>
                        <div className="itinerary-flight__content">
                          {selectedFlight.returnDepartureAt || selectedFlight.returnArrivalAt ? (
                            <>
                              <p>
                                Leave <strong>{formatFlightDay(selectedFlight.returnDepartureAt)}</strong> at{" "}
                                <strong className="itinerary-flight__time">{formatFlightTime(selectedFlight.returnDepartureAt)}</strong>
                              </p>
                              <p>
                                {(selectedFlight.returnOriginCode || selectedFlight.destinationCode || form.destinationCode || "Destination")} to {(selectedFlight.returnDestinationCode || selectedFlight.originCode || form.departureAirport || "Origin")}, arrive at{" "}
                                <strong className="itinerary-flight__time">{formatFlightTime(selectedFlight.returnArrivalAt)}</strong>
                              </p>
                            </>
                          ) : (
                            <p>Not selected yet</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <h3>Not selected yet</h3>
                    <div className="itinerary-flight">
                      <div className="itinerary-flight__row">
                        <span className="itinerary-flight__label">Outbound</span>
                        <div className="itinerary-flight__content">
                          <p>Pick a flight above and the outbound leg will show here.</p>
                        </div>
                      </div>
                      <div className="itinerary-flight__row">
                        <span className="itinerary-flight__label">Inbound</span>
                        <div className="itinerary-flight__content">
                          <p>Your return leg will stay visible here once selected.</p>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div className="itinerary-detail-card">
                <p className="itinerary-detail-card__eyebrow">Hotel</p>
                {selectedHotel ? (
                  <>
                    <h3>{selectedHotel.name}</h3>
                    <p>{selectedHotel.cityCode || destination}</p>
                    <p>{selectedHotel.rating ? `${selectedHotel.rating.toFixed(1)} star rating` : "Hotel option selected"}</p>
                    <p>{formatMoney(selectedHotel.totalAmount, selectedHotel.currency || "USD")}</p>
                  </>
                ) : (
                  <>
                    <h3>Not selected yet</h3>
                    <p>Pick a hotel above and CEAtlas will add it to this itinerary.</p>
                  </>
                )}
              </div>

              <div className="itinerary-detail-card">
                <p className="itinerary-detail-card__eyebrow">Car</p>
                {selectedCar ? (
                  <>
                    <h3>{selectedCar.name}</h3>
                    <p>{selectedCar.vehicleType || "Vehicle details pending"}</p>
                    <p>Pickup {selectedCar.pickupCode || form.destinationCode || "Destination airport"}</p>
                    <p>{formatMoney(selectedCar.totalAmount, selectedCar.currency || "USD")}</p>
                  </>
                ) : (
                  <>
                    <h3>Not selected yet</h3>
                    <p>{form.needsCar ? "Pick a rental car above and it will appear here." : "Rental car planning is turned off for this itinerary right now."}</p>
                  </>
                )}
              </div>
            </div>

            <div className="itinerary-option__side">
              <div className="itinerary-checkout-card">
                <p className="itinerary-detail-card__eyebrow">Checkout</p>
                <h3>CEAtlas Trip Total</h3>
                <div className="itinerary-checkout-card__rows">
                  <div><span>Flight</span><strong>{formatMoney(selectedFlight?.totalAmount ?? 0, selectedFlight?.currency || currentPriceBreakdown.currency)}</strong></div>
                  <div><span>Hotel</span><strong>{formatMoney(selectedHotel?.totalAmount ?? 0, selectedHotel?.currency || currentPriceBreakdown.currency)}</strong></div>
                  <div><span>Car</span><strong>{formatMoney(form.needsCar ? selectedCar?.totalAmount ?? 0 : 0, selectedCar?.currency || currentPriceBreakdown.currency)}</strong></div>
                  <div><span>CEAtlas fee</span><strong>{formatMoney(currentPriceBreakdown.serviceFee, currentPriceBreakdown.currency)}</strong></div>
                </div>
                <div className="itinerary-checkout-card__total">
                  <span>Total</span>
                  <strong>{formatMoney(currentPriceBreakdown.total, currentPriceBreakdown.currency)}</strong>
                </div>
              </div>
            </div>
          </div>
        </section>

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
