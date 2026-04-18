import { findAirportByCode, inferBestAirportCode } from "./airports";

const LOCATION_TO_AIRPORT: Array<[string, string]> = [
  ["las vegas", "LAS"],
  ["new york city", "JFK"],
  ["new york, ny", "JFK"],
  ["manhattan", "JFK"],
  ["brooklyn", "JFK"],
  ["chicago", "ORD"],
  ["orlando", "MCO"],
  ["miami", "MIA"],
  ["fort lauderdale", "FLL"],
  ["atlanta", "ATL"],
  ["nashville", "BNA"],
  ["dallas", "DFW"],
  ["fort worth", "DFW"],
  ["houston", "IAH"],
  ["austin", "AUS"],
  ["san antonio", "SAT"],
  ["phoenix", "PHX"],
  ["scottsdale", "PHX"],
  ["denver", "DEN"],
  ["salt lake city", "SLC"],
  ["seattle", "SEA"],
  ["portland", "PDX"],
  ["san diego", "SAN"],
  ["san francisco", "SFO"],
  ["los angeles", "LAX"],
  ["anaheim", "SNA"],
  ["orange county", "SNA"],
  ["boston", "BOS"],
  ["washington, dc", "DCA"],
  ["washington dc", "DCA"],
  ["philadelphia", "PHL"],
  ["detroit", "DTW"],
  ["minneapolis", "MSP"],
  ["new orleans", "MSY"],
  ["charlotte", "CLT"],
  ["tampa", "TPA"],
  ["honolulu", "HNL"],
  ["toronto", "YYZ"],
  ["vancouver", "YVR"],
  ["montreal", "YUL"],
  ["london", "LHR"],
  ["paris", "CDG"],
  ["madrid", "MAD"],
  ["barcelona", "BCN"],
  ["rome", "FCO"],
  ["berlin", "BER"],
  ["amsterdam", "AMS"],
  ["zurich", "ZRH"],
  ["lisbon", "LIS"],
  ["dubai", "DXB"],
  ["singapore", "SIN"],
  ["tokyo", "HND"],
  ["sao paulo", "GRU"],
  ["rio de janeiro", "GIG"],
  ["brazil", "GRU"],
  ["puerto rico", "SJU"],
];

const LOCATION_TO_CITY_CODE: Array<[string, string]> = [
  ["new york city", "NYC"],
  ["new york, ny", "NYC"],
  ["manhattan", "NYC"],
  ["brooklyn", "NYC"],
  ["chicago", "CHI"],
  ["washington, dc", "WAS"],
  ["washington dc", "WAS"],
  ["dallas", "DFW"],
  ["fort worth", "DFW"],
  ["salt lake city", "SLC"],
  ["las vegas", "LAS"],
  ["orlando", "ORL"],
  ["miami", "MIA"],
  ["atlanta", "ATL"],
  ["nashville", "BNA"],
  ["houston", "HOU"],
  ["austin", "AUS"],
  ["san antonio", "SAT"],
  ["phoenix", "PHX"],
  ["denver", "DEN"],
  ["seattle", "SEA"],
  ["portland", "PDX"],
  ["san diego", "SAN"],
  ["san francisco", "SFO"],
  ["los angeles", "LAX"],
  ["boston", "BOS"],
  ["philadelphia", "PHL"],
  ["detroit", "DTT"],
  ["minneapolis", "MSP"],
  ["new orleans", "MSY"],
  ["charlotte", "CLT"],
  ["tampa", "TPA"],
  ["honolulu", "HNL"],
  ["toronto", "YTO"],
  ["vancouver", "YVR"],
  ["montreal", "YMQ"],
  ["london", "LON"],
  ["paris", "PAR"],
  ["madrid", "MAD"],
  ["barcelona", "BCN"],
  ["rome", "ROM"],
  ["berlin", "BER"],
  ["amsterdam", "AMS"],
  ["zurich", "ZRH"],
  ["lisbon", "LIS"],
  ["dubai", "DXB"],
  ["singapore", "SIN"],
  ["tokyo", "TYO"],
  ["sao paulo", "SAO"],
  ["rio de janeiro", "RIO"],
];

const AIRPORT_TO_CITY_CODE: Record<string, string> = {
  JFK: "NYC",
  LGA: "NYC",
  EWR: "NYC",
  ORD: "CHI",
  MDW: "CHI",
  DCA: "WAS",
  IAD: "WAS",
  BWI: "WAS",
  YYZ: "YTO",
  YTZ: "YTO",
  YUL: "YMQ",
  GRU: "SAO",
  GIG: "RIO",
  HND: "TYO",
  NRT: "TYO",
};

const NON_DESTINATIONS = [
  "online",
  "self-paced",
  "self paced",
  "virtual",
  "webinar",
  "remote",
  "on demand",
  "on-demand",
  "available now",
  "texas",
  "california",
  "florida",
];

export function inferAirportCodeFromLocation(location: string | null | undefined) {
  const normalized = String(location || "").trim().toLowerCase();
  if (!normalized) return null;
  if (NON_DESTINATIONS.some((value) => normalized === value || normalized.includes(value))) {
    return null;
  }

  for (const [needle, airport] of LOCATION_TO_AIRPORT) {
    if (normalized.includes(needle)) return airport;
  }

  return inferBestAirportCode(location);
}

export function inferCityCodeFromLocation(location: string | null | undefined, fallbackAirportCode?: string | null) {
  const normalized = String(location || "").trim().toLowerCase();

  if (normalized && !NON_DESTINATIONS.some((value) => normalized === value || normalized.includes(value))) {
    for (const [needle, cityCode] of LOCATION_TO_CITY_CODE) {
      if (normalized.includes(needle)) return cityCode;
    }
  }

  const airportCode = String(fallbackAirportCode || "").trim().toUpperCase();
  if (airportCode) {
    return AIRPORT_TO_CITY_CODE[airportCode] || airportCode;
  }

  const inferredAirportCode = inferBestAirportCode(location);
  if (inferredAirportCode) {
    return AIRPORT_TO_CITY_CODE[inferredAirportCode] || inferredAirportCode;
  }

  return null;
}

export function inferCityNameFromLocation(location: string | null | undefined) {
  const raw = String(location || "").trim();
  if (!raw) return null;
  const normalized = raw.toLowerCase();
  if (NON_DESTINATIONS.some((value) => normalized === value || normalized.includes(value))) {
    return null;
  }

  const firstSegment = raw.split("|")[0]?.split("•")[0]?.trim() || raw;
  const cityChunk = firstSegment.split(",").slice(0, 2).join(", ").trim();
  if (cityChunk) return cityChunk;

  const inferredAirportCode = inferBestAirportCode(location);
  const airport = inferredAirportCode ? findAirportByCode(inferredAirportCode) : null;
  if (airport) {
    return airport.country && airport.country !== "US"
      ? `${airport.city}, ${airport.country}`
      : airport.city;
  }

  return raw;
}
