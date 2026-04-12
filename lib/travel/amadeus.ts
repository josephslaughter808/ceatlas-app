const AMADEUS_BASE_URL = process.env.AMADEUS_BASE_URL || "https://test.api.amadeus.com";
const AMADEUS_CLIENT_ID = process.env.AMADEUS_CLIENT_ID;
const AMADEUS_CLIENT_SECRET = process.env.AMADEUS_CLIENT_SECRET;

type TokenCache = {
  accessToken: string;
  expiresAt: number;
} | null;

type FlightSearchInput = {
  originCode: string;
  destinationCode: string;
  departureDate: string;
  returnDate?: string | null;
  adults: number;
};

type HotelSearchInput = {
  cityCode: string;
  checkInDate: string;
  checkOutDate?: string | null;
  adults: number;
};

type AmadeusFlightResult = {
  id: string;
  total: string | null;
  currency: string | null;
  stops: number | null;
  carriers: string[];
  originCode?: string | null;
  destinationCode?: string | null;
  departureAt: string | null;
  arrivalAt: string | null;
  returnDepartureAt?: string | null;
  returnArrivalAt?: string | null;
  returnOriginCode?: string | null;
  returnDestinationCode?: string | null;
};

type AmadeusHotelResult = {
  id: string;
  name: string;
  cityCode: string | null;
  latitude: number | null;
  longitude: number | null;
  total: string | null;
  currency: string | null;
};

type AmadeusFlightOffer = {
  id?: string;
  price?: {
    grandTotal?: string;
    total?: string;
    currency?: string;
  };
  validatingAirlineCodes?: string[];
  itineraries?: Array<{
    segments?: Array<{
      departure?: { at?: string };
      arrival?: { at?: string };
    }>;
  }>;
};

type AmadeusHotelOffer = {
  hotel?: {
    hotelId?: string;
    name?: string;
    cityCode?: string;
    latitude?: number;
    longitude?: number;
  };
  offers?: Array<{
    price?: {
      total?: string;
      currency?: string;
    };
  }>;
};

let tokenCache: TokenCache = null;

export function isAmadeusConfigured() {
  return Boolean(AMADEUS_CLIENT_ID && AMADEUS_CLIENT_SECRET);
}

function normalizeCode(value: string | null | undefined) {
  return String(value || "").trim().toUpperCase();
}

async function getAccessToken() {
  if (!AMADEUS_CLIENT_ID || !AMADEUS_CLIENT_SECRET) {
    throw new Error("Missing AMADEUS_CLIENT_ID or AMADEUS_CLIENT_SECRET");
  }

  if (tokenCache && tokenCache.expiresAt > Date.now() + 30_000) {
    return tokenCache.accessToken;
  }

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: AMADEUS_CLIENT_ID,
    client_secret: AMADEUS_CLIENT_SECRET,
  });

  const response = await fetch(`${AMADEUS_BASE_URL}/v1/security/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Amadeus auth failed: ${response.status} ${text}`);
  }

  const data = await response.json();

  tokenCache = {
    accessToken: data.access_token,
    expiresAt: Date.now() + Number(data.expires_in || 0) * 1000,
  };

  return tokenCache.accessToken;
}

async function amadeusGet(path: string, params: Record<string, string>) {
  const token = await getAccessToken();
  const url = new URL(`${AMADEUS_BASE_URL}${path}`);

  for (const [key, value] of Object.entries(params)) {
    if (value) {
      url.searchParams.set(key, value);
    }
  }

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Amadeus request failed: ${response.status} ${text}`);
  }

  return response.json();
}

export async function searchFlightOffers(input: FlightSearchInput): Promise<AmadeusFlightResult[]> {
  const data = await amadeusGet("/v2/shopping/flight-offers", {
    originLocationCode: normalizeCode(input.originCode),
    destinationLocationCode: normalizeCode(input.destinationCode),
    departureDate: input.departureDate,
    returnDate: input.returnDate || "",
    adults: String(Math.max(1, input.adults || 1)),
    currencyCode: "USD",
    max: "6",
  });

  return Array.isArray(data.data) ? (data.data as AmadeusFlightOffer[]).map((offer) => {
    const outboundSegments = offer.itineraries?.[0]?.segments || [];
    const returnSegments = offer.itineraries?.[1]?.segments || [];
    const firstSegment = outboundSegments[0];
    const lastSegment = outboundSegments.slice(-1)?.[0];
    const firstReturnSegment = returnSegments[0];
    const lastReturnSegment = returnSegments.slice(-1)?.[0];

    return {
      id: String(offer.id || crypto.randomUUID?.() || Math.random()),
      total: offer.price?.grandTotal || offer.price?.total || null,
      currency: offer.price?.currency || null,
      stops: Math.max(0, Number((outboundSegments.length || 1) - 1)),
      carriers: Array.isArray(offer.validatingAirlineCodes) ? offer.validatingAirlineCodes : [],
      originCode: input.originCode,
      destinationCode: input.destinationCode,
      departureAt: firstSegment?.departure?.at || null,
      arrivalAt: lastSegment?.arrival?.at || null,
      returnDepartureAt: firstReturnSegment?.departure?.at || null,
      returnArrivalAt: lastReturnSegment?.arrival?.at || null,
      returnOriginCode: input.destinationCode,
      returnDestinationCode: input.originCode,
    };
  }) : [];
}

export async function searchHotelOffers(input: HotelSearchInput): Promise<AmadeusHotelResult[]> {
  const data = await amadeusGet("/v3/shopping/hotel-offers", {
    cityCode: normalizeCode(input.cityCode),
    checkInDate: input.checkInDate,
    checkOutDate: input.checkOutDate || "",
    adults: String(Math.max(1, input.adults || 1)),
    roomQuantity: "1",
    bestRateOnly: "true",
  });

  return Array.isArray(data.data) ? (data.data as AmadeusHotelOffer[]).map((hotel) => {
    const firstOffer = hotel.offers?.[0];

    return {
      id: String(hotel.hotel?.hotelId || hotel.hotel?.name || Math.random()),
      name: hotel.hotel?.name || "Hotel option",
      cityCode: hotel.hotel?.cityCode || null,
      latitude: typeof hotel.hotel?.latitude === "number" ? hotel.hotel.latitude : null,
      longitude: typeof hotel.hotel?.longitude === "number" ? hotel.hotel.longitude : null,
      total: firstOffer?.price?.total || null,
      currency: firstOffer?.price?.currency || null,
    };
  }) : [];
}
