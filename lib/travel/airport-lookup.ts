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

  return null;
}
