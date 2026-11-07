function cleanText(value: string | null | undefined) {
  return String(value || "")
    .replace(/\[maplink\]/gi, " ")
    .replace(/\bmap link\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isOnlineLocation(value: string) {
  return /\bonline|self-paced|self paced|virtual\b/i.test(value);
}

function titleCaseWords(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function cleanVenueAddress(value: string | null | undefined) {
  return cleanText(value)
    .replace(/^address\s*:\s*/i, "")
    .replace(/\s*,\s*\[?\s*maplink\s*\]?/gi, "")
    .replace(/\[.*?maplink.*?\]/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

const US_STATE_CODES = new Set([
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA", "HI", "ID", "IL", "IN", "IA", "KS",
  "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ", "NM", "NY",
  "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV",
  "WI", "WY", "DC", "PR",
]);

const US_STATE_NAMES: Record<string, string> = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA", colorado: "CO",
  connecticut: "CT", delaware: "DE", florida: "FL", georgia: "GA", hawaii: "HI", idaho: "ID",
  illinois: "IL", indiana: "IN", iowa: "IA", kansas: "KS", kentucky: "KY", louisiana: "LA",
  maine: "ME", maryland: "MD", massachusetts: "MA", michigan: "MI", minnesota: "MN",
  mississippi: "MS", missouri: "MO", montana: "MT", nebraska: "NE", nevada: "NV",
  "new hampshire": "NH", "new jersey": "NJ", "new mexico": "NM", "new york": "NY",
  "north carolina": "NC", "north dakota": "ND", ohio: "OH", oklahoma: "OK", oregon: "OR",
  pennsylvania: "PA", "rhode island": "RI", "south carolina": "SC", "south dakota": "SD",
  tennessee: "TN", texas: "TX", utah: "UT", vermont: "VT", virginia: "VA", washington: "WA",
  "west virginia": "WV", wisconsin: "WI", wyoming: "WY", "district of columbia": "DC",
  "puerto rico": "PR",
};

function normalizeState(value: string) {
  const cleaned = cleanText(value).replace(/\./g, "");
  const code = cleaned.toUpperCase();
  if (US_STATE_CODES.has(code)) return code;
  return US_STATE_NAMES[cleaned.toLowerCase()] || "";
}

function isPlausibleCity(value: string) {
  const cleaned = cleanText(value);
  if (!cleaned || /\d|https?:|www\./i.test(cleaned)) return false;
  if (cleaned.length > 45 || cleaned.split(/\s+/).length > 6) return false;
  return !/\b(?:address|company|phone|upper|lower|case letter|registration page|course page|location details|closest dentist|foundation|committed|dining)\b/i.test(cleaned);
}

function isUnitedStates(value: string) {
  return /^(us|usa|u\.s\.?a?\.?|united states(?: of america)?)$/i.test(value.trim());
}

function parseAddressContext(value: string | null | undefined) {
  const parts = cleanVenueAddress(value)
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  let state = "";
  let stateIndex = -1;
  for (let index = 0; index < parts.length; index += 1) {
    const candidate = normalizeState(parts[index]);
    if (candidate) {
      state = candidate;
      stateIndex = index;
      break;
    }
  }

  const lastPart = parts[parts.length - 1] || "";
  const country = lastPart && !/^\d{4,10}(?:-\d+)?$/.test(lastPart) && stateIndex !== parts.length - 1
    ? lastPart
    : "";
  const cityCandidate = stateIndex > 0 ? parts[stateIndex - 1] : "";
  const city = isPlausibleCity(cityCandidate) ? cityCandidate : "";

  return { city, state, country };
}

function formatRegionalLocation(input: {
  rawLocation: string;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  address?: string | null;
}) {
  const addressContext = parseAddressContext(input.address || input.rawLocation);
  const explicitCity = cleanText(input.city);
  const city = (isPlausibleCity(explicitCity) ? explicitCity : "") || addressContext.city || inferCityFromLocation(input.rawLocation);
  const state = normalizeState(cleanText(input.state)) || addressContext.state;
  const country = cleanText(input.country) || addressContext.country;

  if (state) {
    const cityIsState = normalizeState(city) === state;
    return [cityIsState ? "" : city, state].filter(Boolean).join(", ");
  }
  if (country && !isUnitedStates(country)) return [city, country].filter(Boolean).join(", ");
  if (country && isUnitedStates(country)) return city || input.rawLocation;
  return city || input.rawLocation;
}

function inferCityFromLocation(location: string) {
  const cleaned = cleanVenueAddress(location);
  if (!cleaned || isOnlineLocation(cleaned)) return "";

  const withoutCampus = cleaned
    .replace(/\b(address|campus address|campus|main campus)\b\s*:?/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  const parts = withoutCampus
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length >= 2) {
    const cityCandidate = parts[parts.length - 2];
    if (isPlausibleCity(cityCandidate)) {
      return titleCaseWords(cityCandidate);
    }
  }

  if (parts.length === 1 && isPlausibleCity(parts[0])) {
    return titleCaseWords(parts[0]);
  }

  return "";
}

export function getCourseCardLocation(input: {
  next_location?: string | null;
  next_city?: string | null;
  next_state?: string | null;
  next_country?: string | null;
  next_session_address?: string | null;
}) {
  const rawLocation = cleanText(input.next_location);
  if (!rawLocation) return "Online / self-paced";
  if (isOnlineLocation(rawLocation)) return "Online / self-paced";

  return formatRegionalLocation({
    rawLocation,
    city: input.next_city,
    state: input.next_state,
    country: input.next_country,
    address: input.next_session_address,
  });
}

export function getCourseDetailLocation(input: {
  next_location?: string | null;
  next_city?: string | null;
  next_state?: string | null;
  next_country?: string | null;
  next_session_address?: string | null;
}) {
  const rawLocation = cleanText(input.next_location);
  if (!rawLocation) return "Not specified";
  if (isOnlineLocation(rawLocation)) return "Online / self-paced";

  return formatRegionalLocation({
    rawLocation,
    city: input.next_city,
    state: input.next_state,
    country: input.next_country,
    address: input.next_session_address,
  });
}

export function getCourseVenueAddress(input: {
  next_session_address?: string | null;
  next_location?: string | null;
}) {
  const address = cleanVenueAddress(input.next_session_address);
  if (address) return address;

  const fallback = cleanVenueAddress(input.next_location);
  if (!fallback || isOnlineLocation(fallback)) return "";

  return /\d/.test(fallback) ? fallback : "";
}
