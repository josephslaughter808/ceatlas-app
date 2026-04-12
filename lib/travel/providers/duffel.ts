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
  return {
    provider: "Duffel",
    configured: Boolean(DUFFEL_ACCESS_TOKEN),
    mode: DUFFEL_ACCESS_TOKEN ? "live" : "disabled",
    message: DUFFEL_ACCESS_TOKEN ? null : "Duffel access token is not configured yet.",
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
    const firstSlice = slicesPayload[0];
    const lastSlice = slicesPayload.at(-1);
    const segments = Array.isArray(firstSlice?.segments) ? firstSlice.segments as Array<Record<string, unknown>> : [];
    const stops = Math.max(0, segments.length - 1);

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
      departureAt: typeof firstSlice?.departure_date === "string" ? firstSlice.departure_date : null,
      arrivalAt: typeof lastSlice?.arrival_date === "string" ? lastSlice.arrival_date : null,
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
