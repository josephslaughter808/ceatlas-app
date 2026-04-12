import type {
  TravelCarOption,
  TravelCheckoutDraft,
  TravelFlightOption,
  TravelHotelOption,
  TravelItineraryDraft,
  TravelPriceBreakdown,
  TravelSearchResponse,
} from "./providers/types";
import { calculatePriceBreakdown, combinePriceBreakdowns, toAmount } from "./service-fees";

function optionPriceBreakdown(option: {
  totalAmount: number | null;
  currency: string | null;
} | null): TravelPriceBreakdown | null {
  if (!option || option.totalAmount == null) return null;
  return calculatePriceBreakdown({
    baseAmount: option.totalAmount,
    currency: option.currency || "USD",
  });
}

export function summarizeSearchPricing(result: {
  flights: TravelFlightOption[];
  hotels: TravelHotelOption[];
  cars: TravelCarOption[];
}) {
  const flightMin = result.flights
    .filter((option) => option.totalAmount != null)
    .sort((a, b) => toAmount(a.totalAmount) - toAmount(b.totalAmount))[0] || null;
  const hotelMin = result.hotels
    .filter((option) => option.totalAmount != null)
    .sort((a, b) => toAmount(a.totalAmount) - toAmount(b.totalAmount))[0] || null;
  const carMin = result.cars
    .filter((option) => option.totalAmount != null)
    .sort((a, b) => toAmount(a.totalAmount) - toAmount(b.totalAmount))[0] || null;

  return {
    flightMin: optionPriceBreakdown(flightMin),
    hotelMin: optionPriceBreakdown(hotelMin),
    carMin: optionPriceBreakdown(carMin),
    combinedMin: combinePriceBreakdowns([
      optionPriceBreakdown(flightMin),
      optionPriceBreakdown(hotelMin),
      optionPriceBreakdown(carMin),
    ]),
  };
}

export function buildItineraryPriceBreakdown({
  selectedFlight,
  selectedHotel,
  selectedCar,
}: {
  selectedFlight: TravelFlightOption | null;
  selectedHotel: TravelHotelOption | null;
  selectedCar: TravelCarOption | null;
}) {
  return combinePriceBreakdowns([
    optionPriceBreakdown(selectedFlight),
    optionPriceBreakdown(selectedHotel),
    optionPriceBreakdown(selectedCar),
  ]) || calculatePriceBreakdown({ baseAmount: 0, currency: "USD" });
}

export function toTravelCheckoutDraft({
  itinerary,
  stripeCheckoutUrl,
  providers,
}: {
  itinerary: TravelItineraryDraft;
  stripeCheckoutUrl: string | null;
  providers: TravelSearchResponse["providers"];
}): TravelCheckoutDraft {
  return {
    orderId: itinerary.id,
    currency: itinerary.priceBreakdown.currency,
    subtotalAmount: itinerary.priceBreakdown.subtotal,
    serviceFeeAmount: itinerary.priceBreakdown.serviceFee,
    totalAmount: itinerary.priceBreakdown.total,
    stripeCheckoutUrl,
    providerStatuses: providers,
  };
}
