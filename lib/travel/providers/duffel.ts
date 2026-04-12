import type { TravelFlightOption, TravelProviderStatus } from "./types";
import { toAmount } from "../service-fees";

const DUFFEL_API_BASE = process.env.DUFFEL_API_BASE || "https://api.duffel.com";
const DUFFEL_ACCESS_TOKEN = process.env.DUFFEL_ACCESS_TOKEN;
const DUFFEL_VERSION = "v2";

type DuffelOfferRequest = {
  originCode: string;
  destinationCode: string;
  departureDate: string;
  returnDate?: string | null;
  adults: number;
};

type DuffelOrderRequest = {
  offerId: string;
  givenName: string;
  familyName: string;
  bornOn: string;
  email: string;
};

function duffelHeaders() {
  if (!DUFFEL_ACCESS_TOKEN) {
    throw new Error("Missing DUFFEL_ACCESS_TOKEN");
  }

  return {
    Authorization: `Bearer ${DUFFEL_ACCESS_TOKEN}`,
    "Duffel-Version": DUFFEL_VERSION,
    "Content-Type": "application/json",
  };
}

export function getDuffelStatus(): TravelProviderStatus {
  const isTestMode = String(DUFFEL_ACCESS_TOKEN || "").startsWith("duffel_test_");
  return {
    provider: "Duffel",
    configured: Boolean(DUFFEL_ACCESS_TOKEN),
    mode: DUFFEL_ACCESS_TOKEN ? "live" : "disabled",
    message: !DUFFEL_ACCESS_TOKEN
      ? "Duffel access token is not configured yet."
      : isTestMode
        ? "Duffel is connected in test mode, so these flight prices and schedules are sandbox results rather than live bookable inventory."
        : null,
  };
}

export async function searchDuffelFlightOffers(input: DuffelOfferRequest): Promise<TravelFlightOption[]> {
  if (!DUFFEL_ACCESS_TOKEN) return [];

  const slices = [
    {
      origin: input.originCode,
      destination: input.destinationCode,
      departure_date: input.departureDate,
    },
  ];

  if (input.returnDate) {
    slices.push({
      origin: input.destinationCode,
      destination: input.originCode,
      departure_date: input.returnDate,
    });
  }

  const response = await fetch(`${DUFFEL_API_BASE}/air/offer_requests`, {
    method: "POST",
    headers: duffelHeaders(),
    body: JSON.stringify({
      data: {
        cabin_class: "economy",
        passengers: Array.from({ length: Math.max(1, input.adults) }, () => ({
          type: "adult",
        })),
        slices,
      },
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Duffel offer request failed: ${response.status} ${text}`);
  }

  const requestPayload = await response.json() as {
    data?: {
      offers?: Array<Record<string, unknown>>;
    };
  };

  const offers = Array.isArray(requestPayload.data?.offers) ? requestPayload.data?.offers : [];

  return offers.map((offer) => {
    const owner = typeof offer.owner === "object" && offer.owner ? offer.owner as Record<string, unknown> : null;
    const slicesPayload = Array.isArray(offer.slices) ? offer.slices as Array<Record<string, unknown>> : [];
    const outboundSlice = slicesPayload[0];
    const returnSlice = slicesPayload[1];
    const outboundSegments = Array.isArray(outboundSlice?.segments) ? outboundSlice.segments as Array<Record<string, unknown>> : [];
    const returnSegments = Array.isArray(returnSlice?.segments) ? returnSlice.segments as Array<Record<string, unknown>> : [];
    const firstOutboundSegment = outboundSegments[0];
    const lastOutboundSegment = outboundSegments.at(-1);
    const firstReturnSegment = returnSegments[0];
    const lastReturnSegment = returnSegments.at(-1);
    const stops = Math.max(0, outboundSegments.length - 1);

    const outboundDeparture = typeof firstOutboundSegment?.departing_at === "string"
      ? firstOutboundSegment.departing_at
      : typeof outboundSlice?.departure_date === "string"
        ? outboundSlice.departure_date
        : null;

    const outboundArrival = typeof lastOutboundSegment?.arriving_at === "string"
      ? lastOutboundSegment.arriving_at
      : typeof outboundSlice?.arrival_date === "string"
        ? outboundSlice.arrival_date
        : null;

    const outboundOrigin = typeof firstOutboundSegment?.origin === "object" && firstOutboundSegment.origin
      ? String((firstOutboundSegment.origin as Record<string, unknown>).iata_code || "")
      : null;

    const outboundDestination = typeof lastOutboundSegment?.destination === "object" && lastOutboundSegment.destination
      ? String((lastOutboundSegment.destination as Record<string, unknown>).iata_code || "")
      : null;

    const inboundDeparture = typeof firstReturnSegment?.departing_at === "string"
      ? firstReturnSegment.departing_at
      : typeof returnSlice?.departure_date === "string"
        ? returnSlice.departure_date
        : null;

    const inboundArrival = typeof lastReturnSegment?.arriving_at === "string"
      ? lastReturnSegment.arriving_at
      : typeof returnSlice?.arrival_date === "string"
        ? returnSlice.arrival_date
        : null;

    const inboundOrigin = typeof firstReturnSegment?.origin === "object" && firstReturnSegment.origin
      ? String((firstReturnSegment.origin as Record<string, unknown>).iata_code || "")
      : null;

    const inboundDestination = typeof lastReturnSegment?.destination === "object" && lastReturnSegment.destination
      ? String((lastReturnSegment.destination as Record<string, unknown>).iata_code || "")
      : null;

    return {
      id: String(offer.id || crypto.randomUUID?.() || Math.random()),
      provider: "Duffel",
      offerToken: String(offer.id || ""),
      title: String(owner?.name || "Flight option"),
      total: typeof offer.total_amount === "string" ? offer.total_amount : null,
      totalAmount: toAmount(typeof offer.total_amount === "string" ? offer.total_amount : null),
      currency: typeof offer.total_currency === "string" ? offer.total_currency : "USD",
      stops,
      carriers: owner?.name ? [String(owner.name)] : [],
      originCode: outboundOrigin,
      destinationCode: outboundDestination,
      departureAt: outboundDeparture,
      arrivalAt: outboundArrival,
      returnDepartureAt: inboundDeparture,
      returnArrivalAt: inboundArrival,
      returnOriginCode: inboundOrigin,
      returnDestinationCode: inboundDestination,
      refundable: typeof offer.conditions === "object" && offer.conditions
        ? Boolean((offer.conditions as Record<string, unknown>).change_before_departure)
        : null,
      metadata: offer,
    };
  });
}

export async function createDuffelFlightOrder(input: DuffelOrderRequest) {
  if (!DUFFEL_ACCESS_TOKEN) {
    throw new Error("Duffel is not configured.");
  }

  const response = await fetch(`${DUFFEL_API_BASE}/air/orders`, {
    method: "POST",
    headers: duffelHeaders(),
    body: JSON.stringify({
      data: {
        type: "instant",
        selected_offers: [input.offerId],
        passengers: [
          {
            given_name: input.givenName,
            family_name: input.familyName,
            born_on: input.bornOn,
            email: input.email,
          },
        ],
      },
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Duffel order creation failed: ${response.status} ${text}`);
  }

  return response.json();
}
