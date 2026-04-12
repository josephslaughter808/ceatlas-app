import type { TravelCarOption, TravelHotelOption, TravelProviderStatus } from "./types";
import { toAmount } from "../service-fees";

const BOOKING_API_BASE = process.env.BOOKING_API_BASE || "https://demandapi.booking.com/3.1";
const BOOKING_DEMAND_API_KEY = process.env.BOOKING_DEMAND_API_KEY;

type BookingHotelSearchInput = {
  cityCode: string;
  cityName?: string | null;
  checkInDate: string;
  checkOutDate?: string | null;
  adults: number;
};

type BookingCarSearchInput = {
  pickupCode: string;
  pickupDate: string;
  dropoffDate?: string | null;
  driversAge?: number;
};

async function bookingRequest<T>(path: string, payload: Record<string, unknown>) {
  if (!BOOKING_DEMAND_API_KEY) {
    throw new Error("Missing BOOKING_DEMAND_API_KEY");
  }

  const response = await fetch(`${BOOKING_API_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${BOOKING_DEMAND_API_KEY}`,
      "X-Affiliate-Id": process.env.NEXT_PUBLIC_BOOKING_AFFILIATE_ID || "",
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Booking request failed: ${response.status} ${text}`);
  }

  return response.json() as Promise<T>;
}

export function getBookingHotelStatus(): TravelProviderStatus {
  return {
    provider: "Booking.com",
    configured: Boolean(BOOKING_DEMAND_API_KEY),
    mode: BOOKING_DEMAND_API_KEY ? "live" : "disabled",
    message: BOOKING_DEMAND_API_KEY ? null : "Booking.com Demand API credentials are not configured yet.",
  };
}

export function getBookingCarStatus(): TravelProviderStatus {
  return {
    provider: "Booking.com Cars",
    configured: Boolean(BOOKING_DEMAND_API_KEY),
    mode: BOOKING_DEMAND_API_KEY ? "live" : "disabled",
    message: BOOKING_DEMAND_API_KEY ? null : "Booking.com car rental access is not configured yet.",
  };
}

export async function searchBookingHotels(input: BookingHotelSearchInput): Promise<TravelHotelOption[]> {
  if (!BOOKING_DEMAND_API_KEY) return [];

  const payload = await bookingRequest<{ data?: Array<Record<string, unknown>> }>("/accommodations/search", {
    booker: {
      country: "us",
      platform: "desktop",
    },
    checkin: input.checkInDate,
    checkout: input.checkOutDate || input.checkInDate,
    guests: {
      number_of_adults: Math.max(1, input.adults),
    },
    city: input.cityCode,
  });

  const rows = Array.isArray(payload.data) ? payload.data : [];
  return rows.map((row) => {
    const property = typeof row.property === "object" && row.property ? row.property as Record<string, unknown> : row;
    const price = typeof row.price === "object" && row.price ? row.price as Record<string, unknown> : {};
    const coordinates = typeof property.coordinates === "object" && property.coordinates ? property.coordinates as Record<string, unknown> : {};
    const address = typeof property.address === "object" && property.address ? property.address as Record<string, unknown> : {};
    const addressLine = [
      typeof address.street === "string" ? address.street : null,
      typeof address.city === "string" ? address.city : null,
      typeof address.region === "string" ? address.region : null,
    ].filter(Boolean).join(", ");
    const derivedCityName =
      (typeof address.city === "string" && address.city) ||
      (typeof property.city === "string" && property.city) ||
      input.cityName ||
      input.cityCode;

    return {
      id: String(row.id || property.id || Math.random()),
      provider: "Booking.com",
      offerToken: String(row.id || property.id || ""),
      name: String(property.name || "Hotel option"),
      cityCode: input.cityCode,
      cityName: derivedCityName,
      latitude: typeof coordinates.latitude === "number" ? coordinates.latitude : null,
      longitude: typeof coordinates.longitude === "number" ? coordinates.longitude : null,
      total: typeof price.total === "string" ? price.total : null,
      totalAmount: toAmount(typeof price.total === "string" || typeof price.total === "number" ? price.total : null),
      currency: typeof price.currency === "string" ? price.currency : "USD",
      rating: typeof property.review_score === "number" ? property.review_score : null,
      address: addressLine || null,
      metadata: row,
    };
  });
}

export async function searchBookingCars(input: BookingCarSearchInput): Promise<TravelCarOption[]> {
  if (!BOOKING_DEMAND_API_KEY) return [];

  const payload = await bookingRequest<{ data?: Array<Record<string, unknown>> }>("/cars/search", {
    pickup_location: input.pickupCode,
    dropoff_location: input.pickupCode,
    pickup_date_time: `${input.pickupDate}T10:00:00`,
    dropoff_date_time: `${input.dropoffDate || input.pickupDate}T10:00:00`,
    driver_age: input.driversAge || 35,
  });

  const rows = Array.isArray(payload.data) ? payload.data : [];
  return rows.map((row) => {
    const vehicle = typeof row.vehicle === "object" && row.vehicle ? row.vehicle as Record<string, unknown> : {};
    const pricing = typeof row.pricing === "object" && row.pricing ? row.pricing as Record<string, unknown> : {};
    return {
      id: String(row.id || Math.random()),
      provider: "Booking.com Cars",
      offerToken: String(row.id || ""),
      name: String(vehicle.name || row.supplier_name || "Rental car"),
      vehicleType: typeof vehicle.type === "string" ? vehicle.type : null,
      pickupCode: input.pickupCode,
      total: typeof pricing.total === "string" ? pricing.total : null,
      totalAmount: toAmount(typeof pricing.total === "string" || typeof pricing.total === "number" ? pricing.total : null),
      currency: typeof pricing.currency === "string" ? pricing.currency : "USD",
      metadata: row,
    };
  });
}
