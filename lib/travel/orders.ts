import { supabaseAdmin } from "@/lib/supabase-admin";
import type {
  TravelBookingRecord,
  TravelCarOption,
  TravelCheckoutDraft,
  TravelFlightOption,
  TravelHotelOption,
  TravelItineraryDraft,
  TravelPriceBreakdown,
  TravelSearchResponse,
} from "./providers/types";
import { buildItineraryPriceBreakdown, toTravelCheckoutDraft } from "./itinerary";

type SaveItineraryInput = {
  userId: string;
  itineraryId?: string | null;
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
  providers: TravelSearchResponse["providers"];
};

function orderMetadata(input: SaveItineraryInput, priceBreakdown: TravelPriceBreakdown) {
  return {
    course_title: input.courseTitle,
    destination_code: input.destinationCode,
    departure_airport: input.departureAirport,
    travelers: input.travelers,
    budget: input.budget,
    hotel_style: input.hotelStyle,
    needs_car: input.needsCar,
    notes: input.notes,
    providers: input.providers,
    selected_flight: input.selectedFlight,
    selected_hotel: input.selectedHotel,
    selected_car: input.selectedCar,
    price_breakdown: priceBreakdown,
  };
}

function itemRows(orderId: string, input: SaveItineraryInput) {
  const rows: Array<Record<string, unknown>> = [];
  if (input.selectedFlight) {
    rows.push({
      order_id: orderId,
      item_type: "flight",
      supplier: input.selectedFlight.provider,
      title: input.selectedFlight.title,
      description: `${input.selectedFlight.carriers.join(", ")} • ${input.selectedFlight.departureAt || "Departure pending"} → ${input.selectedFlight.arrivalAt || "Arrival pending"}`,
      quantity: 1,
      unit_amount: input.selectedFlight.totalAmount,
      total_amount: input.selectedFlight.totalAmount,
      metadata: input.selectedFlight.metadata,
    });
  }
  if (input.selectedHotel) {
    rows.push({
      order_id: orderId,
      item_type: "hotel",
      supplier: input.selectedHotel.provider,
      title: input.selectedHotel.name,
      description: input.selectedHotel.cityCode || null,
      quantity: 1,
      unit_amount: input.selectedHotel.totalAmount,
      total_amount: input.selectedHotel.totalAmount,
      metadata: input.selectedHotel.metadata,
    });
  }
  if (input.selectedCar) {
    rows.push({
      order_id: orderId,
      item_type: "car",
      supplier: input.selectedCar.provider,
      title: input.selectedCar.name,
      description: input.selectedCar.vehicleType || null,
      quantity: 1,
      unit_amount: input.selectedCar.totalAmount,
      total_amount: input.selectedCar.totalAmount,
      metadata: input.selectedCar.metadata,
    });
  }

  return rows;
}

function toDraft(order: Record<string, unknown>, input: SaveItineraryInput, priceBreakdown: TravelPriceBreakdown): TravelItineraryDraft {
  return {
    id: String(order.id || ""),
    title: input.title,
    courseId: input.courseId,
    courseTitle: input.courseTitle,
    destination: input.destination,
    destinationCode: input.destinationCode,
    departureAirport: input.departureAirport,
    startDate: input.startDate,
    endDate: input.endDate,
    travelers: input.travelers,
    budget: input.budget,
    hotelStyle: input.hotelStyle,
    needsCar: input.needsCar,
    notes: input.notes,
    selectedFlight: input.selectedFlight,
    selectedHotel: input.selectedHotel,
    selectedCar: input.selectedCar,
    priceBreakdown,
    status: String(order.status || "draft"),
    createdAt: String(order.created_at || new Date().toISOString()),
    updatedAt: String(order.updated_at || new Date().toISOString()),
    metadata: (order.metadata as Record<string, unknown>) || {},
  };
}

