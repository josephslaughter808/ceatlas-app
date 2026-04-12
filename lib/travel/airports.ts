import generatedAirports from "./airports.generated.json";

export type AirportOption = {
  code: string;
  city: string;
  name: string;
  country?: string;
  priority?: number;
};

const POPULAR_AIRPORTS: AirportOption[] = [
  { code: "ATL", city: "Atlanta", name: "Hartsfield-Jackson Atlanta", priority: 100 },
  { code: "AUS", city: "Austin", name: "Austin-Bergstrom", priority: 92 },
  { code: "BNA", city: "Nashville", name: "Nashville International", priority: 88 },
  { code: "BOS", city: "Boston", name: "Logan International", priority: 96 },
  { code: "CLT", city: "Charlotte", name: "Charlotte Douglas", priority: 94 },
  { code: "DCA", city: "Washington", name: "Ronald Reagan Washington National", priority: 90 },
  { code: "DEN", city: "Denver", name: "Denver International", priority: 98 },
  { code: "DFW", city: "Dallas-Fort Worth", name: "Dallas Fort Worth International", priority: 100 },
  { code: "DTW", city: "Detroit", name: "Detroit Metro Wayne County", priority: 86 },
  { code: "EWR", city: "Newark", name: "Newark Liberty International", priority: 95 },
  { code: "FLL", city: "Fort Lauderdale", name: "Fort Lauderdale-Hollywood International", priority: 82 },
  { code: "HNL", city: "Honolulu", name: "Daniel K. Inouye International", priority: 70 },
  { code: "IAD", city: "Washington", name: "Washington Dulles International", priority: 89 },
  { code: "IAH", city: "Houston", name: "George Bush Intercontinental", priority: 93 },
  { code: "JFK", city: "New York City", name: "John F Kennedy International", priority: 99 },
  { code: "LAS", city: "Las Vegas", name: "Harry Reid International", priority: 96 },
  { code: "LAX", city: "Los Angeles", name: "Los Angeles International", priority: 100 },
  { code: "LGA", city: "New York City", name: "LaGuardia", priority: 91 },
  { code: "MCO", city: "Orlando", name: "Orlando International", priority: 90 },
  { code: "MIA", city: "Miami", name: "Miami International", priority: 92 },
  { code: "MSP", city: "Minneapolis", name: "Minneapolis-Saint Paul International", priority: 86 },
  { code: "ORD", city: "Chicago", name: "O'Hare International", priority: 100 },
  { code: "PDX", city: "Portland", name: "Portland International", priority: 80 },
  { code: "PHL", city: "Philadelphia", name: "Philadelphia International", priority: 88 },
  { code: "PHX", city: "Phoenix", name: "Phoenix Sky Harbor International", priority: 95 },
  { code: "SAN", city: "San Diego", name: "San Diego International", priority: 87 },
  { code: "SEA", city: "Seattle", name: "Seattle-Tacoma International", priority: 95 },
  { code: "SFO", city: "San Francisco", name: "San Francisco International", priority: 97 },
  { code: "SJC", city: "San Jose", name: "Norman Y. Mineta San Jose International", priority: 74 },
  { code: "SLC", city: "Salt Lake City", name: "Salt Lake City International", priority: 84 },
  { code: "STL", city: "St. Louis", name: "St. Louis Lambert International", priority: 72 },
  { code: "TPA", city: "Tampa", name: "Tampa International", priority: 81 },

  { code: "YUL", city: "Montreal", name: "Montréal-Trudeau International", country: "Canada", priority: 70 },
  { code: "YVR", city: "Vancouver", name: "Vancouver International", country: "Canada", priority: 82 },
  { code: "YYZ", city: "Toronto", name: "Toronto Pearson International", country: "Canada", priority: 88 },

  { code: "AMS", city: "Amsterdam", name: "Amsterdam Schiphol", country: "Netherlands", priority: 88 },
  { code: "ARN", city: "Stockholm", name: "Stockholm Arlanda", country: "Sweden", priority: 62 },
  { code: "ATH", city: "Athens", name: "Athens International", country: "Greece", priority: 70 },
  { code: "BCN", city: "Barcelona", name: "Barcelona-El Prat", country: "Spain", priority: 82 },
  { code: "BER", city: "Berlin", name: "Berlin Brandenburg", country: "Germany", priority: 76 },
  { code: "BRU", city: "Brussels", name: "Brussels Airport", country: "Belgium", priority: 62 },
  { code: "BUD", city: "Budapest", name: "Budapest Ferenc Liszt International", country: "Hungary", priority: 56 },
  { code: "CDG", city: "Paris", name: "Charles de Gaulle", country: "France", priority: 92 },
  { code: "CPH", city: "Copenhagen", name: "Copenhagen Airport", country: "Denmark", priority: 60 },
  { code: "DUB", city: "Dublin", name: "Dublin Airport", country: "Ireland", priority: 68 },
  { code: "EDI", city: "Edinburgh", name: "Edinburgh Airport", country: "United Kingdom", priority: 54 },
  { code: "FCO", city: "Rome", name: "Leonardo da Vinci Fiumicino", country: "Italy", priority: 84 },
  { code: "FRA", city: "Frankfurt", name: "Frankfurt Airport", country: "Germany", priority: 90 },
  { code: "GVA", city: "Geneva", name: "Geneva Airport", country: "Switzerland", priority: 58 },
  { code: "HEL", city: "Helsinki", name: "Helsinki Airport", country: "Finland", priority: 52 },
  { code: "IST", city: "Istanbul", name: "Istanbul Airport", country: "Turkey", priority: 78 },
  { code: "LHR", city: "London", name: "Heathrow", country: "United Kingdom", priority: 95 },
  { code: "LIS", city: "Lisbon", name: "Humberto Delgado", country: "Portugal", priority: 64 },
  { code: "MAD", city: "Madrid", name: "Adolfo Suárez Madrid-Barajas", country: "Spain", priority: 82 },
  { code: "MAN", city: "Manchester", name: "Manchester Airport", country: "United Kingdom", priority: 60 },
  { code: "MUC", city: "Munich", name: "Munich Airport", country: "Germany", priority: 80 },
  { code: "MXP", city: "Milan", name: "Milan Malpensa", country: "Italy", priority: 70 },
  { code: "OSL", city: "Oslo", name: "Oslo Airport", country: "Norway", priority: 50 },
  { code: "PRG", city: "Prague", name: "Václav Havel Airport Prague", country: "Czech Republic", priority: 55 },
  { code: "VIE", city: "Vienna", name: "Vienna International", country: "Austria", priority: 66 },
  { code: "WAW", city: "Warsaw", name: "Warsaw Chopin", country: "Poland", priority: 54 },
  { code: "ZRH", city: "Zurich", name: "Zurich Airport", country: "Switzerland", priority: 65 },

  { code: "AUH", city: "Abu Dhabi", name: "Zayed International", country: "United Arab Emirates", priority: 54 },
  { code: "BKK", city: "Bangkok", name: "Suvarnabhumi", country: "Thailand", priority: 78 },
  { code: "DEL", city: "Delhi", name: "Indira Gandhi International", country: "India", priority: 74 },
  { code: "DOH", city: "Doha", name: "Hamad International", country: "Qatar", priority: 72 },
  { code: "DXB", city: "Dubai", name: "Dubai International", country: "United Arab Emirates", priority: 86 },
  { code: "HKG", city: "Hong Kong", name: "Hong Kong International", country: "Hong Kong", priority: 76 },
  { code: "HND", city: "Tokyo", name: "Haneda", country: "Japan", priority: 84 },
  { code: "ICN", city: "Seoul", name: "Incheon International", country: "South Korea", priority: 80 },
  { code: "KUL", city: "Kuala Lumpur", name: "Kuala Lumpur International", country: "Malaysia", priority: 56 },
  { code: "NRT", city: "Tokyo", name: "Narita International", country: "Japan", priority: 78 },
  { code: "SIN", city: "Singapore", name: "Singapore Changi", country: "Singapore", priority: 86 },
  { code: "SYD", city: "Sydney", name: "Sydney Kingsford Smith", country: "Australia", priority: 74 },

  { code: "CPT", city: "Cape Town", name: "Cape Town International", country: "South Africa", priority: 48 },
  { code: "JNB", city: "Johannesburg", name: "O. R. Tambo International", country: "South Africa", priority: 56 },

  { code: "BOG", city: "Bogotá", name: "El Dorado International", country: "Colombia", priority: 54 },
  { code: "EZE", city: "Buenos Aires", name: "Ministro Pistarini International", country: "Argentina", priority: 50 },
  { code: "GRU", city: "São Paulo", name: "São Paulo/Guarulhos International", country: "Brazil", priority: 72 },
  { code: "GIG", city: "Rio de Janeiro", name: "Galeão International", country: "Brazil", priority: 54 },
  { code: "LIM", city: "Lima", name: "Jorge Chávez International", country: "Peru", priority: 50 },
  { code: "MEX", city: "Mexico City", name: "Benito Juárez International", country: "Mexico", priority: 74 },
  { code: "SCL", city: "Santiago", name: "Arturo Merino Benítez International", country: "Chile", priority: 52 },
];

