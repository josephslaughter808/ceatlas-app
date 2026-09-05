import type { TravelFlightOption, TravelHotelOption } from "./providers/types";

const AIRPORT_GROUND_DISTANCE: Record<string, number> = {
  LGA: 8.5, JFK: 16.2, EWR: 17.4, DCA: 4.8, IAD: 26.1, BWI: 31.5,
  MDW: 11.2, ORD: 17.5, DAL: 6.8, DFW: 20.1,
};

function atTime(date: string, hour: number, minute = 0) {
  return `${date}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`;
}

function shiftMinutes(value: string, minutes: number) {
  return new Date(new Date(value).getTime() + minutes * 60_000).toISOString();
}

export function buildDemoFlights(args: {
  origins: string[];
  destinations: string[];
  departureDate: string;
  returnDate?: string | null;
  adults: number;
}) {
  const carriers = ["American", "Delta", "United", "Southwest"];
  const rows: TravelFlightOption[] = [];
  args.origins.forEach((origin, originIndex) => {
    args.destinations.forEach((destination, destinationIndex) => {
      const variants = [0, 1, 2];
      variants.forEach((variant) => {
        const stops = variant === 2 ? 1 : 0;
        const durationMinutes = 190 + destinationIndex * 12 + originIndex * 8 + variant * 37;
        const departureAt = atTime(args.departureDate, 6 + variant * 4, destinationIndex * 10);
        const returnDepartureAt = args.returnDate ? atTime(args.returnDate, 13 + variant * 2, 20) : null;
        const totalAmount = (218 + originIndex * 19 + destinationIndex * 31 + variant * 54) * args.adults;
        rows.push({
          id: `demo-${origin}-${destination}-${variant}`,
          provider: "CEAtlas preview",
          title: carriers[(originIndex + destinationIndex + variant) % carriers.length],
          total: totalAmount.toFixed(2), totalAmount, currency: "USD", stops,
          carriers: [carriers[(originIndex + destinationIndex + variant) % carriers.length]],
          searchOriginCode: origin, originCode: origin, destinationCode: destination,
          departureAt, arrivalAt: shiftMinutes(departureAt, durationMinutes),
          returnDepartureAt,
          returnArrivalAt: returnDepartureAt ? shiftMinutes(returnDepartureAt, durationMinutes + 5) : null,
          returnOriginCode: destination, returnDestinationCode: origin,
          refundable: variant === 1, durationMinutes,
          destinationDistanceMiles: AIRPORT_GROUND_DISTANCE[destination] ?? 14 + destinationIndex * 5,
          isEstimate: true,
          metadata: { inventoryMode: "demo" },
        });
      });
    });
  });
  return rows;
}

export function buildDemoHotels(args: { cityCode: string; cityName: string; nights: number }) {
  const inventory = [
    ["Conference Center Hotel", 0.2, 4.6, 289],
    ["Central Park Suites", 0.7, 4.8, 348],
    ["Cityline Hotel", 1.3, 4.3, 229],
    ["Metro Stay", 2.1, 4.1, 174],
    ["Grand Avenue Hotel", 0.9, 4.9, 419],
    ["Neighborhood House", 3.4, 4.5, 152],
  ] as const;
  return inventory.map(([name, distance, rating, nightly], index): TravelHotelOption => {
    const totalAmount = nightly * Math.max(1, args.nights);
    return {
      id: `demo-hotel-${args.cityCode}-${index}`, provider: "CEAtlas preview", name,
      cityCode: args.cityCode, cityName: args.cityName, latitude: null, longitude: null,
      total: totalAmount.toFixed(2), totalAmount, currency: "USD", rating,
      address: `${Math.round(100 + index * 117)} ${index % 2 ? "Broadway" : "Convention Way"}`,
      distanceToVenueMiles: distance, isEstimate: true, metadata: { nightlyRate: nightly, inventoryMode: "demo" },
    };
  });
}