export async function saveTravelItinerary(input: SaveItineraryInput) {
  const priceBreakdown = buildItineraryPriceBreakdown({
    selectedFlight: input.selectedFlight,
    selectedHotel: input.selectedHotel,
    selectedCar: input.selectedCar,
  });

  const payload = {
    user_id: input.userId,
    course_id: input.courseId,
    status: "draft",
    destination: input.destination,
    starts_on: input.startDate,
    ends_on: input.endDate,
    currency: priceBreakdown.currency,
    subtotal_amount: priceBreakdown.subtotal,
    service_fee_amount: priceBreakdown.serviceFee,
    total_amount: priceBreakdown.total,
    metadata: orderMetadata(input, priceBreakdown),
  };

  const query = input.itineraryId
    ? supabaseAdmin.from("travel_orders").update(payload).eq("id", input.itineraryId).eq("user_id", input.userId)
    : supabaseAdmin.from("travel_orders").insert(payload);

  const { data, error } = await query.select("id, status, metadata, created_at, updated_at").single();
  if (error) throw error;

  const orderId = String(data.id || "");
  await supabaseAdmin.from("travel_order_items").delete().eq("order_id", orderId);
  const rows = itemRows(orderId, input);
  if (rows.length > 0) {
    const { error: itemError } = await supabaseAdmin.from("travel_order_items").insert(rows);
    if (itemError) throw itemError;
  }

  return toDraft(data as unknown as Record<string, unknown>, input, priceBreakdown);
}

export async function listTravelItineraries(userId: string): Promise<TravelBookingRecord[]> {
  const { data, error } = await supabaseAdmin
    .from("travel_orders")
    .select("id, status, destination, starts_on, ends_on, total_amount, service_fee_amount, currency, metadata, created_at, travel_order_items(id, supplier, metadata)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data || []).map((row) => {
    const record = row as unknown as Record<string, unknown>;
    const items = Array.isArray(record.travel_order_items) ? record.travel_order_items as Array<Record<string, unknown>> : [];
    const references = items
      .map((item) => {
        const metadata = typeof item.metadata === "object" && item.metadata ? item.metadata as Record<string, unknown> : {};
        return metadata.booking_reference ? `${item.supplier || "supplier"}: ${String(metadata.booking_reference)}` : null;
      })
      .filter(Boolean) as string[];
    const statuses = items
      .map((item) => {
        const metadata = typeof item.metadata === "object" && item.metadata ? item.metadata as Record<string, unknown> : {};
        return metadata.booking_status ? String(metadata.booking_status) : "draft";
      });

    return {
      orderId: String(record.id || ""),
      status: String(record.status || "draft"),
      destination: record.destination ? String(record.destination) : null,
      startsOn: record.starts_on ? String(record.starts_on) : null,
      endsOn: record.ends_on ? String(record.ends_on) : null,
      totalAmount: typeof record.total_amount === "number" ? record.total_amount : Number(record.total_amount || 0),
      serviceFeeAmount: typeof record.service_fee_amount === "number" ? record.service_fee_amount : Number(record.service_fee_amount || 0),
      currency: record.currency ? String(record.currency) : "USD",
      providerReferences: references,
      itemStatuses: statuses,
      metadata: typeof record.metadata === "object" && record.metadata ? record.metadata as Record<string, unknown> : {},
      createdAt: String(record.created_at || new Date().toISOString()),
    };
  });
}

export async function markTravelOrderPendingCheckout(orderId: string, stripeCheckoutSessionId: string | null) {
  const { error } = await supabaseAdmin
    .from("travel_orders")
    .update({
      status: "pending",
      stripe_checkout_session_id: stripeCheckoutSessionId,
    })
    .eq("id", orderId);

  if (error) throw error;
}

export async function markTravelOrderAfterPayment({
  orderId,
  paymentIntentId,
  metadata,
}: {
  orderId: string;
  paymentIntentId: string | null;
  metadata: Record<string, unknown>;
}) {
  const { data: order, error: fetchError } = await supabaseAdmin
    .from("travel_orders")
    .select("metadata")
    .eq("id", orderId)
    .single();

  if (fetchError) throw fetchError;

  const mergedMetadata = {
    ...(typeof order.metadata === "object" && order.metadata ? order.metadata : {}),
    ...metadata,
  };

  const { error } = await supabaseAdmin
    .from("travel_orders")
    .update({
      status: "paid",
      stripe_payment_intent_id: paymentIntentId,
      metadata: mergedMetadata,
    })
    .eq("id", orderId);

  if (error) throw error;
}

export function checkoutDraftFromItinerary(args: {
  itinerary: TravelItineraryDraft;
  stripeCheckoutUrl: string | null;
  providers: TravelSearchResponse["providers"];
}): TravelCheckoutDraft {
  return toTravelCheckoutDraft(args);
}