const priorityByCode = new Map(POPULAR_AIRPORTS.map((airport) => [airport.code, airport.priority || 0]));
const preferredByCode = new Map(POPULAR_AIRPORTS.map((airport) => [airport.code, airport]));

export const AIRPORT_OPTIONS = [...generatedAirports]
  .map((airport) => ({
    ...airport,
    ...(preferredByCode.get(airport.code) || {}),
    priority: priorityByCode.get(airport.code) || 0,
  }))
  .sort((a, b) => (b.priority || 0) - (a.priority || 0) || a.city.localeCompare(b.city) || a.code.localeCompare(b.code));

export function formatAirportLabel(option: AirportOption) {
  return `${option.code} - ${option.city} - ${option.name}`;
}

export function findAirportByCode(code: string | null | undefined) {
  const normalized = String(code || "").trim().toUpperCase();
  if (!normalized) return null;
  return AIRPORT_OPTIONS.find((option) => option.code === normalized) || null;
}

export function resolveAirportOption(query: string | null | undefined) {
  const normalized = String(query || "").trim();
  if (!normalized) return null;
  const upper = normalized.toUpperCase();
  return AIRPORT_OPTIONS.find((option) =>
    option.code === upper
    || formatAirportLabel(option).toUpperCase() === upper
    || `${option.code} ${option.city} ${option.name}`.toUpperCase() === upper
  ) || null;
}

export function searchAirportOptions(query: string | null | undefined, limit = 50) {
  const normalized = String(query || "").trim().toLowerCase();
  if (!normalized) {
    return AIRPORT_OPTIONS.slice(0, limit);
  }

  return AIRPORT_OPTIONS
    .filter((option) => {
      const haystack = `${option.code} ${option.city} ${option.name} ${option.country || ""}`.toLowerCase();
      return haystack.includes(normalized);
    }).sort((a, b) => (b.priority || 0) - (a.priority || 0) || a.city.localeCompare(b.city) || a.code.localeCompare(b.code))
    .slice(0, limit);
}
