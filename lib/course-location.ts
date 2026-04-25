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
    if (cityCandidate && !/\d/.test(cityCandidate)) {
      return titleCaseWords(cityCandidate);
    }
  }

  if (parts.length === 1 && !/\d/.test(parts[0]) && parts[0].split(/\s+/).length <= 4) {
    return titleCaseWords(parts[0]);
  }

  return "";
}

export function getCourseCardLocation(input: {
  next_location?: string | null;
  next_city?: string | null;
}) {
  const rawLocation = cleanText(input.next_location);
  if (!rawLocation) return "Online / self-paced";
  if (isOnlineLocation(rawLocation)) return "Online / self-paced";

  const city = cleanText(input.next_city);
  if (city) return city;

  const inferredCity = inferCityFromLocation(rawLocation);
  return inferredCity || rawLocation;
}

export function getCourseDetailLocation(input: {
  next_location?: string | null;
  next_city?: string | null;
  next_state?: string | null;
  next_country?: string | null;
}) {
  const rawLocation = cleanText(input.next_location);
  if (!rawLocation) return "Not specified";
  if (isOnlineLocation(rawLocation)) return "Online / self-paced";

  const city = cleanText(input.next_city);
  const state = cleanText(input.next_state);
  const country = cleanText(input.next_country);

  const parts = [city, state, country].filter(Boolean);
  if (parts.length) return parts.join(", ");

  const inferredCity = inferCityFromLocation(rawLocation);
  return inferredCity || rawLocation;
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
