import { NextResponse } from "next/server";
import {
  isAmadeusConfigured,
  searchFlightOffers,
  searchHotelOffers,
} from "@/lib/travel/amadeus";

type TravelSearchRequest = {
  originCode?: string;
  destinationCode?: string;
  departureDate?: string;
  returnDate?: string;
  adults?: number;
};

export async function POST(request: Request) {
  const body = await request.json() as TravelSearchRequest;
  const originCode = String(body.originCode || "").trim().toUpperCase();
  const destinationCode = String(body.destinationCode || "").trim().toUpperCase();
  const departureDate = String(body.departureDate || "").trim();
  const returnDate = String(body.returnDate || "").trim();
  const adults = Math.max(1, Number(body.adults || 1));

  if (!originCode || !destinationCode || !departureDate) {
    return NextResponse.json({
      configured: isAmadeusConfigured(),
      flights: [],
      hotels: [],
      error: "Origin, destination, and departure date are required for live API search.",
    }, { status: 400 });
  }

  if (!isAmadeusConfigured()) {
    return NextResponse.json({
      configured: false,
      flights: [],
      hotels: [],
      error: "Amadeus API keys are not configured yet.",
    });
  }

  const warnings: string[] = [];

  const [flightResult, hotelResult] = await Promise.allSettled([
    searchFlightOffers({
      originCode,
      destinationCode,
      departureDate,
      returnDate: returnDate || null,
      adults,
    }),
    searchHotelOffers({
      cityCode: destinationCode,
      checkInDate: departureDate,
      checkOutDate: returnDate || null,
      adults,
    }),
  ]);

  const flights = flightResult.status === "fulfilled" ? flightResult.value : [];
  const hotels = hotelResult.status === "fulfilled" ? hotelResult.value : [];

  if (flightResult.status === "rejected") {
    warnings.push(`Flights unavailable: ${flightResult.reason instanceof Error ? flightResult.reason.message : "Unknown error"}`);
  }

  if (hotelResult.status === "rejected") {
    warnings.push(`Hotels unavailable: ${hotelResult.reason instanceof Error ? hotelResult.reason.message : "Unknown error"}`);
  }

  return NextResponse.json({
    configured: true,
    flights,
    hotels,
    warnings,
  });
}
