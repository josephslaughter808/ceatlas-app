export type TravelProviderStatus = {
  provider: string;
  configured: boolean;
  mode: "live" | "fallback" | "disabled";
  message: string | null;
};

export type TravelPriceBreakdown = {
  baseAmount: number;
  taxesAndFees: number;
  subtotal: number;
  serviceFee: number;
  total: number;
  currency: string;
};

export type TravelFlightOption = {
  id: string;
  provider: string;
  offerToken?: string | null;
  title: string;
  total: string | null;
  totalAmount: number | null;
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
  refundable?: boolean | null;
  metadata: Record<string, unknown>;
};

export type TravelHotelOption = {
  id: string;
  provider: string;
  offerToken?: string | null;
  name: string;
  cityCode: string | null;
  cityName?: string | null;
  latitude: number | null;
  longitude: number | null;
  total: string | null;
  totalAmount: number | null;
  currency: string | null;
  rating?: number | null;
  address?: string | null;
  metadata: Record<string, unknown>;
};

export type TravelCarOption = {
  id: string;
  provider: string;
  offerToken?: string | null;
  name: string;
  vehicleType: string | null;
  pickupCode: string | null;
  total: string | null;
  totalAmount: number | null;
  currency: string | null;
  metadata: Record<string, unknown>;
};

export type TravelSearchResponse = {
  configured: boolean;
  flights: TravelFlightOption[];
  hotels: TravelHotelOption[];
  cars: TravelCarOption[];
  providers: {
    flights: TravelProviderStatus;
    hotels: TravelProviderStatus;
    cars: TravelProviderStatus;
  };
  warnings: string[];
  pricing: {
    flightMin: TravelPriceBreakdown | null;
    hotelMin: TravelPriceBreakdown | null;
    carMin: TravelPriceBreakdown | null;
    combinedMin: TravelPriceBreakdown | null;
  };
  error?: string;
};

export type TravelItineraryDraft = {
  id: string;
  title: string;
  courseId: string;
  courseTitle: string;
  destination: string;
  destinationCode: string;
  departureAirport: string;
  startDate: string | null;
  endDate: string | null;
  travelers: number;
  budget: string;
  hotelStyle: string;
  needsCar: boolean;
  notes: string;
  selectedFlight: TravelFlightOption | null;
  selectedHotel: TravelHotelOption | null;
  selectedCar: TravelCarOption | null;
  priceBreakdown: TravelPriceBreakdown;
  status: string;
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, unknown>;
};

export type TravelCheckoutDraft = {
  orderId: string;
  currency: string;
  subtotalAmount: number;
  serviceFeeAmount: number;
  totalAmount: number;
  stripeCheckoutUrl: string | null;
  providerStatuses: TravelSearchResponse["providers"];
};

export type TravelBookingRecord = {
  orderId: string;
  status: string;
  destination: string | null;
  startsOn: string | null;
  endsOn: string | null;
  totalAmount: number | null;
  serviceFeeAmount: number | null;
  currency: string | null;
  providerReferences: string[];
  itemStatuses: string[];
  metadata: Record<string, unknown>;
  createdAt: string;
};
