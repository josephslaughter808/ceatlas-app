import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/server-auth";
import { listTravelItineraries, saveTravelItinerary } from "@/lib/travel/orders";
import type { TravelCarOption, TravelFlightOption, TravelHotelOption, TravelSearchResponse } from "@/lib/travel/providers/types";

type SaveItineraryRequest = {
  itineraryId?: string | null;
  title?: string;
  courseId?: string;
  courseTitle?: string;
  destination?: string;
  destinationCode?: string;
  departureAirport?: string;
  startDate?: string | null;
  endDate?: string | null;
  travelers?: number;
  budget?: string;
  hotelStyle?: string;
  needsCar?: boolean;
  notes?: string;
  selectedFlight?: TravelFlightOption | null;
  selectedHotel?: TravelHotelOption | null;
  selectedCar?: TravelCarOption | null;
  providers?: TravelSearchResponse["providers"];
};

export async function GET(request: Request) {
  try {
    const user = await getUserFromRequest(request);
    const itineraries = await listTravelItineraries(user.id);
    return NextResponse.json({ itineraries });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Unable to load itineraries.",
    }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getUserFromRequest(request);
    const body = await request.json() as SaveItineraryRequest;

    if (!body.courseId || !body.courseTitle || !body.destination) {
      return NextResponse.json({ error: "Course, course title, and destination are required." }, { status: 400 });
    }

    const itinerary = await saveTravelItinerary({
      userId: user.id,
      itineraryId: body.itineraryId || null,
      title: String(body.title || `${body.courseTitle} Trip`),
      courseId: String(body.courseId),
      courseTitle: String(body.courseTitle),
      destination: String(body.destination),
      destinationCode: String(body.destinationCode || "").trim().toUpperCase(),
      departureAirport: String(body.departureAirport || "").trim().toUpperCase(),
      startDate: body.startDate || null,
      endDate: body.endDate || null,
      travelers: Math.max(1, Number(body.travelers || 1)),
      budget: String(body.budget || ""),
      hotelStyle: String(body.hotelStyle || "Comfort"),
      needsCar: Boolean(body.needsCar),
      notes: String(body.notes || ""),
      selectedFlight: body.selectedFlight || null,
      selectedHotel: body.selectedHotel || null,
      selectedCar: body.selectedCar || null,
      providers: body.providers || {
        flights: { provider: "Unknown", configured: false, mode: "disabled", message: null },
        hotels: { provider: "Unknown", configured: false, mode: "disabled", message: null },
        cars: { provider: "Unknown", configured: false, mode: "disabled", message: null },
      },
    });

    return NextResponse.json({ itinerary });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Unable to save itinerary.",
    }, { status: 500 });
  }
}
