import { NextResponse } from "next/server";
import {
  isAmadeusConfigured,
  searchFlightOffers,
  searchHotelOffers,
} from "@/lib/travel/amadeus";
import { searchBookingCars, searchBookingHotels, getBookingCarStatus, getBookingHotelStatus } from "@/lib/travel/providers/booking";
import { getDuffelStatus, searchDuffelFlightOffers } from "@/lib/travel/providers/duffel";
import { summarizeSearchPricing } from "@/lib/travel/itinerary";
import type { TravelFlightOption, TravelHotelOption, TravelSearchResponse } from "@/lib/travel/providers/types";
import { toAmount } from "@/lib/travel/service-fees";

type TravelSearchRequest = {
  originCode?: string;
  originCodes?: string[];
  destinationCode?: string;
  hotelCityCode?: string;
  hotelCityName?: string;
  departureDate?: string;
  returnDate?: string;
  adults?: number;
};

function toFallbackFlights(rows: Awaited<ReturnType<typeof searchFlightOffers>>, searchOriginCode: string): TravelFlightOption[] {
  return rows.map((flight) => ({
    id: flight.id,
    provider: "Amadeus",
    offerToken: flight.id,
    title: flight.carriers.join(", ") || "Flight option",
    total: flight.total,
    totalAmount: toAmount(flight.total),
    currency: flight.currency,
    stops: flight.stops,
    carriers: flight.carriers,
    searchOriginCode,
    departureAt: flight.departureAt,
    arrivalAt: flight.arrivalAt,
    metadata: flight as unknown as Record<string, unknown>,
  }));
}

function toFallbackHotels(rows: Awaited<ReturnType<typeof searchHotelOffers>>): TravelHotelOption[] {
  return rows.map((hotel) => ({
    id: hotel.id,
    provider: "Amadeus",
    offerToken: hotel.id,
    name: hotel.name,
    cityCode: hotel.cityCode,
    latitude: hotel.latitude,
    longitude: hotel.longitude,
    total: hotel.total,
    totalAmount: toAmount(hotel.total),
    currency: hotel.currency,
    metadata: hotel as unknown as Record<string, unknown>,
  }));
}

export async function POST(request: Request) {
  const body = await request.json() as TravelSearchRequest;
  const originCode = String(body.originCode || "").trim().toUpperCase();
  const originCodes = [...new Set(
    (Array.isArray(body.originCodes) ? body.originCodes : [])
      .map((value) => String(value || "").trim().toUpperCase())
      .filter(Boolean)
  )];
  const destinationCode = String(body.destinationCode || "").trim().toUpperCase();
  const hotelCityCode = String(body.hotelCityCode || "").trim().toUpperCase();
  const hotelCityName = String(body.hotelCityName || "").trim();
  const departureDate = String(body.departureDate || "").trim();
  const returnDate = String(body.returnDate || "").trim();
  const adults = Math.max(1, Number(body.adults || 1));

  const requestedOrigins = [...new Set([originCode, ...originCodes].filter(Boolean))];

  if (requestedOrigins.length === 0 || !destinationCode || !departureDate) {
    return NextResponse.json({
      configured: false,
      flights: [],
      hotels: [],
      cars: [],
      providers: {
        flights: getDuffelStatus(),
        hotels: getBookingHotelStatus(),
        cars: getBookingCarStatus(),
      },
      warnings: [],
      pricing: {
        flightMin: null,
        hotelMin: null,
        carMin: null,
        combinedMin: null,
      },
      error: "Origin, destination, and departure date are required for live API search.",
    } satisfies TravelSearchResponse, { status: 400 });
  }

  const warnings: string[] = [];
  const duffelStatus = getDuffelStatus();
  const bookingHotelStatus = getBookingHotelStatus();
  const bookingCarStatus = getBookingCarStatus();

  let flights: TravelFlightOption[] = [];
  let hotels: TravelHotelOption[] = [];
  let cars: TravelSearchResponse["cars"] = [];

  const flightGroups = await Promise.all(requestedOrigins.map(async (currentOriginCode) => {
    let originFlights: TravelFlightOption[] = [];

    if (duffelStatus.configured) {
      try {
        originFlights = (await searchDuffelFlightOffers({
          originCode: currentOriginCode,
          destinationCode,
          departureDate,
          returnDate: returnDate || null,
          adults,
        })).map((flight) => ({
          ...flight,
          searchOriginCode: currentOriginCode,
        }));
      } catch (error) {
        warnings.push(`Duffel flights unavailable for ${currentOriginCode}: ${error instanceof Error ? error.message : "Unknown error"}`);
      }
    }

    if (originFlights.length === 0 && isAmadeusConfigured()) {
      try {
        originFlights = toFallbackFlights(await searchFlightOffers({
          originCode: currentOriginCode,
          destinationCode,
          departureDate,
          returnDate: returnDate || null,
          adults,
        }), currentOriginCode);
        if (originFlights.length > 0) {
          duffelStatus.mode = "fallback";
          duffelStatus.message = "Showing Amadeus fallback flights while Duffel is unavailable.";
        }
      } catch (error) {
        warnings.push(`Flight fallback unavailable for ${currentOriginCode}: ${error instanceof Error ? error.message : "Unknown error"}`);
      }
    }

    return originFlights.slice(0, 5);
  }));

  flights = flightGroups.flat();

  if (bookingHotelStatus.configured) {
    try {
      hotels = await searchBookingHotels({
        cityCode: hotelCityCode || destinationCode,
        cityName: hotelCityName || null,
        checkInDate: departureDate,
        checkOutDate: returnDate || null,
        adults,
      });
    } catch (error) {
      warnings.push(`Booking.com hotels unavailable: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  if (hotels.length === 0 && isAmadeusConfigured()) {
    try {
      hotels = toFallbackHotels(await searchHotelOffers({
        cityCode: hotelCityCode || destinationCode,
        checkInDate: departureDate,
        checkOutDate: returnDate || null,
        adults,
      }));
      if (hotels.length > 0) {
        bookingHotelStatus.mode = "fallback";
        bookingHotelStatus.message = "Showing Amadeus fallback hotels while Booking.com is unavailable.";
      }
    } catch (error) {
      warnings.push(`Hotel fallback unavailable: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  if (bookingCarStatus.configured) {
    try {
      cars = await searchBookingCars({
        pickupCode: destinationCode,
        pickupDate: departureDate,
        dropoffDate: returnDate || null,
      });
    } catch (error) {
      warnings.push(`Booking.com cars unavailable: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  } else {
    warnings.push("Rental car live search will appear once Booking.com car access is configured.");
  }

  const pricing = summarizeSearchPricing({ flights, hotels, cars });

  return NextResponse.json({
    configured: Boolean(duffelStatus.configured || bookingHotelStatus.configured || bookingCarStatus.configured || isAmadeusConfigured()),
    flights,
    hotels,
    cars,
    providers: {
      flights: duffelStatus,
      hotels: bookingHotelStatus,
      cars: bookingCarStatus,
    },
    warnings,
    pricing,
  } satisfies TravelSearchResponse);
}
